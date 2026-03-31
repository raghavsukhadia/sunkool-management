"use server"

import { createClient } from "@/lib/supabase/server"

export type ProductionQueueRow = {
  orderId: string
  orderNumber: string
  customerName: string
  itemId: string
  inventoryItemId?: string
  itemName: string
  ordered: number
  produced: number
  remaining: number
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
}

/**
 * Fetches orders in production (Approved or In Production) and returns
 * a single-sheet item-wise view: one row per order item with ordered/produced/remaining.
 */
export async function getProductionQueue(): Promise<
  { success: true; data: ProductionQueueResult } | { success: false; error: string }
> {
  const supabase = await createClient()

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(`
      id,
      internal_order_number,
      sales_order_number,
      customers:customer_id ( name )
    `)
    .in("order_status", ["In Progress", "New Order", "Partial Delivered"])
    .order("internal_order_number", { ascending: true })

  if (ordersError) {
    return { success: false, error: ordersError.message }
  }

  if (!orders || orders.length === 0) {
    return {
      success: true,
      data: {
        ordersInProductionCount: 0,
        rows: [],
        totalUnitsRemaining: 0,
      },
    }
  }

  const orderIds = orders.map((o) => o.id)

  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .select("id, order_id, quantity, inventory_item_id, product_id")
    .in("order_id", orderIds)
    .order("created_at", { ascending: true })

  if (itemsError) {
    return { success: false, error: itemsError.message }
  }

  const { data: productionRecords, error: recsError } = await supabase
    .from("production_records")
    .select("order_id, production_type, selected_quantities")
    .in("order_id", orderIds)

  if (recsError) {
    return { success: false, error: recsError.message }
  }

  const itemIds = new Set<string>()
  for (const item of orderItems || []) {
    if (item.inventory_item_id) itemIds.add(item.inventory_item_id)
    if (item.product_id) itemIds.add(item.product_id)
  }
  const invIds = Array.from(itemIds)

  const { data: inventoryItems } = await supabase
    .from("inventory_items")
    .select("id, item_name, parent_item_id")
    .in("id", invIds)

  const { data: products } = await supabase
    .from("products")
    .select("id, name")
    .in("id", invIds)

  const nameById: Record<string, string> = {}
  for (const inv of inventoryItems || []) {
    nameById[inv.id] = inv.item_name || "Item"
  }
  for (const p of products || []) {
    nameById[p.id] = (p as { name?: string }).name || "Product"
  }

  const recordsByOrderId: Record<string, Array<{ production_type: string; selected_quantities: Record<string, number> | null }>> = {}
  for (const rec of productionRecords || []) {
    if (!recordsByOrderId[rec.order_id]) {
      recordsByOrderId[rec.order_id] = []
    }
    recordsByOrderId[rec.order_id].push({
      production_type: rec.production_type || "full",
      selected_quantities: (rec.selected_quantities as Record<string, number> | null) || null,
    })
  }

  const orderMap = new Map(orders.map((o) => [o.id, o]))
  const rows: ProductionQueueRow[] = []

  for (const item of orderItems || []) {
    const order = orderMap.get(item.order_id)
    if (!order) continue

    const records = recordsByOrderId[item.order_id] || []
    let produced = 0
    for (const rec of records) {
      if (rec.production_type === "full") {
        produced += item.quantity
      } else if (rec.selected_quantities && rec.selected_quantities[item.id] != null) {
        produced += Number(rec.selected_quantities[item.id]) || 0
      }
    }
    const ordered = item.quantity
    const remaining = Math.max(0, ordered - produced)

    const itemName =
      nameById[item.inventory_item_id || ""] ||
      nameById[item.product_id || ""] ||
      "Product"

    const customerName = (order.customers as { name?: string } | null)?.name ?? "—"

    rows.push({
      orderId: item.order_id,
      orderNumber: order.internal_order_number || order.sales_order_number || item.order_id.slice(0, 8),
      customerName,
      itemId: item.id,
      inventoryItemId: item.inventory_item_id || undefined,
      itemName,
      ordered,
      produced,
      remaining,
    })
  }

  const totalUnitsRemaining = rows.reduce((sum, r) => sum + r.remaining, 0)

  return {
    success: true,
    data: {
      ordersInProductionCount: orders.length,
      rows,
      totalUnitsRemaining,
    },
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
 * Fetch order items for production page (Approved / Partial Dispatch) with order and inventory info.
 */
export async function getProductionItems(): Promise<
  { success: true; data: unknown[] } | { success: false; error: string }
> {
  const supabase = await createClient()
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
    .in("orders.order_status", ["New Order", "In Progress", "Ready for Dispatch", "Partial Delivered"])
    .order("created_at", { ascending: true })

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
    .select(
      `
      *,
      dispatches (
        order_id,
        orders (internal_order_number)
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) return { success: false, error: error.message }
  return { success: true, data: records ?? [] }
}
