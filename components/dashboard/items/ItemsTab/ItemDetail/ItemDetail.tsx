"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { ItemOrderEntry } from "@/app/actions/items"
import { getOrderTimeline } from "@/app/actions/timeline"
import type { TimelineEntry } from "@/app/actions/timeline-types"
import { ItemHeader } from "./ItemHeader"
import { QuantityDashboard } from "./QuantityDashboard"
import { OrderSummaryChips } from "./OrderSummaryChips"
import { PaymentBreakdown } from "./PaymentBreakdown"
import { OrdersTable } from "./OrdersTable"
import { DispatchTimeline } from "./DispatchTimeline"
import { useItemQuantity } from "../hooks/useItemQuantity"
import { useDispatchMutation } from "../hooks/useDispatchMutation"
import { applyDispatchOptimisticUpdate, getOrderSummaryStatus, type OrderSummaryStatus } from "../utils/itemCalculations"
import type { ItemSummary } from "@/app/actions/items"

export function ItemDetail({
  item,
  setItem,
  reload,
}: {
  item: ItemSummary | null
  setItem: (value: ItemSummary | null | ((prev: ItemSummary | null) => ItemSummary | null)) => void
  reload: () => Promise<void>
}) {
  const router = useRouter()
  const quantity = useItemQuantity(item)
  const [chip, setChip] = useState<OrderSummaryStatus>("all")
  const [selectedOrder, setSelectedOrder] = useState<ItemOrderEntry | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<ItemSummary | null>(null)

  const { dispatchItem, loadingOrderItemId } = useDispatchMutation(
    async () => {
      await reload()
      setToast("Dispatch updated successfully")
      setTimeout(() => setToast(null), 2000)
    },
    () => {
      if (snapshot) setItem(snapshot)
      setToast("Dispatch update failed")
      setTimeout(() => setToast(null), 2000)
    }
  )

  const visibleOrders = useMemo(() => {
    if (!item) return []
    if (chip === "all") return item.orders
    return item.orders.filter((order) => getOrderSummaryStatus(order) === chip)
  }, [chip, item])

  async function loadTimeline(order: ItemOrderEntry) {
    setSelectedOrder(order)
    setTimelineLoading(true)
    const res = await getOrderTimeline(order.order_id)
    setTimelineEntries(res.success && res.data ? res.data.slice(0, 8) : [])
    setTimelineLoading(false)
  }

  if (!item || !quantity) {
    return <div className="rounded-xl border border-dashed border-sk-border bg-white p-8 text-center text-sm text-sk-text-3">Select an item to view details</div>
  }

  return (
    <div className="space-y-3">
      {toast ? <div className="rounded-lg border border-sk-primary/20 bg-sk-primary/10 px-3 py-2 text-xs text-sk-primary">{toast}</div> : null}
      <ItemHeader item={item} />
      <QuantityDashboard metrics={quantity.metrics} />
      <OrderSummaryChips summary={quantity.orderSummary} selected={chip} onSelect={setChip} />
      <PaymentBreakdown breakdown={quantity.paymentBreakdown} />
      <OrdersTable
        orders={visibleOrders}
        loadingOrderItemId={loadingOrderItemId}
        onView={(order) => router.push(`/dashboard/orders/${order.order_id}`)}
        onSelect={(order) => void loadTimeline(order)}
        onDispatch={(order) => {
          if (!item || order.qty_remaining <= 0) return
          setSnapshot(item)
          setItem((prev) => {
            if (!prev) return prev
            return { ...prev, orders: applyDispatchOptimisticUpdate(prev.orders, { orderItemId: order.order_item_id, qtyDispatched: order.qty_remaining }) }
          })
          void dispatchItem({
            orderId: order.order_id,
            orderItemId: order.order_item_id,
            itemId: item.item_key,
            qtyDispatched: order.qty_remaining,
          })
        }}
      />
      <DispatchTimeline
        orderNumber={selectedOrder?.internal_order_number ?? null}
        entries={timelineEntries}
        loading={timelineLoading}
      />
    </div>
  )
}
