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

export async function getAllItems(): Promise<{
  success: boolean
  data: ItemSummary[] | null
  stats: ItemsStats | null
  error: string | null
}> {
  const supabase = await createClient()

  // 1. Fetch all order_items with order + customer
  const { data: orderItems, error: oiError } = await supabase
    .from("order_items")
    .select(`
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
    `)
    .order("created_at", { ascending: false })

  if (oiError) {
    return { success: false, data: null, stats: null, error: oiError.message }
  }

  if (!orderItems || orderItems.length === 0) {
    return {
      success: true,
      data: [],
      stats: { unique_items: 0, total_orders: 0, total_quantity: 0, total_value: 0, fully_dispatched_items: 0, pending_items: 0 },
      error: null,
    }
  }

  // 2. Resolve item names (inventory_items + products)
  const invIds = [...new Set(orderItems.filter(oi => oi.inventory_item_id).map(oi => oi.inventory_item_id as string))]
  const prodIds = [...new Set(orderItems.filter(oi => oi.product_id && !oi.inventory_item_id).map(oi => oi.product_id as string))]

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

  // Fetch any parent inventory items needed for display names
  const parentIds = [...new Set(
    [...invMap.values()].filter(v => v.parent_item_id && !invMap.has(v.parent_item_id)).map(v => v.parent_item_id as string)
  )]
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

  // 3. Fetch dispatch data for all order_item ids
  const orderItemIds = orderItems.map(oi => oi.id)
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

  type DAgg = { dispatched: number; returned: number; latestDate: string | null; latestTracking: string | null; latestCourier: string | null }
  const dAgg = new Map<string, DAgg>()
  for (const di of dispatchRows || []) {
    const oid = di.order_item_id as string
    if (!dAgg.has(oid)) dAgg.set(oid, { dispatched: 0, returned: 0, latestDate: null, latestTracking: null, latestCourier: null })
    const agg = dAgg.get(oid)!
    const d = di.dispatches as any
    const qty = Number(di.quantity || 0)
    if (d?.dispatch_type === "return") {
      agg.returned += qty
    } else {
      agg.dispatched += qty
      const dd = d?.dispatch_date ?? null
      if (dd && (!agg.latestDate || dd > agg.latestDate)) {
        agg.latestDate = dd
        agg.latestTracking = d?.tracking_number ?? null
        agg.latestCourier = (d?.courier_companies as any)?.name ?? null
      }
    }
  }

  // 4. Group order_items by their item key (inventory_item_id or product_id)
  const grouped = new Map<string, {
    resolved: { name: string; sku: string | null; category: string | null }
    entries: ItemOrderEntry[]
  }>()

  for (const oi of orderItems) {
    const key = oi.inventory_item_id ?? oi.product_id ?? oi.id
    const resolved = resolveItem(oi.inventory_item_id, oi.product_id)
    const order = oi.orders as any
    const customer = order?.customers as any
    const agg = dAgg.get(oi.id) ?? { dispatched: 0, returned: 0, latestDate: null, latestTracking: null, latestCourier: null }
    const netDispatched = Math.max(0, agg.dispatched - agg.returned)
    const remaining = Math.max(0, Number(oi.quantity) - netDispatched)
    let dispatch_status: DispatchStatus = "not_dispatched"
    if (netDispatched > 0 && remaining > 0) dispatch_status = "partial"
    else if (netDispatched > 0 && remaining === 0) dispatch_status = "fully_dispatched"

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
      qty_returned: agg.returned,
      qty_remaining: remaining,
      dispatch_status,
      latest_dispatch_date: agg.latestDate,
      latest_tracking_number: agg.latestTracking,
      latest_courier_name: agg.latestCourier,
    }

    if (!grouped.has(key)) grouped.set(key, { resolved, entries: [] })
    grouped.get(key)!.entries.push(entry)
  }

  // 5. Build ItemSummary array
  const items: ItemSummary[] = []
  for (const [key, { resolved, entries }] of grouped) {
    const totalQty = entries.reduce((s, e) => s + e.quantity, 0)
    const totalValue = entries.reduce((s, e) => s + e.subtotal, 0)
    const totalDispatched = entries.reduce((s, e) => s + e.qty_net_dispatched, 0)
    const totalRemaining = entries.reduce((s, e) => s + e.qty_remaining, 0)
    const uniqueCustomers = new Set(entries.map(e => e.customer_id).filter(Boolean)).size
    const lastOrdered = entries.reduce((latest: string | null, e) => {
      if (!latest || e.order_created_at > latest) return e.order_created_at
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

  // Sort by most recently ordered first
  items.sort((a, b) => {
    if (!a.last_ordered_at) return 1
    if (!b.last_ordered_at) return -1
    return b.last_ordered_at.localeCompare(a.last_ordered_at)
  })

  const stats: ItemsStats = {
    unique_items: items.length,
    total_orders: orderItems.length,
    total_quantity: items.reduce((s, i) => s + i.total_quantity, 0),
    total_value: items.reduce((s, i) => s + i.total_value, 0),
    fully_dispatched_items: items.filter(i => i.total_remaining === 0 && i.total_dispatched > 0).length,
    pending_items: items.filter(i => i.total_remaining > 0).length,
  }

  return { success: true, data: items, stats, error: null }
}

export async function getItemByKey(key: string): Promise<{
  success: boolean
  data: ItemSummary | null
  error: string | null
}> {
  const result = await getAllItems()
  if (!result.success) return { success: false, data: null, error: result.error }
  const found = (result.data ?? []).find(i => i.item_key === key) ?? null
  if (!found) return { success: false, data: null, error: "Item not found" }
  return { success: true, data: found, error: null }
}

export async function getItemsFilterOptions(): Promise<{
  customers: Array<{ id: string; name: string }>
  categories: string[]
}> {
  const supabase = await createClient()

  const [custResult, catResult] = await Promise.all([
    supabase.from("customers").select("id, name").eq("is_active", true).order("name"),
    supabase.from("products").select("category").eq("is_active", true).not("category", "is", null),
  ])

  const categories = [...new Set((catResult.data || []).map((p: any) => p.category).filter(Boolean))].sort() as string[]

  return {
    customers: custResult.data || [],
    categories,
  }
}
