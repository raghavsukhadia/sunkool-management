"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import {
  normalizeProductionStatus,
  producedQtyForLineItem,
  producedQtyForLineItemCompletedOnly,
} from "@/lib/production-quantity"

const QUEUE_VISIBLE_PRODUCTION_STATUSES = [
  "in_production",
  "in production",
  "In Progress",
  "in progress",
] as const

const KPI_PRODUCTION_STATUSES = [
  ...QUEUE_VISIBLE_PRODUCTION_STATUSES,
  "completed",
  "Completed",
] as const

type QueueRecordRow = {
  production_type: string
  selected_quantities: Record<string, number> | null
  status: string
  updated_at: string | null
  created_at: string | null
  production_number: string | null
}

function completedBatchLabelsForLine(
  records: Array<{
    production_type: string
    selected_quantities: Record<string, number> | null
    production_number: string | null
    status: string
  }>,
  itemId: string
): string[] {
  const labels = new Set<string>()
  for (const rec of records) {
    const normalizedStatus = normalizeProductionStatus(rec.status)
    if (normalizedStatus !== "completed") continue
    const pnum = (rec.production_number ?? "").trim()
    if (!pnum) continue
    const ptype = (rec.production_type || "full").toLowerCase()
    if (ptype === "full") {
      labels.add(pnum)
      continue
    }
    const sq = rec.selected_quantities?.[itemId]
    if (sq != null && Number(sq) > 0) labels.add(pnum)
  }
  return Array.from(labels).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  )
}

export type ProductionQueueRow = {
  orderId: string
  orderNumber: string
  orderDate: string | null
  customerName: string
  itemId: string
  inventoryItemId?: string
  itemName: string
  ordered: number
  /** Allocated on in-progress + completed batches (internal; batch-closure uses `remaining`). */
  produced: number
  /** Produced on completed batches only; equals Ordered − Remaining (until DONE). */
  producedCompleted: number
  /** Allocation balance: ordered − produced (in-progress + completed). Used for batch-closure detection. */
  remaining: number
  /** Units left until production is marked Done: ordered − produced on completed batches only (excludes in-progress allocation). */
  remainingUntilDone: number
  hasInProductionRecord: boolean
  hasCompletedRecord: boolean
  /** True when quantities are fully allocated on an open batch but the record is not marked completed yet (DONE on order). */
  needsBatchClosure?: boolean
  /** Active in-progress batch IDs (e.g. SK36A, SK36C) that include this line. */
  activeBatchLabels: string[]
  /** Number of distinct active batches referencing this line. */
  activeBatchCount: number
  /** Completed batch IDs that allocated this line (for display when no active batch). */
  completedBatchLabels: string[]
  /** True when a production record with "pending" status exists for this order but no in-production record. */
  hasRequestedRecord: boolean
}

export type JourneyProductionRecord = {
  id: string
  productionNumber: string
  productionType: string
  status: string
  createdAt: string
}

export type JourneyStockData = {
  currentStock: number
  demandInPeriod: number
  weeksOfStock: number | null
  status: "low" | "ok" | "excess" | "no_demand"
}

export type OrderJourneyData = {
  orderStatus: string | null
  paymentStatus: string | null
  createdAt: string | null
  productionRecords: JourneyProductionRecord[]
  stockData: JourneyStockData | null
}

export type ProductionQueueResult = {
  ordersInProductionCount: number
  rows: ProductionQueueRow[]
  totalUnitsRemaining: number
  kpiData: ProductionKpiData
}

/**
 * Fetches started production orders and returns a single-sheet item-wise view:
 * one row per order item with ordered/produced/remaining.
 * KPI data is computed inline from the same records — no extra DB round-trip.
 *
 * Pass `supabase` for server jobs without a user session (e.g. Vercel Cron) — use the service-role client.
 */
export async function getProductionQueue(options?: {
  supabase?: SupabaseClient
}): Promise<{ success: true; data: ProductionQueueResult } | { success: false; error: string }> {
  const supabase = options?.supabase ?? (await createClient())

  const EMPTY_KPI: ProductionKpiData = {
    pendingOrdersCount: 0,
    totalUnitsToProduce: 0,
    productionDelayedCount: 0,
    completedThisMonthCount: 0,
    noProductionOrdersCount: 0,
    pendingOrderIds: [],
    delayedOrderIds: [],
    completedThisMonthOrderIds: [],
    noProductionOrderIds: [],
  }

  // Fetch production records + all open orders in parallel (step 1).
  // "Open" = any status that still has outstanding production work (not Delivered/Void).
  const OPEN_ORDER_STATUSES = ["New Order", "In Progress", "Partial Delivered"] as const

  const [productionRecordsResult, newOrdersResult] = await Promise.all([
    supabase
      .from("production_records")
      .select("order_id, production_type, selected_quantities, status, updated_at, created_at, production_number")
      .in("status", [...QUEUE_VISIBLE_PRODUCTION_STATUSES]),
    supabase
      .from("orders")
      .select(`id, internal_order_number, sales_order_number, created_at, customers:customer_id ( name )`)
      .in("order_status", [...OPEN_ORDER_STATUSES])
      .order("internal_order_number", { ascending: true }),
  ])

  if (productionRecordsResult.error) return { success: false, error: productionRecordsResult.error.message }

  const allProductionRecords = productionRecordsResult.data || []
  const orderIds = Array.from(new Set(allProductionRecords.map((r) => r.order_id).filter(Boolean)))

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const { data: completedThisMonthRecords, error: completedMonthError } = await supabase
    .from("production_records")
    .select("order_id, updated_at, created_at")
    .in("status", ["completed", "Completed"])
    .gte("updated_at", monthStart.toISOString())

  if (completedMonthError) return { success: false, error: completedMonthError.message }

  const completedThisMonthOrderIdSet = new Set(
    (completedThisMonthRecords || []).map((r) => r.order_id).filter(Boolean) as string[]
  )

  // "New Order" orders with zero production records — the untouched backlog.
  const orderIdsWithProduction = new Set(orderIds)
  const noProductionOrders = (newOrdersResult.data || []).filter((o) => !orderIdsWithProduction.has(o.id))

  // Fetch in-production orders/items + no-production items in parallel (step 2).
  const fetchInProduction = orderIds.length > 0
    ? Promise.all([
        supabase
          .from("orders")
          .select(`id, internal_order_number, sales_order_number, created_at, customers:customer_id ( name )`)
          .in("id", orderIds)
          .order("internal_order_number", { ascending: true }),
        supabase
          .from("order_items")
          .select("id, order_id, quantity, inventory_item_id, product_id")
          .in("order_id", orderIds)
          .order("created_at", { ascending: true })
          .range(0, 9999),
      ])
    : Promise.resolve([{ data: [], error: null }, { data: [], error: null }] as const)

  const noProductionOrderIds_raw = noProductionOrders.map((o) => o.id)
  const fetchNoProductionItems = noProductionOrderIds_raw.length > 0
    ? supabase
        .from("order_items")
        .select("id, order_id, quantity, inventory_item_id, product_id")
        .in("order_id", noProductionOrderIds_raw)
        .order("created_at", { ascending: true })
        .range(0, 9999)
    : Promise.resolve({ data: [] as Array<{ id: string; order_id: string; quantity: number; inventory_item_id: string | null; product_id: string | null }>, error: null })

  // Fetch any existing production records (completed/pending) for no-active-production orders.
  // Needed for "Partial Delivered" orders that have prior completed batches — so remaining qty is correct.
  const fetchNoProductionRecords = noProductionOrderIds_raw.length > 0
    ? supabase
        .from("production_records")
        .select("order_id, production_type, selected_quantities, status, updated_at, created_at, production_number")
        .in("order_id", noProductionOrderIds_raw)
    : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null })

  const fetchTotalsForQueueOrders =
    orderIds.length > 0
      ? supabase
          .from("production_records")
          .select("order_id, production_type, selected_quantities, status, updated_at, created_at, production_number")
          .in("order_id", orderIds)
          .in("status", [...QUEUE_VISIBLE_PRODUCTION_STATUSES, "completed", "Completed"])
      : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null })

  const [[ordersResult, itemsResult], noProductionItemsResult, totalsResult, noProductionRecordsResult] = await Promise.all([
    fetchInProduction,
    fetchNoProductionItems,
    fetchTotalsForQueueOrders,
    fetchNoProductionRecords,
  ])

  if (ordersResult.error) return { success: false, error: ordersResult.error.message }
  if (itemsResult.error) return { success: false, error: itemsResult.error.message }
  if (totalsResult.error) return { success: false, error: totalsResult.error.message }

  const orders = ordersResult.data || []
  const orderItems = itemsResult.data || []
  const noProductionItems = noProductionItemsResult.data || []

  // Collect ALL item IDs (both in-production and no-production) for a single inventory lookup.
  const itemIds = new Set<string>()
  for (const item of [...orderItems, ...noProductionItems]) {
    if (item.inventory_item_id) itemIds.add(item.inventory_item_id)
    if (item.product_id) itemIds.add(item.product_id)
  }
  const invIds = Array.from(itemIds)

  const [{ data: inventoryItems }, { data: products }] = await Promise.all([
    invIds.length > 0
      ? supabase.from("inventory_items").select("id, item_name, parent_item_id").in("id", invIds)
      : Promise.resolve({ data: [] }),
    invIds.length > 0
      ? supabase.from("products").select("id, name").in("id", invIds)
      : Promise.resolve({ data: [] }),
  ])

  const nameById: Record<string, string> = {}
  for (const inv of inventoryItems || []) {
    nameById[inv.id] = inv.item_name || "Item"
  }
  for (const p of products || []) {
    nameById[p.id] = (p as { name?: string }).name || "Product"
  }

  const recordsByOrderId: Record<string, QueueRecordRow[]> = {}
  for (const rec of allProductionRecords || []) {
    if (!recordsByOrderId[rec.order_id]) {
      recordsByOrderId[rec.order_id] = []
    }
    recordsByOrderId[rec.order_id].push({
      production_type: rec.production_type || "full",
      selected_quantities: (rec.selected_quantities as Record<string, number> | null) || null,
      status: rec.status || "pending",
      updated_at: rec.updated_at || null,
      created_at: rec.created_at || null,
      production_number: (rec as { production_number?: string | null }).production_number ?? null,
    })
  }

  const recordsByOrderIdForTotals: Record<string, QueueRecordRow[]> = {}
  for (const rec of (totalsResult.data || []) as Array<{
    order_id: string
    production_type?: string | null
    selected_quantities?: Record<string, number> | null
    status?: string | null
    updated_at?: string | null
    created_at?: string | null
    production_number?: string | null
  }>) {
    if (!rec.order_id) continue
    if (!recordsByOrderIdForTotals[rec.order_id]) {
      recordsByOrderIdForTotals[rec.order_id] = []
    }
    recordsByOrderIdForTotals[rec.order_id].push({
      production_type: rec.production_type || "full",
      selected_quantities: rec.selected_quantities ?? null,
      status: rec.status || "pending",
      updated_at: rec.updated_at ?? null,
      created_at: rec.created_at ?? null,
      production_number: rec.production_number ?? null,
    })
  }

  function activeBatchLabelsForLine(
    records: Array<{
      production_type: string
      selected_quantities: Record<string, number> | null
      production_number: string | null
    }>,
    itemId: string
  ): string[] {
    const labels = new Set<string>()
    for (const rec of records) {
      const pnum = (rec.production_number ?? "").trim()
      if (!pnum) continue
      const ptype = (rec.production_type || "full").toLowerCase()
      if (ptype === "full") {
        labels.add(pnum)
      } else {
        const sq = rec.selected_quantities?.[itemId]
        if (sq != null && Number(sq) > 0) labels.add(pnum)
      }
    }
    return Array.from(labels).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
  }

  const orderMap = new Map(orders.map((o) => [o.id, o]))
  const noProductionOrderMap = new Map(noProductionOrders.map((o) => [o.id, o]))
  const rows: ProductionQueueRow[] = []

  // Build rows for in-production orders.
  for (const item of orderItems) {
    const order = orderMap.get(item.order_id)
    if (!order) continue

    const records = recordsByOrderId[item.order_id] || []
    const totalsRecords = recordsByOrderIdForTotals[item.order_id] || []
    const hasCompletedRecord = totalsRecords.some((r) => normalizeProductionStatus(r.status) === "completed")
    const produced = producedQtyForLineItem(totalsRecords, item.id, item.quantity)
    const ordered = item.quantity
    const remaining = Math.max(0, ordered - produced)
    const producedCompleted = producedQtyForLineItemCompletedOnly(totalsRecords, item.id, item.quantity)
    const remainingUntilDone = Math.max(0, ordered - producedCompleted)
    const itemName = nameById[item.inventory_item_id || ""] || nameById[item.product_id || ""] || "Product"
    const customerName = (order.customers as { name?: string } | null)?.name ?? "—"
    const activeBatchLabels = activeBatchLabelsForLine(records, item.id)
    const queueOrderNumber = order.internal_order_number || order.sales_order_number || item.order_id.slice(0, 8)
    const hasAllocatingInProductionRecord = records.some((r) => {
      const normalized = normalizeProductionStatus(r.status)
      if (normalized !== "in production" && normalized !== "in progress") return false
      const ptype = (r.production_type || "full").toLowerCase()
      if (ptype === "full") return true
      const sq = r.selected_quantities?.[item.id]
      return sq != null && Number(sq) > 0
    })
    const completedBatchLabels = completedBatchLabelsForLine(totalsRecords, item.id)

    rows.push({
      orderId: item.order_id,
      orderNumber: queueOrderNumber,
      orderDate: (order as { created_at?: string | null }).created_at ?? null,
      customerName,
      itemId: item.id,
      inventoryItemId: item.inventory_item_id || undefined,
      itemName,
      ordered,
      produced,
      producedCompleted,
      remaining,
      remainingUntilDone,
      hasInProductionRecord: hasAllocatingInProductionRecord,
      hasCompletedRecord,
      needsBatchClosure: remaining === 0 && hasAllocatingInProductionRecord,
      activeBatchLabels,
      activeBatchCount: activeBatchLabels.length,
      completedBatchLabels,
      hasRequestedRecord: false,
    })
  }

  // Build lookup for any prior production records on no-active-production orders (e.g. Partial Delivered).
  const recordsByOrderIdForNoProd: Record<string, QueueRecordRow[]> = {}
  for (const rec of (noProductionRecordsResult.data || []) as Array<{
    order_id: string
    production_type?: string | null
    selected_quantities?: Record<string, number> | null
    status?: string | null
    updated_at?: string | null
    created_at?: string | null
    production_number?: string | null
  }>) {
    if (!rec.order_id) continue
    if (!recordsByOrderIdForNoProd[rec.order_id]) recordsByOrderIdForNoProd[rec.order_id] = []
    recordsByOrderIdForNoProd[rec.order_id].push({
      production_type: rec.production_type || "full",
      selected_quantities: rec.selected_quantities ?? null,
      status: rec.status || "pending",
      updated_at: rec.updated_at ?? null,
      created_at: rec.created_at ?? null,
      production_number: rec.production_number ?? null,
    })
  }

  // Build rows for open orders with no active in_production record (New Order, Partial Delivered, etc.).
  for (const item of noProductionItems) {
    const order = noProductionOrderMap.get(item.order_id)
    if (!order) continue
    const itemName = nameById[item.inventory_item_id || ""] || nameById[item.product_id || ""] || "Product"
    const customerName = (order.customers as { name?: string } | null)?.name ?? "—"
    const priorRecords = recordsByOrderIdForNoProd[item.order_id] || []
    const producedCompleted = producedQtyForLineItemCompletedOnly(priorRecords, item.id, item.quantity)
    const produced = producedQtyForLineItem(priorRecords, item.id, item.quantity)
    const remaining = Math.max(0, item.quantity - produced)
    const remainingUntilDone = Math.max(0, item.quantity - producedCompleted)
    const hasCompletedRecord = priorRecords.some((r) => normalizeProductionStatus(r.status) === "completed")
    const completedBatchLabelsForItem = completedBatchLabelsForLine(priorRecords, item.id)
    // An order has a "Requested Production" record when a pending production record exists
    // but no in-production record — meaning production was requested but hasn't started yet.
    const hasRequestedRecord = priorRecords.some(
      (r) => normalizeProductionStatus(r.status) === "pending"
    )

    rows.push({
      orderId: item.order_id,
      orderNumber: order.internal_order_number || order.sales_order_number || item.order_id.slice(0, 8),
      orderDate: (order as { created_at?: string | null }).created_at ?? null,
      customerName,
      itemId: item.id,
      inventoryItemId: item.inventory_item_id || undefined,
      itemName,
      ordered: item.quantity,
      produced,
      producedCompleted,
      remaining,
      remainingUntilDone,
      hasInProductionRecord: false,
      hasCompletedRecord,
      needsBatchClosure: false,
      activeBatchLabels: [],
      activeBatchCount: 0,
      completedBatchLabels: completedBatchLabelsForItem,
      hasRequestedRecord,
    })
  }

  // Total units = every open order line with remaining work, including new/partial orders.
  const noProductionOrderIdsSet_raw = new Set(noProductionOrderIds_raw)
  const totalUnitsRemaining = rows.reduce((sum, r) => sum + r.remainingUntilDone, 0)

  // Compute KPI data inline (now/monthStart already set above; completed month uses separate query).
  const delayedThreshold = new Date(now)
  delayedThreshold.setDate(delayedThreshold.getDate() - 5)

  type OrderAgg = {
    hasStarted: boolean
    hasCompleted: boolean
    lastActivityAt: Date | null
  }
  const aggByOrder: Record<string, OrderAgg> = {}
  for (const orderId of orderIds) {
    aggByOrder[orderId] = { hasStarted: false, hasCompleted: false, lastActivityAt: null }
  }
  for (const orderId of orderIds) {
    for (const rec of recordsByOrderIdForTotals[orderId] || []) {
      const agg = aggByOrder[orderId]
      if (!agg) continue
      const normalized = normalizeProductionStatus(rec.status)
      const isCompleted = normalized === "completed"
      const isStarted = normalized === "in production" || normalized === "in progress" || isCompleted
      if (isStarted) agg.hasStarted = true
      if (isCompleted) agg.hasCompleted = true
      const activity = new Date(rec.updated_at || rec.created_at || now.toISOString())
      if (!agg.lastActivityAt || activity > agg.lastActivityAt) agg.lastActivityAt = activity
    }
  }

  // Only include in-production order IDs that have queue rows — KPI counts must match what filter shows.
  const queueOrderIds = Array.from(new Set(orderItems.map((i) => i.order_id).filter((id) => orderMap.has(id))))
  const noProductionQueueOrderIds = Array.from(new Set(noProductionItems.map((i) => i.order_id).filter((id) => noProductionOrderMap.has(id))))

  // "Partial re-pending" = orders in noProductionOrders that have at least one completed production
  // batch but no active in_production record. This happens when a production record is deleted after
  // partial dispatch (e.g. customer edits quantity) — the order loses its active record and falls into
  // noProductionOrders, but it had prior production so it's NOT "not started".
  const partialRePendingOrderIds = noProductionQueueOrderIds.filter((orderId) =>
    rows.some((row) => row.orderId === orderId && row.hasCompletedRecord && row.remainingUntilDone > 0)
  )

  // "Truly not started" = no prior completed records at all. These are the real "Not Started" orders.
  const trulyNotStartedOrderIds = noProductionQueueOrderIds.filter(
    (orderId) => !partialRePendingOrderIds.includes(orderId)
  )

  // "Pending" = in-production orders with either:
  // - remaining units to produce, OR
  // - lines awaiting batch closure (0 remaining until DONE on order).
  // Also includes partial-re-pending orders (had completed batches, deleted record, still has remaining).
  // This keeps the Pending KPI aligned with both queue work and closure work.
  const pendingOrderIds = [
    ...queueOrderIds.filter((orderId) =>
      rows.some(
        (row) =>
          row.orderId === orderId &&
          !noProductionOrderIdsSet_raw.has(row.orderId) &&
          (row.remainingUntilDone > 0 || !!row.needsBatchClosure)
      )
    ),
    ...partialRePendingOrderIds,
  ]
  // Delayed: in-production orders with no activity for 5+ days and still not completed.
  const delayedInProductionIds = queueOrderIds.filter((id) => {
    const a = aggByOrder[id]
    return a?.hasStarted && !a?.hasCompleted && !!a?.lastActivityAt && a.lastActivityAt < delayedThreshold
  })

  // Delayed: no-active-production orders (new / partial delivered) idle for 5+ days with remaining work.
  // Use last production record activity if any exists, otherwise fall back to order creation date.
  const delayedNoProductionIds = noProductionQueueOrderIds.filter((id) => {
    const hasRemaining = rows.some((r) => r.orderId === id && r.remainingUntilDone > 0)
    if (!hasRemaining) return false

    const priorRecs = recordsByOrderIdForNoProd[id] || []
    let lastActivity: Date | null = null
    for (const rec of priorRecs) {
      const d = new Date(rec.updated_at || rec.created_at || now.toISOString())
      if (!lastActivity || d > lastActivity) lastActivity = d
    }

    if (!lastActivity) {
      // No prior production at all — use order creation date
      const order = noProductionOrderMap.get(id)
      const createdAt = (order as { created_at?: string | null })?.created_at
      if (!createdAt) return false
      lastActivity = new Date(createdAt)
    }

    return lastActivity < delayedThreshold
  })

  const delayedOrderIds = [...delayedInProductionIds, ...delayedNoProductionIds]
  const kpiData: ProductionKpiData = {
    pendingOrdersCount: pendingOrderIds.length,
    totalUnitsToProduce: totalUnitsRemaining,
    productionDelayedCount: delayedOrderIds.length,
    completedThisMonthCount: completedThisMonthOrderIdSet.size,
    noProductionOrdersCount: trulyNotStartedOrderIds.length,
    pendingOrderIds,
    delayedOrderIds,
    completedThisMonthOrderIds: Array.from(completedThisMonthOrderIdSet),
    noProductionOrderIds: trulyNotStartedOrderIds,
  }

  return {
    success: true,
    data: { ordersInProductionCount: orders.length, rows, totalUnitsRemaining, kpiData },
  }
}

/**
 * Fetch order-level journey context and optional inventory impact for a selected queue row.
 */
export async function getOrderJourneyData(
  orderId: string,
  inventoryItemId?: string
): Promise<{ success: true; data: OrderJourneyData } | { success: false; error: string }> {
  const supabase = await createClient()

  try {
    const [{ data: order, error: orderError }, { data: records, error: recordsError }] = await Promise.all([
      supabase
        .from("orders")
        .select("order_status, payment_status, created_at")
        .eq("id", orderId)
        .single(),
      supabase
        .from("production_records")
        .select("id, production_number, production_type, status, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true }),
    ])

    if (orderError) return { success: false, error: orderError.message }
    if (recordsError) return { success: false, error: recordsError.message }

    let stockData: JourneyStockData | null = null

    if (inventoryItemId) {
      const days = 30
      const since = new Date()
      since.setDate(since.getDate() - days)
      const sinceStr = since.toISOString().slice(0, 10)

      const [
        { data: masterRolls },
        { data: convertable },
        { data: rfd },
        { data: cutAndRoll },
        { data: dispatchItems },
        { data: dispatches },
      ] = await Promise.all([
        supabase
          .from("master_rolls")
          .select("inventory_item_id, quantity")
          .eq("inventory_item_id", inventoryItemId),
        supabase
          .from("convertable_stock")
          .select("inventory_item_id, front, five_str, seven_str, balance")
          .eq("inventory_item_id", inventoryItemId),
        supabase
          .from("ready_for_dispatch")
          .select("inventory_item_id, in_hand")
          .eq("inventory_item_id", inventoryItemId),
        supabase
          .from("cut_and_roll")
          .select("inventory_item_id, in_hand")
          .eq("inventory_item_id", inventoryItemId),
        supabase
          .from("dispatch_items")
          .select("inventory_item_id, quantity, dispatch_id")
          .eq("inventory_item_id", inventoryItemId),
        supabase
          .from("dispatches")
          .select("id, dispatch_date")
          .gte("dispatch_date", sinceStr)
          .neq("dispatch_type", "return"),
      ])

      const dispatchIdsInPeriod = new Set((dispatches ?? []).map((d) => d.id))
      let demandInPeriod = 0
      for (const di of dispatchItems ?? []) {
        if (!dispatchIdsInPeriod.has(di.dispatch_id)) continue
        demandInPeriod += Number(di.quantity ?? 0)
      }

      let currentStock = 0
      for (const row of masterRolls ?? []) {
        currentStock += Number(row.quantity ?? 0)
      }
      for (const row of convertable ?? []) {
        currentStock +=
          Number(row.front ?? 0) +
          Number(row.five_str ?? 0) +
          Number(row.seven_str ?? 0) +
          Number(row.balance ?? 0)
      }
      for (const row of rfd ?? []) {
        currentStock += Number(row.in_hand ?? 0)
      }
      for (const row of cutAndRoll ?? []) {
        currentStock += Number(row.in_hand ?? 0)
      }

      const LOW_WEEKS_THRESHOLD = 2
      const EXCESS_STOCK_MIN = 10
      const weeksPerDay = 7 / days
      let weeksOfStock: number | null = null
      let status: JourneyStockData["status"] = "no_demand"

      if (demandInPeriod > 0) {
        weeksOfStock = currentStock / (demandInPeriod * weeksPerDay)
        status = weeksOfStock < LOW_WEEKS_THRESHOLD ? "low" : "ok"
      } else {
        if (currentStock >= EXCESS_STOCK_MIN) status = "excess"
        else if (currentStock > 0) status = "ok"
      }

      stockData = {
        currentStock: Math.round(currentStock * 100) / 100,
        demandInPeriod,
        weeksOfStock: weeksOfStock != null ? Math.round(weeksOfStock * 10) / 10 : null,
        status,
      }
    }

    const productionRecords: JourneyProductionRecord[] = (records ?? []).map((record) => ({
      id: record.id,
      productionNumber: record.production_number || "—",
      productionType: record.production_type || "full",
      status: record.status || "pending",
      createdAt: record.created_at,
    }))

    return {
      success: true,
      data: {
        orderStatus: order?.order_status ?? null,
        paymentStatus: order?.payment_status ?? null,
        createdAt: order?.created_at ?? null,
        productionRecords,
        stockData,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch order journey data"
    return { success: false, error: message }
  }
}

/**
 * Fetch order items for Production page, start-gated by production status.
 */
export async function getProductionItems(): Promise<
  { success: true; data: unknown[] } | { success: false; error: string }
> {
  const supabase = await createClient()

  // Start-gated: pending-only records should not appear in Production tab.
  const { data: activeRecords, error: activeRecordsError } = await supabase
    .from("production_records")
    .select("order_id")
    .in("status", [...QUEUE_VISIBLE_PRODUCTION_STATUSES])

  if (activeRecordsError) return { success: false, error: activeRecordsError.message }

  const orderIds = Array.from(new Set((activeRecords || []).map((r) => r.order_id).filter(Boolean)))
  if (orderIds.length === 0) {
    return { success: true, data: [] }
  }

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select(
      `
      *,
      orders!inner (
        internal_order_number,
        sales_order_number,
        order_status,
        customers (name)
      ),
      inventory_items (
        name,
        serial_number
      )
    `
    )
    .in("order_id", orderIds)
    .order("created_at", { ascending: true })
    .range(0, 5000)

  if (itemsError) return { success: false, error: itemsError.message }
  return { success: true, data: items ?? [] }
}

/**
 * Fetch recent production records for production page (limit 20).
 */
export async function getProductionRecordsList(): Promise<
  { success: true; data: unknown[] } | { success: false; error: string }
> {
  const supabase = await createClient()
  const { data: records, error } = await supabase
    .from("production_records")
    .select("id, status, created_at")
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) return { success: false, error: error.message }
  return { success: true, data: records ?? [] }
}

export type ProductionSnapshot = {
  ordersInProduction: number
  unitsRemaining: number
  completedToday: number
  onTimeDeliveryRate: number
  lastUpdated: string
}

export type ProductionKpiData = {
  pendingOrdersCount: number
  totalUnitsToProduce: number
  productionDelayedCount: number
  completedThisMonthCount: number
  noProductionOrdersCount: number
  pendingOrderIds: string[]
  delayedOrderIds: string[]
  completedThisMonthOrderIds: string[]
  noProductionOrderIds: string[]
}

export async function getProductionKpis(
  params?: { orderIds?: string[]; totalUnitsToProduce?: number }
): Promise<
  { success: true; data: ProductionKpiData } | { success: false; error: string }
> {
  const supabase = await createClient()
  const orderIds = Array.from(new Set(params?.orderIds ?? []))
  const totalUnitsToProduce = params?.totalUnitsToProduce ?? 0

  if (orderIds.length === 0) {
    return {
      success: true,
      data: {
        pendingOrdersCount: 0,
        totalUnitsToProduce: 0,
        productionDelayedCount: 0,
        completedThisMonthCount: 0,
        noProductionOrdersCount: 0,
        pendingOrderIds: [],
        delayedOrderIds: [],
        completedThisMonthOrderIds: [],
        noProductionOrderIds: [],
      },
    }
  }

  const { data: records, error } = await supabase
    .from("production_records")
    .select("order_id, status, updated_at, created_at")
    .in("order_id", orderIds)
    .in("status", [...KPI_PRODUCTION_STATUSES])

  if (error) return { success: false, error: error.message }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const delayedThreshold = new Date(now)
  delayedThreshold.setDate(delayedThreshold.getDate() - 5)

  type OrderAgg = {
    hasStarted: boolean
    hasCompleted: boolean
    lastActivityAt: Date | null
    hasCompletedThisMonth: boolean
  }
  const aggByOrder: Record<string, OrderAgg> = {}
  for (const orderId of orderIds) {
    aggByOrder[orderId] = {
      hasStarted: false,
      hasCompleted: false,
      lastActivityAt: null,
      hasCompletedThisMonth: false,
    }
  }

  for (const rec of records || []) {
    const agg = aggByOrder[rec.order_id]
    if (!agg) continue
    const normalized = normalizeProductionStatus(rec.status)
    const isCompleted = normalized === "completed"
    const isStarted = normalized === "in production" || normalized === "in progress" || isCompleted
    if (isStarted) agg.hasStarted = true
    if (isCompleted) agg.hasCompleted = true

    const activity = new Date(rec.updated_at || rec.created_at || now.toISOString())
    if (!agg.lastActivityAt || activity > agg.lastActivityAt) {
      agg.lastActivityAt = activity
    }
    if (isCompleted && activity >= monthStart) {
      agg.hasCompletedThisMonth = true
    }
  }

  const pendingOrderIds = orderIds.filter((id) => {
    const agg = aggByOrder[id]
    return agg.hasStarted && !agg.hasCompleted
  })
  const delayedOrderIds = orderIds.filter((id) => {
    const agg = aggByOrder[id]
    if (!agg.hasStarted || agg.hasCompleted || !agg.lastActivityAt) return false
    return agg.lastActivityAt < delayedThreshold
  })
  const completedThisMonthOrderIds = orderIds.filter((id) => aggByOrder[id].hasCompletedThisMonth)

  return {
    success: true,
    data: {
      pendingOrdersCount: pendingOrderIds.length,
      totalUnitsToProduce,
      productionDelayedCount: delayedOrderIds.length,
      completedThisMonthCount: completedThisMonthOrderIds.length,
      noProductionOrdersCount: 0,
      pendingOrderIds,
      delayedOrderIds,
      completedThisMonthOrderIds,
      noProductionOrderIds: [],
    },
  }
}

export async function getProductionSnapshot(): Promise<
  { success: true; data: ProductionSnapshot } | { success: false; error: string }
> {
  const supabase = await createClient()

  try {
    // Get orders in production
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id")
      .in("order_status", ["In Progress", "New Order", "Partial Delivered"])

    if (ordersError) throw ordersError

    const orderIds = (orders || []).map((o) => o.id)

    // Get units remaining
    let unitsRemaining = 0
    if (orderIds.length > 0) {
      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("id, order_id, quantity")
        .in("order_id", orderIds)

      if (itemsError) throw itemsError

      const { data: productionRecords, error: recsError } = await supabase
        .from("production_records")
        .select("order_id, production_type, selected_quantities, status")
        .in("order_id", orderIds)
        .in("status", ["in_production", "completed"])

      if (recsError) throw recsError

      const producedByItem: Record<string, number> = {}
      for (const rec of productionRecords || []) {
        for (const item of orderItems || []) {
          if (item.order_id === rec.order_id) {
            if (rec.production_type === "full") {
              producedByItem[item.id] = (producedByItem[item.id] || 0) + item.quantity
            } else if (rec.selected_quantities && rec.selected_quantities[item.id]) {
              producedByItem[item.id] = (producedByItem[item.id] || 0) + (rec.selected_quantities[item.id] as number)
            }
          }
        }
      }

      for (const item of orderItems || []) {
        const produced = producedByItem[item.id] || 0
        unitsRemaining += Math.max(0, item.quantity - produced)
      }
    }

    // Get completed records today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString()

    const { data: completedToday, error: completedError } = await supabase
      .from("production_records")
      .select("id")
      .eq("status", "completed")
      .gte("updated_at", todayStr)

    if (completedError) throw completedError

    // Get dispatches for on-time calculation (target: 95%)
    const { data: dispatches, error: dispatchError } = await supabase
      .from("dispatches")
      .select("shipment_status")
      .in("order_id", orderIds)
      .neq("dispatch_type", "return")

    if (dispatchError) throw dispatchError

    const deliveredCount = (dispatches || []).filter((d) => d.shipment_status === "delivered").length
    const onTimeDeliveryRate =
      dispatches && dispatches.length > 0 ? Math.round((deliveredCount / dispatches.length) * 100) : 95

    return {
      success: true,
      data: {
        ordersInProduction: orders?.length || 0,
        unitsRemaining,
        completedToday: completedToday?.length || 0,
        onTimeDeliveryRate,
        lastUpdated: new Date().toISOString(),
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch production snapshot"
    return { success: false, error: message }
  }
}
