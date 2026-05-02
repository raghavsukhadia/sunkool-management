import type { DispatchStatus, ItemOrderEntry } from "@/app/actions/items"

export type OrderSummaryStatus = "all" | "pending" | "confirmed" | "dispatched" | "delivered" | "cancelled"
export type StockState = "in_stock" | "low_stock" | "out_of_stock"

export interface QuantityMetrics {
  qty_total: number
  qty_reserved: number
  qty_dispatched: number
  qty_damaged: number
  qty_available: number
}

/** Order-line quantity split for the item detail dashboard (partition of all line quantities). */
export interface OrderQuantityDashboard {
  totalOrdered: number
  notDelivered: number
  delivered: number
  cancelled: number
}

function clamp(value: number) {
  return Math.max(0, value)
}

export function getNetDispatched(orders: ItemOrderEntry[]) {
  return orders.reduce((sum, order) => sum + clamp(order.qty_net_dispatched), 0)
}

/**
 * Sums line `quantity` across all order lines (same as item aggregate when all lines are loaded).
 * Splits: not delivered = qty on lines still pending / confirmed / in dispatch (not delivered, not cancelled);
 * delivered = full line qty where order is delivered; cancelled = full line qty where cancelled/void.
 */
export function getOrderQuantityDashboard(orders: ItemOrderEntry[]): OrderQuantityDashboard {
  let totalOrdered = 0
  let notDelivered = 0
  let delivered = 0
  let cancelled = 0
  for (const order of orders) {
    const q = clamp(order.quantity)
    totalOrdered += q
    const status = getOrderSummaryStatus(order)
    if (status === "cancelled") cancelled += q
    else if (status === "delivered") delivered += q
    else notDelivered += q
  }
  return { totalOrdered, notDelivered, delivered, cancelled }
}

export function getPendingQuantity(orders: ItemOrderEntry[]) {
  return orders.reduce((sum, order) => {
    const status = getOrderSummaryStatus(order)
    if (status === "delivered" || status === "cancelled") return sum
    return sum + clamp(order.quantity)
  }, 0)
}

export function getInShipmentQuantity(orders: ItemOrderEntry[]) {
  return orders.reduce((sum, order) => {
    if (getOrderSummaryStatus(order) !== "dispatched") return sum
    return sum + clamp(order.qty_net_dispatched)
  }, 0)
}

export function getProductionQuantity(orders: ItemOrderEntry[]) {
  return orders.reduce((sum, order) => {
    const status = getOrderSummaryStatus(order)
    if (status === "delivered" || status === "cancelled" || status === "dispatched") return sum
    return sum + clamp(order.qty_remaining)
  }, 0)
}

export function getReservedQuantity(orders: ItemOrderEntry[]) {
  return orders.reduce((sum, order) => {
    if (order.dispatch_status === "fully_dispatched") return sum
    return sum + clamp(order.qty_remaining)
  }, 0)
}

export function computeQuantityMetrics(input: {
  qtyTotal: number
  qtyReserved: number
  qtyDispatched: number
  qtyDamaged?: number
}): QuantityMetrics {
  const qty_total = clamp(input.qtyTotal)
  const qty_reserved = clamp(input.qtyReserved)
  const qty_dispatched = clamp(input.qtyDispatched)
  const qty_damaged = clamp(input.qtyDamaged ?? 0)
  const qty_available = clamp(qty_total - qty_reserved - qty_dispatched - qty_damaged)

  return { qty_total, qty_reserved, qty_dispatched, qty_damaged, qty_available }
}

export function getStockState(metrics: QuantityMetrics): StockState {
  if (metrics.qty_available <= 0) return "out_of_stock"
  if (metrics.qty_total <= 0) return "out_of_stock"
  const ratio = metrics.qty_available / metrics.qty_total
  if (ratio < 0.2) return "low_stock"
  return "in_stock"
}

export function getOrderSummaryStatus(order: ItemOrderEntry): Exclude<OrderSummaryStatus, "all"> {
  const status = order.order_status.toLowerCase()
  if (status.includes("void") || status.includes("cancel")) return "cancelled"
  if (status.includes("delivered")) return "delivered"
  if (order.dispatch_status === "fully_dispatched") return "dispatched"
  if (order.payment_status === "Paid") return "confirmed"
  return "pending"
}

export type QuantityDashboardFilterKey = keyof OrderQuantityDashboard

/** Which order lines match a quantity-dashboard tile (same rules as getOrderQuantityDashboard buckets). */
export function orderMatchesQuantityDashboardFilter(
  order: ItemOrderEntry,
  filter: QuantityDashboardFilterKey
): boolean {
  if (filter === "totalOrdered") return true
  const s = getOrderSummaryStatus(order)
  if (filter === "notDelivered") return s === "pending" || s === "confirmed" || s === "dispatched"
  if (filter === "delivered") return s === "delivered"
  if (filter === "cancelled") return s === "cancelled"
  return true
}

export function applyDispatchOptimisticUpdate(
  orders: ItemOrderEntry[],
  payload: { orderItemId: string; qtyDispatched: number }
) {
  return orders.map((order) => {
    if (order.order_item_id !== payload.orderItemId) return order
    const qty_net_dispatched = clamp(order.qty_net_dispatched + payload.qtyDispatched)
    const qty_remaining = clamp(order.quantity - qty_net_dispatched)
    return {
      ...order,
      qty_net_dispatched,
      qty_remaining,
      dispatch_status: (qty_remaining === 0 ? "fully_dispatched" : "partial") as DispatchStatus,
    }
  })
}
