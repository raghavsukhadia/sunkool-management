"use client"

import { memo } from "react"
import { Button } from "@/components/ui/button"
import type { ItemOrderEntry } from "@/app/actions/items"

const PaymentBadge = ({ value }: { value: string }) => (
  <span className="rounded-full border border-sk-border px-2 py-0.5 text-[11px]">{value}</span>
)

const DispatchBadge = ({ value }: { value: ItemOrderEntry["dispatch_status"] }) => (
  <span className="rounded-full border border-sk-border px-2 py-0.5 text-[11px]">{value.replace("_", " ")}</span>
)

const OrdersTableRow = memo(function OrdersTableRow({
  order,
  loading,
  onDispatch,
  onView,
  onSelect,
}: {
  order: ItemOrderEntry
  loading: boolean
  onDispatch: (order: ItemOrderEntry) => void
  onView: (order: ItemOrderEntry) => void
  onSelect: (order: ItemOrderEntry) => void
}) {
  return (
    <tr className="border-b border-sk-border text-xs last:border-b-0">
      <td className="px-3 py-2 font-semibold text-sk-primary">
        <button type="button" onClick={() => onView(order)}>{order.internal_order_number ?? order.order_id.slice(0, 8)}</button>
      </td>
      <td className="px-3 py-2">{order.customer_name}</td>
      <td className="px-3 py-2">{new Date(order.order_created_at).toLocaleDateString("en-IN")}</td>
      <td className="px-3 py-2">{order.quantity}</td>
      <td className="px-3 py-2">Rs {order.unit_price}</td>
      <td className="px-3 py-2">Rs {order.subtotal}</td>
      <td className="px-3 py-2"><PaymentBadge value={order.payment_status} /></td>
      <td className="px-3 py-2"><DispatchBadge value={order.dispatch_status} /></td>
      <td className="px-3 py-2">
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-7 text-[11px]"
            disabled={loading || order.qty_remaining <= 0}
            onClick={() => onDispatch(order)}
          >
            {loading ? "Dispatching..." : "Mark Dispatched"}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onView(order)}>View Order</Button>
          <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => onSelect(order)}>Timeline</Button>
        </div>
      </td>
    </tr>
  )
})

export function OrdersTable({
  orders,
  loadingOrderItemId,
  onDispatch,
  onView,
  onSelect,
}: {
  orders: ItemOrderEntry[]
  loadingOrderItemId: string | null
  onDispatch: (order: ItemOrderEntry) => void
  onView: (order: ItemOrderEntry) => void
  onSelect: (order: ItemOrderEntry) => void
}) {
  return (
    <section className="rounded-xl border border-sk-border bg-white p-4">
      <h3 className="text-sm font-semibold text-sk-text-1">Orders</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[920px] w-full">
          <thead>
            <tr className="bg-sk-page-bg text-left text-[11px] uppercase text-sk-text-3">
              <th className="px-3 py-2">Order ID</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Order Date</th>
              <th className="px-3 py-2">Qty</th><th className="px-3 py-2">Unit Price</th><th className="px-3 py-2">Line Total</th>
              <th className="px-3 py-2">Payment</th><th className="px-3 py-2">Dispatch</th><th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <OrdersTableRow
                key={order.order_item_id}
                order={order}
                loading={loadingOrderItemId === order.order_item_id}
                onDispatch={onDispatch}
                onView={onView}
                onSelect={onSelect}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
