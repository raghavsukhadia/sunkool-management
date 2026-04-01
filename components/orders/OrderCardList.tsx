"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { OrderLineItemSummary } from "@/app/actions/orders"
import { getOrderLineItemsForDropdown } from "@/app/actions/orders"

const orderItemsCache = new Map<string, OrderLineItemSummary[]>()
const orderItemsPending = new Map<string, Promise<OrderLineItemSummary[]>>()

export interface OrderCardItem {
  id: string
  internal_order_number: string | null
  sales_order_number?: string | null
  order_status: string
  payment_status: string
  total_price: number
  created_at: string
  customer?: { name?: string; email?: string | null } | null
  customers?: { name?: string; email?: string | null; id?: string; phone?: string | null } | null
  item_count?: number
  line_items?: OrderLineItemSummary[]
}

const statusColorMap: Record<string, string> = {
  "New Order": "border-amber-200 bg-amber-50 text-amber-700",
  "In Progress": "border-purple-200 bg-purple-50 text-purple-700",
  "Ready for Dispatch": "border-orange-200 bg-orange-50 text-orange-700",
  Invoiced: "border-cyan-200 bg-cyan-50 text-cyan-700",
  "In Transit": "border-sky-200 bg-sky-50 text-sky-700",
  "Partial Delivered": "border-teal-200 bg-teal-50 text-teal-700",
  Delivered: "border-green-200 bg-green-50 text-green-700",
  Void: "border-red-200 bg-red-50 text-red-700",
}

const paymentColorMap: Record<string, string> = {
  Pending: "border-amber-200 bg-amber-50 text-amber-700",
  "Partial Payment": "border-yellow-200 bg-yellow-50 text-yellow-700",
  Paid: "border-green-200 bg-green-50 text-green-700",
  "Delivered Unpaid": "border-orange-200 bg-orange-50 text-orange-700",
  Partial: "border-blue-200 bg-blue-50 text-blue-700",
  Refunded: "border-red-200 bg-red-50 text-red-700",
}

interface OrderCardListProps {
  data: OrderCardItem[]
  isLoading?: boolean
}

function OrderCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-sk-border bg-white p-4">
      <div className="mb-3 h-4 w-24 rounded bg-slate-200" />
      <div className="mb-2 h-4 w-32 rounded bg-slate-200" />
      <div className="flex gap-2 mt-3">
        <div className="h-6 w-20 bg-slate-200 rounded-full" />
        <div className="h-6 w-16 bg-slate-200 rounded-full" />
      </div>
      <div className="h-5 w-20 bg-slate-200 rounded mt-3" />
    </div>
  )
}

function OrderCard({ order }: { order: OrderCardItem }) {
  const customerName =
    order.customer?.name ?? order.customers?.name ?? "—"
  const statusColor =
    statusColorMap[order.order_status] ?? "bg-slate-100 text-slate-700"
  const paymentColor =
    paymentColorMap[order.payment_status] ?? "bg-slate-100 text-slate-700"

  const initialItems = order.line_items ?? null
  const cachedItems = orderItemsCache.get(order.id) ?? null
  const [items, setItems] = useState<OrderLineItemSummary[] | null>(
    initialItems ?? cachedItems
  )
  const [loading, setLoading] = useState(false)
  const [loadedOnce, setLoadedOnce] = useState(initialItems !== null || cachedItems !== null)

  const nItems = useMemo(() => {
    if (items) return items.length
    return order.item_count ?? 0
  }, [order.item_count, items])

  const loadItems = async () => {
    if (loading || loadedOnce) return
    setLoading(true)
    try {
      let pending = orderItemsPending.get(order.id)
      if (!pending) {
        pending = getOrderLineItemsForDropdown(order.id).then((res) => res.items || [])
        orderItemsPending.set(order.id, pending)
      }
      const loadedItems = await pending
      orderItemsCache.set(order.id, loadedItems)
      orderItemsPending.delete(order.id)
      setItems(loadedItems)
    } finally {
      orderItemsPending.delete(order.id)
      setLoading(false)
      setLoadedOnce(true)
    }
  }

  const showItems = typeof order.item_count === "number"

  return (
    <div className="overflow-hidden rounded-xl border border-sk-border bg-white transition-colors hover:bg-[#fcf7f2]">
      <Link
        href={`/dashboard/orders/${order.id}`}
        className="block min-h-[44px] p-4 active:bg-sk-page-bg"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-sk-text-1">
              {order.internal_order_number ?? order.id.slice(0, 8)}
            </p>
            <p className="mt-0.5 truncate text-sm text-sk-text-2">
              {customerName}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                  statusColor
                )}
              >
                {order.order_status}
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                  paymentColor
                )}
              >
                {order.payment_status}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-sk-text-1">
              ₹{(order.total_price ?? 0).toLocaleString("en-IN")}
            </p>
          </div>
          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-sk-text-3" />
        </div>
      </Link>

      {showItems && (
        <details
          className="group border-t border-sk-border bg-[#fcfcfd]"
          onToggle={(e) => {
            const el = e.currentTarget as HTMLDetailsElement
            if (el.open) void loadItems()
          }}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-sk-text-2 hover:bg-sk-page-bg [&::-webkit-details-marker]:hidden">
            <span>Items ({nItems})</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-sk-text-3 transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="border-t border-sk-border bg-white px-4 pb-3 pt-1">
            {loading ? (
              <p className="py-2 text-sm text-sk-text-2">Loading items…</p>
            ) : items && items.length > 0 ? (
              <ul className="space-y-2 pt-1">
                {items.map((item, i) => (
                  <li
                    key={`${item.name}-${i}`}
                    className="flex flex-col gap-1 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-2"
                  >
                    <span className="min-w-0 flex-1 leading-snug text-sk-text-1">
                      {item.name}
                    </span>
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      <span
                        title="Ordered quantity"
                        className="rounded-md bg-cyan-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-cyan-800 ring-1 ring-cyan-100"
                      >
                        O-{item.ordered}
                      </span>
                      <span
                        title="Remaining quantity"
                        className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-900 ring-1 ring-amber-100"
                      >
                        R-{item.remaining}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-sm text-sk-text-2">
                No items on this order.
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  )
}

export function OrderCardList({ data, isLoading = false }: OrderCardListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <OrderCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <p className="font-medium text-sk-text-2">No orders to show</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {data.map((order) => {
        return <OrderCard key={order.id} order={order} />
      })}
    </div>
  )
}
