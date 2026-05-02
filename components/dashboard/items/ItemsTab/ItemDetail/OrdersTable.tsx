"use client"

import Link from "next/link"
import { memo, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ExternalLink, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ItemOrderEntry } from "@/app/actions/items"
import { getOrderTimeline } from "@/app/actions/timeline"
import {
  EVENT_SEVERITY,
  EVENT_TYPE_LABELS,
  type EventSeverity,
  type TimelineEntry,
} from "@/app/actions/timeline-types"
import { getOrderSummaryStatus, type OrderSummaryStatus } from "../utils/itemCalculations"
import { filterTimelineForOrderLine } from "../utils/filterTimelineForOrderLine"

type StatusKey = Exclude<OrderSummaryStatus, "all">

const STATUS_LABEL: Record<StatusKey, string> = {
  delivered: "Delivered",
  dispatched: "Dispatched",
  confirmed: "Confirmed",
  pending: "Pending",
  cancelled: "Cancelled",
}

const STATUS_BADGE: Record<StatusKey, string> = {
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  dispatched: "border-sky-200 bg-sky-50 text-sky-700",
  confirmed: "border-indigo-200 bg-indigo-50 text-indigo-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
}

const SEVERITY_DOT: Record<EventSeverity, string> = {
  success: "bg-emerald-500",
  info: "bg-sky-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
  neutral: "bg-sk-text-3",
}

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; entries: TimelineEntry[] }
  | { status: "error"; message: string }

type OrdersSortKey = "orderId" | "customer" | "date" | "qty"

function orderDisplayId(o: ItemOrderEntry) {
  return (o.internal_order_number ?? o.order_id.slice(0, 8)).toLowerCase()
}

function SortIcon({ active, direction }: { active: boolean; direction: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
  return direction === "asc" ? (
    <ArrowUp className="h-3.5 w-3.5 shrink-0 text-sk-primary" aria-hidden />
  ) : (
    <ArrowDown className="h-3.5 w-3.5 shrink-0 text-sk-primary" aria-hidden />
  )
}

const OrdersTableRow = memo(function OrdersTableRow({ order }: { order: ItemOrderEntry }) {
  const [expanded, setExpanded] = useState(false)
  const [load, setLoad] = useState<LoadState>({ status: "idle" })

  const orderHref = `/dashboard/orders/${order.order_id}`
  const orderLabel = order.internal_order_number ?? order.order_id.slice(0, 8)
  const status = getOrderSummaryStatus(order)
  const lineTimeline =
    load.status === "loaded" ? filterTimelineForOrderLine(load.entries, order) : []

  async function ensureLoaded(force = false) {
    if (!force && (load.status === "loaded" || load.status === "loading")) return
    setLoad({ status: "loading" })
    const res = await getOrderTimeline(order.order_id)
    if (!res.success || !res.data) {
      setLoad({ status: "error", message: res.error ?? "Failed to load timeline" })
    } else {
      setLoad({ status: "loaded", entries: res.data })
    }
  }

  function toggle() {
    const next = !expanded
    setExpanded(next)
    if (next) void ensureLoaded()
  }

  return (
    <>
      <tr className="border-b border-sk-border text-xs last:border-b-0">
        <td className="px-3 py-2 font-semibold text-sk-primary">
          <Link
            href={orderHref}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
          >
            {orderLabel}
          </Link>
        </td>
        <td className="px-3 py-2">{order.customer_name}</td>
        <td className="px-3 py-2">{new Date(order.order_created_at).toLocaleDateString("en-IN")}</td>
        <td className="px-3 py-2 tabular-nums">{order.quantity}</td>
        <td className="px-3 py-2">
          <div className="flex flex-wrap items-center gap-1">
            <Button type="button" size="icon" variant="outline" className="h-7 w-7 shrink-0" asChild>
              <Link href={orderHref} target="_blank" rel="noopener noreferrer" aria-label="View order in new tab">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0"
              onClick={toggle}
              aria-expanded={expanded}
              aria-label={expanded ? "Hide order timeline" : "Show order timeline"}
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                aria-hidden
              />
            </Button>
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-sk-border bg-sk-page-bg/50 last:border-b-0">
          <td colSpan={5} className="px-3 py-3">
            <div className="space-y-4">
              <div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <QtyStat label="Ordered" value={order.quantity} />
                  <QtyStat label="Dispatched" value={order.qty_net_dispatched} />
                  <QtyStat label="Returned" value={order.qty_returned} tone={order.qty_returned > 0 ? "warning" : "default"} />
                  <QtyStat label="Remaining" value={order.qty_remaining} tone={order.qty_remaining > 0 ? "warning" : "default"} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-sk-text-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_BADGE[status]}`}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                  {order.latest_dispatch_date ? (
                    <span>
                      Latest dispatch: {new Date(order.latest_dispatch_date).toLocaleDateString("en-IN")}
                      {order.latest_courier_name ? ` · ${order.latest_courier_name}` : ""}
                      {order.latest_tracking_number ? ` · ${order.latest_tracking_number}` : ""}
                    </span>
                  ) : null}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">
                  Order Timeline
                </p>
                {load.status === "loading" ? (
                  <p className="text-xs text-sk-text-3">Loading timeline...</p>
                ) : null}
                {load.status === "error" ? (
                  <div className="flex items-center gap-2 text-xs text-rose-600">
                    <span>Couldn&apos;t load timeline.</span>
                    <button
                      type="button"
                      onClick={() => void ensureLoaded(true)}
                      className="rounded border border-rose-200 px-2 py-0.5 text-[11px] hover:bg-rose-50"
                    >
                      Retry
                    </button>
                  </div>
                ) : null}
                {load.status === "loaded" && load.entries.length === 0 ? (
                  <p className="text-xs text-sk-text-3">No timeline events yet.</p>
                ) : null}
                {load.status === "loaded" && load.entries.length > 0 && lineTimeline.length === 0 ? (
                  <p className="text-xs text-sk-text-3">
                    No timeline entries could be matched to this product line (older events may lack product metadata).
                  </p>
                ) : null}
                {load.status === "loaded" && lineTimeline.length > 0 ? (
                  <ol className="relative space-y-2 before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-sk-border">
                    {lineTimeline.map((event) => {
                      const severity = EVENT_SEVERITY[event.event_type] ?? "neutral"
                      const fallbackLabel = EVENT_TYPE_LABELS[event.event_type] ?? event.event_type
                      const actorLabel = event.actor_name ?? event.actor
                      return (
                        <li key={event.id} className="relative pl-5">
                          <span
                            className={`absolute left-0 top-1.5 inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white ${SEVERITY_DOT[severity]}`}
                            aria-hidden
                          />
                          <p className="text-xs font-semibold text-sk-text-1">{event.title || fallbackLabel}</p>
                          {event.description ? (
                            <p className="text-[11px] text-sk-text-2">{event.description}</p>
                          ) : null}
                          <p className="text-[10px] text-sk-text-3">
                            {new Date(event.timestamp).toLocaleString("en-IN")}
                            {actorLabel ? ` · ${actorLabel}` : ""}
                          </p>
                        </li>
                      )
                    })}
                  </ol>
                ) : null}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
})

function QtyStat({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: number
  tone?: "default" | "warning"
}) {
  const valueColor = tone === "warning" ? "text-amber-700" : "text-sk-text-1"
  return (
    <div className="rounded-md border border-sk-border bg-white px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-sk-text-3">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${valueColor}`}>{value}</p>
    </div>
  )
}

export function OrdersTable({ orders }: { orders: ItemOrderEntry[] }) {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<OrdersSortKey>("date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((o) => {
      const id = orderDisplayId(o)
      const sales = (o.sales_order_number ?? "").toLowerCase()
      return (
        id.includes(q) ||
        o.order_id.toLowerCase().includes(q) ||
        sales.includes(q) ||
        o.customer_name.toLowerCase().includes(q)
      )
    })
  }, [orders, search])

  const displayOrders = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      let cmp = 0
      if (sortKey === "orderId") {
        cmp = orderDisplayId(a).localeCompare(orderDisplayId(b), undefined, { numeric: true })
        if (cmp === 0) cmp = a.order_id.localeCompare(b.order_id)
      } else if (sortKey === "customer") {
        cmp = a.customer_name.localeCompare(b.customer_name, undefined, { sensitivity: "base" })
      } else if (sortKey === "date") {
        cmp = new Date(a.order_created_at).getTime() - new Date(b.order_created_at).getTime()
      } else {
        cmp = a.quantity - b.quantity
        if (cmp === 0) cmp = a.order_id.localeCompare(b.order_id)
      }
      return sortDir === "asc" ? cmp : -cmp
    })
    return arr
  }, [filtered, sortKey, sortDir])

  function handleSort(key: OrdersSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(key === "date" || key === "qty" ? "desc" : "asc")
    }
  }

  return (
    <section className="rounded-xl border border-sk-border bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-sk-text-1 xl:text-lg">Orders</h3>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sk-text-3" aria-hidden />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order ID, customer…"
          className="h-9 pl-8 text-xs"
          aria-label="Search orders"
        />
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[520px] w-full">
          <thead>
            <tr className="bg-sk-page-bg text-left text-[11px] uppercase text-sk-text-3">
              <th className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => handleSort("orderId")}
                  className="inline-flex items-center gap-1 font-semibold tracking-wide text-sk-text-3 transition-colors hover:text-sk-text-1"
                >
                  Order ID
                  <SortIcon active={sortKey === "orderId"} direction={sortDir} />
                </button>
              </th>
              <th className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => handleSort("customer")}
                  className="inline-flex items-center gap-1 font-semibold tracking-wide text-sk-text-3 transition-colors hover:text-sk-text-1"
                >
                  Customer
                  <SortIcon active={sortKey === "customer"} direction={sortDir} />
                </button>
              </th>
              <th className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => handleSort("date")}
                  className="inline-flex items-center gap-1 font-semibold tracking-wide text-sk-text-3 transition-colors hover:text-sk-text-1"
                >
                  Order Date
                  <SortIcon active={sortKey === "date"} direction={sortDir} />
                </button>
              </th>
              <th className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => handleSort("qty")}
                  className="inline-flex items-center gap-1 font-semibold tracking-wide text-sk-text-3 transition-colors hover:text-sk-text-1"
                >
                  Qty
                  <SortIcon active={sortKey === "qty"} direction={sortDir} />
                </button>
              </th>
              <th className="px-3 py-2 font-semibold tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayOrders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-xs text-sk-text-3">
                  {orders.length === 0 ? "No orders in this view." : "No orders match your search."}
                </td>
              </tr>
            ) : (
              displayOrders.map((order) => <OrdersTableRow key={order.order_item_id} order={order} />)
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
