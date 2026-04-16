"use server"

import { createClient } from "@/lib/supabase/server"

export type DispatchStatus = "not_dispatched" | "partial" | "fully_dispatched"

/** One order that contains this item */
export interface ItemOrderEntry {
  order_item_id: string
  order_id: string
  internal_order_number: string | null
  sales_order_number: string | null
  order_status: string
  order_created_at: string
  customer_id: string | null
  customer_name: string
  customer_phone: string | null
  quantity: number
  unit_price: number
  subtotal: number
  qty_net_dispatched: number
  qty_returned: number
  qty_remaining: number
  dispatch_status: DispatchStatus
  latest_dispatch_date: string | null
  latest_tracking_number: string | null
  latest_courier_name: string | null
}

/** One unique product / inventory item with all its order history */
export interface ItemSummary {
  item_key: string          // product_id or inventory_item_id
  item_name: string
  item_sku: string | null
  item_category: string | null

  // Aggregates across all orders
  total_orders: number
  total_quantity: number
  total_value: number
  total_dispatched: number
  total_remaining: number
  unique_customers: number
  last_ordered_at: string | null

  // Full order history for the detail sheet
  orders: ItemOrderEntry[]
}

export interface ItemsStats {
  unique_items: number
  total_orders: number
  total_quantity: number
  total_value: number
  fully_dispatched_items: number
  pending_items: number
}

export type ItemMatchReason = "item" | "sku" | "category" | "customer" | "order"

export type ItemsListSortKey =
  | "item_name"
  | "total_orders"
  | "total_quantity"
  | "total_value"
  | "last_ordered_at"
  | "total_remaining"

export interface ItemsListQuery {
  page?: number
  page_size?: number
  search?: string
  customer_id?: string
  category?: string
  dispatch_status?: "all" | DispatchStatus
  sort_key?: ItemsListSortKey
  sort_dir?: "asc" | "desc"
}

export interface ItemsFacetOption {
  value: string
  label: string
  count: number
}

export interface ItemsListRow {
  item_key: string
  item_name: string
  item_sku: string | null
  item_category: string | null
  total_orders: number
  total_quantity: number
  total_value: number
  total_dispatched: number
  total_remaining: number
  unique_customers: number
  last_ordered_at: string | null
  customers: string[]
  match_reasons: ItemMatchReason[]
}

export interface ItemsListResult {
  rows: ItemsListRow[]
  total_rows: number
  total_pages: number
  page: number
  page_size: number
  stats: ItemsStats
  facets: {
    customers: ItemsFacetOption[]
    categories: ItemsFacetOption[]
  }
}

type RawOrderItem = {
  id: string
  order_id: string
  quantity: number
  unit_price: number | null
  subtotal: number | null
  inventory_item_id: string | null
  product_id: string | null
  created_at: string
  orders: any
}

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100
const ITEM_SELECT = `
  id,
  order_id,
  quantity,
  unit_price,
  subtotal,
  inventory_item_id,
  product_id,
  created_at,
  orders:order_id (
    id,
    internal_order_number,
    sales_order_number,
    order_status,
    created_at,
    customers:customer_id ( id, name, phone )
  )
`

function toLower(value: string | null | undefined) {
  return (value ?? "").toLowerCase()
}

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function normalizeQuery(query?: ItemsListQuery) {
  const page = Math.max(1, Number(query?.page ?? 1) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(5, Number(query?.page_size ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE))
  const sortKey = query?.sort_key ?? "last_ordered_at"
  const sortDir = query?.sort_dir ?? "desc"
  return {
    page,
    pageSize,
    search: (query?.search ?? "").trim(),
    customerId: query?.customer_id && query.customer_id !== "all" ? query.customer_id : null,
    category: query?.category && query.category !== "all" ? query.category : null,
    dispatchStatus: query?.dispatch_status && query.dispatch_status !== "all" ? query.dispatch_status : null,
    sortKey,
    sortDir,
  }
}

function calcStats(items: ItemSummary[], totalOrders = 0): ItemsStats {
  return {
    unique_items: items.length,
    total_orders: totalOrders || items.reduce((sum, item) => sum + item.total_orders, 0),
    total_quantity: items.reduce((sum, item) => sum + item.total_quantity, 0),
    total_value: items.reduce((sum, item) => sum + item.total_value, 0),
    fully_dispatched_items: items.filter((item) => item.total_remaining === 0 && item.total_dispatched > 0).length,
    pending_items: items.filter((item) => item.total_remaining > 0).length,
  }
}

function sortItems(items: ItemSummary[], sortKey: ItemsListSortKey, sortDir: "asc" | "desc") {
  const sorted = [...items]
  sorted.sort((a, b) => {
    let av: number | string = ""
    let bv: number | string = ""
    if (sortKey === "item_name") {
      av = a.item_name
      bv = b.item_name
    } else if (sortKey === "total_orders") {
      av = a.total_orders
      bv = b.total_orders
    } else if (sortKey === "total_quantity") {
      av = a.total_quantity
      bv = b.total_quantity
    } else if (sortKey === "total_value") {
      av = a.total_value
      bv = b.total_value
    } else if (sortKey === "total_remaining") {
      av = a.total_remaining
      bv = b.total_remaining
    } else {
      av = a.last_ordered_at ?? ""
      bv = b.last_ordered_at ?? ""
    }
    if (av < bv) return sortDir === "asc" ? -1 : 1
    if (av > bv) return sortDir === "asc" ? 1 : -1
    return 0
  })
  return sorted
}

function getMatchReasons(item: ItemSummary, q: string): ItemMatchReason[] {
  const reasons = new Set<ItemMatchReason>()
  const needle = q.toLowerCase()
  if (toLower(item.item_name).includes(needle)) reasons.add("item")
  if (toLower(item.item_sku).includes(needle)) reasons.add("sku")
  if (toLower(item.item_category).includes(needle)) reasons.add("category")

  for (const order of item.orders) {
    if (toLower(order.customer_name).includes(needle)) reasons.add("customer")
    if (toLower(order.internal_order_number).includes(needle) || toLower(order.sales_order_number).includes(needle)) {
      reasons.add("order")
    }
  }

  return [...reasons]
}

function toListRow(item: ItemSummary, matchReasons: ItemMatchReason[] = []): ItemsListRow {
  const uniqueCustomers = [...new Set(item.orders.map((order) => order.customer_name))]
  return {
    item_key: item.item_key,
    item_name: item.item_name,
    item_sku: item.item_sku,
    item_category: item.item_category,
    total_orders: item.total_orders,
    total_quantity: item.total_quantity,
    total_value: item.total_value,
    total_dispatched: item.total_dispatched,
    total_remaining: item.total_remaining,
    unique_customers: item.unique_customers,
    last_ordered_at: item.last_ordered_at,
    customers: uniqueCustomers,
    match_reasons: matchReasons,
  }
}

function filterByDispatchStatus(items: ItemSummary[], dispatchStatus: DispatchStatus | null) {
  if (!dispatchStatus) return items
  if (dispatchStatus === "fully_dispatched") {
    return items.filter((item) => item.total_remaining === 0 && item.total_dispatched > 0)
  }
  if (dispatchStatus === "partial") {
    return items.filter((item) => item.total_remaining > 0 && item.total_dispatched > 0)
  }
  return items.filter((item) => item.total_dispatched === 0)
}

function buildFacets(base: ItemSummary[], normalized: ReturnType<typeof normalizeQuery>) {
  const forCustomers = filterByDispatchStatus(
    base.filter((item) => (normalized.category ? item.item_category === normalized.category : true)),
    normalized.dispatchStatus
  )
  const forCategories = filterByDispatchStatus(
    base.filter((item) =>
      normalized.customerId ? item.orders.some((order) => order.customer_id === normalized.customerId) : true
    ),
    normalized.dispatchStatus
  )

  const customerMap = new Map<string, ItemsFacetOption>()
  for (const item of forCustomers) {
    const seenCustomerIds = new Set<string>()
    for (const order of item.orders) {
      if (!order.customer_id || seenCustomerIds.has(order.customer_id)) continue
      seenCustomerIds.add(order.customer_id)
      const prev = customerMap.get(order.customer_id)
      customerMap.set(order.customer_id, {
        value: order.customer_id,
        label: order.customer_name,
        count: (prev?.count ?? 0) + 1,
      })
    }
  }

  const categoryMap = new Map<string, ItemsFacetOption>()
  for (const item of forCategories) {
    const category = item.item_category
    if (!category) continue
    const prev = categoryMap.get(category)
    categoryMap.set(category, {
      value: category,
      label: category,
      count: (prev?.count ?? 0) + 1,
    })
  }

  return {
    customers: [...customerMap.values()].sort((a, b) => a.label.localeCompare(b.label)),
    categories: [...categoryMap.values()].sort((a, b) => a.label.localeCompare(b.label)),
  }
}

async function fetchOrderItemsForList() {
  const supabase = await createClient()
  const { data: orderItems, error } = await supabase
    .from("order_items")
    .select(ITEM_SELECT)
    .order("created_at", { ascending: false })

  return { supabase, orderItems: (orderItems ?? []) as RawOrderItem[], error }
}

async function fetchOrderItemsForKey(key: string) {
  const supabase = await createClient()
  const [inventoryRowsResult, productRowsResult] = await Promise.all([
    supabase.from("order_items").select(ITEM_SELECT).eq("inventory_item_id", key).order("created_at", { ascending: false }),
    supabase
      .from("order_items")
      .select(ITEM_SELECT)
      .eq("product_id", key)
      .is("inventory_item_id", null)
      .order("created_at", { ascending: false }),
  ])

  const invRows = (inventoryRowsResult.data ?? []) as RawOrderItem[]
  const prodRows = (productRowsResult.data ?? []) as RawOrderItem[]
  const mergedById = new Map<string, RawOrderItem>()
  for (const row of [...invRows, ...prodRows]) mergedById.set(row.id, row)
  return {
    supabase,
    orderItems: [...mergedById.values()],
    error: inventoryRowsResult.error ?? productRowsResult.error ?? null,
  }
}

async function buildItemSummaries(orderItems: RawOrderItem[], supabase: Awaited<ReturnType<typeof createClient>>) {
  if (orderItems.length === 0) return []

  const invIds = [...new Set(orderItems.filter((oi) => oi.inventory_item_id).map((oi) => oi.inventory_item_id as string))]
  const prodIds = [...new Set(orderItems.filter((oi) => oi.product_id && !oi.inventory_item_id).map((oi) => oi.product_id as string))]

  const [invResult, prodResult] = await Promise.all([
    invIds.length > 0
      ? supabase.from("inventory_items").select("id, item_name, parent_item_id").in("id", invIds)
      : Promise.resolve({ data: [] as any[] }),
    prodIds.length > 0
      ? supabase.from("products").select("id, name, sku, category").in("id", prodIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const invMap = new Map<string, { item_name: string; parent_item_id: string | null }>()
  for (const row of invResult.data || []) {
    invMap.set(row.id, { item_name: row.item_name ?? "", parent_item_id: row.parent_item_id ?? null })
  }

  const parentIds = [
    ...new Set(
      [...invMap.values()]
        .filter((value) => value.parent_item_id && !invMap.has(value.parent_item_id))
        .map((value) => value.parent_item_id as string)
    ),
  ]

  if (parentIds.length > 0) {
    const { data: parents } = await supabase.from("inventory_items").select("id, item_name, parent_item_id").in("id", parentIds)
    for (const row of parents || []) invMap.set(row.id, { item_name: row.item_name ?? "", parent_item_id: null })
  }

  const prodMap = new Map<string, { name: string; sku: string | null; category: string | null }>()
  for (const row of prodResult.data || []) {
    prodMap.set(row.id, { name: row.name ?? "", sku: row.sku ?? null, category: row.category ?? null })
  }

  function resolveItem(invId: string | null, prodId: string | null): { name: string; sku: string | null; category: string | null } {
    if (invId) {
      const inv = invMap.get(invId)
      if (inv) {
        if (inv.parent_item_id) {
          const parent = invMap.get(inv.parent_item_id)
          return { name: parent ? `${parent.item_name} → ${inv.item_name}` : inv.item_name, sku: null, category: null }
        }
        return { name: inv.item_name, sku: null, category: null }
      }
    }
    if (prodId) {
      const prod = prodMap.get(prodId)
      if (prod) return { name: prod.name, sku: prod.sku, category: prod.category }
    }
    return { name: "Unknown Item", sku: null, category: null }
  }

  const orderItemIds = orderItems.map((oi) => oi.id)
  const { data: dispatchRows } = await supabase
    .from("dispatch_items")
    .select(`
      order_item_id,
      quantity,
      dispatches:dispatch_id (
        dispatch_date,
        dispatch_type,
        tracking_number,
        courier_companies:courier_id ( name )
      )
    `)
    .in("order_item_id", orderItemIds)

  type DispatchAgg = {
    dispatched: number
    returned: number
    latestDate: string | null
    latestTracking: string | null
    latestCourier: string | null
  }
  const dispatchAggByOrderItem = new Map<string, DispatchAgg>()
  for (const row of dispatchRows || []) {
    const orderItemId = row.order_item_id as string
    if (!dispatchAggByOrderItem.has(orderItemId)) {
      dispatchAggByOrderItem.set(orderItemId, { dispatched: 0, returned: 0, latestDate: null, latestTracking: null, latestCourier: null })
    }
    const agg = dispatchAggByOrderItem.get(orderItemId)!
    const dispatch = row.dispatches as any
    const qty = Number(row.quantity || 0)
    if (dispatch?.dispatch_type === "return") {
      agg.returned += qty
    } else {
      agg.dispatched += qty
      const dispatchDate = dispatch?.dispatch_date ?? null
      if (dispatchDate && (!agg.latestDate || dispatchDate > agg.latestDate)) {
        agg.latestDate = dispatchDate
        agg.latestTracking = dispatch?.tracking_number ?? null
        agg.latestCourier = (dispatch?.courier_companies as any)?.name ?? null
      }
    }
  }

  const grouped = new Map<
    string,
    {
      resolved: { name: string; sku: string | null; category: string | null }
      entries: ItemOrderEntry[]
    }
  >()

  for (const oi of orderItems) {
    const key = oi.inventory_item_id ?? oi.product_id ?? oi.id
    const resolved = resolveItem(oi.inventory_item_id, oi.product_id)
    const order = firstOrNull(oi.orders)
    const customer = firstOrNull(order?.customers)
    const dispatchAgg = dispatchAggByOrderItem.get(oi.id) ?? {
      dispatched: 0,
      returned: 0,
      latestDate: null,
      latestTracking: null,
      latestCourier: null,
    }
    const netDispatched = Math.max(0, dispatchAgg.dispatched - dispatchAgg.returned)
    const remaining = Math.max(0, Number(oi.quantity) - netDispatched)
    let dispatchStatus: DispatchStatus = "not_dispatched"
    if (netDispatched > 0 && remaining > 0) dispatchStatus = "partial"
    else if (netDispatched > 0 && remaining === 0) dispatchStatus = "fully_dispatched"

    const entry: ItemOrderEntry = {
      order_item_id: oi.id,
      order_id: oi.order_id,
      internal_order_number: order?.internal_order_number ?? null,
      sales_order_number: order?.sales_order_number ?? null,
      order_status: order?.order_status ?? "Unknown",
      order_created_at: order?.created_at ?? oi.created_at,
      customer_id: customer?.id ?? null,
      customer_name: customer?.name ?? "—",
      customer_phone: customer?.phone ?? null,
      quantity: Number(oi.quantity),
      unit_price: Number(oi.unit_price ?? 0),
      subtotal: Number(oi.subtotal ?? Number(oi.quantity) * Number(oi.unit_price ?? 0)),
      qty_net_dispatched: netDispatched,
      qty_returned: dispatchAgg.returned,
      qty_remaining: remaining,
      dispatch_status: dispatchStatus,
      latest_dispatch_date: dispatchAgg.latestDate,
      latest_tracking_number: dispatchAgg.latestTracking,
      latest_courier_name: dispatchAgg.latestCourier,
    }

    if (!grouped.has(key)) grouped.set(key, { resolved, entries: [] })
    grouped.get(key)!.entries.push(entry)
  }

  const items: ItemSummary[] = []
  for (const [key, { resolved, entries }] of grouped) {
    const totalQty = entries.reduce((sum, entry) => sum + entry.quantity, 0)
    const totalValue = entries.reduce((sum, entry) => sum + entry.subtotal, 0)
    const totalDispatched = entries.reduce((sum, entry) => sum + entry.qty_net_dispatched, 0)
    const totalRemaining = entries.reduce((sum, entry) => sum + entry.qty_remaining, 0)
    const uniqueCustomers = new Set(entries.map((entry) => entry.customer_id).filter(Boolean)).size
    const lastOrdered = entries.reduce((latest: string | null, entry) => {
      if (!latest || entry.order_created_at > latest) return entry.order_created_at
      return latest
    }, null)

    items.push({
      item_key: key,
      item_name: resolved.name,
      item_sku: resolved.sku,
      item_category: resolved.category,
      total_orders: entries.length,
      total_quantity: totalQty,
      total_value: totalValue,
      total_dispatched: totalDispatched,
      total_remaining: totalRemaining,
      unique_customers: uniqueCustomers,
      last_ordered_at: lastOrdered,
      orders: entries,
    })
  }

  return sortItems(items, "last_ordered_at", "desc")
}

export async function getAllItems(): Promise<{
  success: boolean
  data: ItemSummary[] | null
  stats: ItemsStats | null
  error: string | null
}> {
  const { supabase, orderItems, error } = await fetchOrderItemsForList()
  if (error) {
    return { success: false, data: null, stats: null, error: error.message }
  }
  if (orderItems.length === 0) {
    return {
      success: true,
      data: [],
      stats: { unique_items: 0, total_orders: 0, total_quantity: 0, total_value: 0, fully_dispatched_items: 0, pending_items: 0 },
      error: null,
    }
  }

  const items = await buildItemSummaries(orderItems, supabase)
  const stats = calcStats(items, orderItems.length)
  return { success: true, data: items, stats, error: null }
}

export async function getItemsList(query?: ItemsListQuery): Promise<{
  success: boolean
  data: ItemsListResult | null
  error: string | null
}> {
  const normalized = normalizeQuery(query)
  const allItemsResult = await getAllItems()
  if (!allItemsResult.success) {
    return { success: false, data: null, error: allItemsResult.error }
  }

  const allItems = allItemsResult.data ?? []
  const matchReasonsByItem = new Map<string, ItemMatchReason[]>()

  let searchedItems = [...allItems]
  if (normalized.search) {
    searchedItems = allItems.filter((item) => {
      const reasons = getMatchReasons(item, normalized.search)
      if (reasons.length > 0) {
        matchReasonsByItem.set(item.item_key, reasons)
        return true
      }
      return false
    })
  }

  const facets = buildFacets(searchedItems, normalized)

  let filtered = searchedItems
  if (normalized.customerId) {
    filtered = filtered.filter((item) => item.orders.some((order) => order.customer_id === normalized.customerId))
  }
  if (normalized.category) {
    filtered = filtered.filter((item) => item.item_category === normalized.category)
  }
  filtered = filterByDispatchStatus(filtered, normalized.dispatchStatus)
  filtered = sortItems(filtered, normalized.sortKey, normalized.sortDir)

  const totalRows = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalRows / normalized.pageSize))
  const page = Math.min(normalized.page, totalPages)
  const start = (page - 1) * normalized.pageSize
  const rows = filtered.slice(start, start + normalized.pageSize).map((item) => {
    const reasons = matchReasonsByItem.get(item.item_key) ?? []
    return toListRow(item, reasons)
  })

  return {
    success: true,
    data: {
      rows,
      total_rows: totalRows,
      total_pages: totalPages,
      page,
      page_size: normalized.pageSize,
      stats: calcStats(filtered),
      facets,
    },
    error: null,
  }
}

export async function getItemsForExport(query?: Omit<ItemsListQuery, "page" | "page_size">): Promise<{
  success: boolean
  data: ItemsListRow[] | null
  error: string | null
}> {
  const result = await getItemsList({ ...query, page: 1, page_size: MAX_PAGE_SIZE })
  if (!result.success || !result.data) return { success: false, data: null, error: result.error ?? "Unable to export items" }

  const normalized = normalizeQuery(query)
  if (result.data.total_rows <= MAX_PAGE_SIZE) {
    return { success: true, data: result.data.rows, error: null }
  }

  const allItemsResult = await getAllItems()
  if (!allItemsResult.success) return { success: false, data: null, error: allItemsResult.error }

  const allItems = allItemsResult.data ?? []
  const matchReasonsByItem = new Map<string, ItemMatchReason[]>()
  let filtered = [...allItems]

  if (normalized.search) {
    filtered = filtered.filter((item) => {
      const reasons = getMatchReasons(item, normalized.search)
      if (reasons.length > 0) {
        matchReasonsByItem.set(item.item_key, reasons)
        return true
      }
      return false
    })
  }
  if (normalized.customerId) filtered = filtered.filter((item) => item.orders.some((order) => order.customer_id === normalized.customerId))
  if (normalized.category) filtered = filtered.filter((item) => item.item_category === normalized.category)
  filtered = filterByDispatchStatus(filtered, normalized.dispatchStatus)
  filtered = sortItems(filtered, normalized.sortKey, normalized.sortDir)
  return {
    success: true,
    data: filtered.map((item) => toListRow(item, matchReasonsByItem.get(item.item_key) ?? [])),
    error: null,
  }
}

export async function getItemByKey(key: string): Promise<{
  success: boolean
  data: ItemSummary | null
  error: string | null
}> {
  const { supabase, orderItems, error } = await fetchOrderItemsForKey(key)
  if (error) return { success: false, data: null, error: error.message }
  if (orderItems.length === 0) return { success: false, data: null, error: "Item not found" }

  const items = await buildItemSummaries(orderItems, supabase)
  const found = items.find((item) => item.item_key === key) ?? null
  if (!found) return { success: false, data: null, error: "Item not found" }
  return { success: true, data: found, error: null }
}

export async function getItemsFilterOptions(): Promise<{
  customers: Array<{ id: string; name: string }>
  categories: string[]
}> {
  const listResult = await getItemsList({ page: 1, page_size: 5 })
  if (!listResult.success || !listResult.data) return { customers: [], categories: [] }
  return {
    customers: listResult.data.facets.customers.map((customer) => ({ id: customer.value, name: customer.label })),
    categories: listResult.data.facets.categories.map((category) => category.value),
  }
}
