import type { DispatchStatus, ItemOrderEntry } from "@/app/actions/items"

export type OrderSummaryStatus = "all" | "pending" | "confirmed" | "dispatched" | "delivered" | "cancelled"
export type PaymentBreakdownKey = "paid" | "partial" | "unpaid" | "refunded"
export type StockState = "in_stock" | "low_stock" | "out_of_stock"

export interface QuantityMetrics {
  qty_total: number
  qty_reserved: number
  qty_dispatched: number
  qty_damaged: number
  qty_available: number
}

function clamp(value: number) {
  return Math.max(0, value)
}

export function getNetDispatched(orders: ItemOrderEntry[]) {
  return orders.reduce((sum, order) => sum + clamp(order.qty_net_dispatched), 0)
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

export function getPaymentBucket(status: string): PaymentBreakdownKey {
  if (status === "Paid") return "paid"
  if (status === "Partial") return "partial"
  if (status === "Refunded") return "refunded"
  return "unpaid"
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
