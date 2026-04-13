"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, Package, Search, X, ChevronDown,
  CheckCircle2, Clock, Truck, AlertCircle,
  Users, ShoppingCart, TrendingUp, Phone,
  Calendar, Hash, ArrowUp, ArrowDown, ArrowUpDown,
  ExternalLink, Download, RefreshCw, Filter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getItemByKey } from "@/app/actions/items"
import type { ItemSummary, ItemOrderEntry, DispatchStatus } from "@/app/actions/items"
import { cn } from "@/lib/utils"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return "—"
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d))
}

function relDate(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return fmtDate(d)
}

const DC: Record<DispatchStatus, { label: string; cls: string; dotCls: string; icon: React.ElementType }> = {
  not_dispatched:   { label: "Pending",    cls: "bg-amber-50 text-amber-700 border-amber-200",      dotCls: "bg-amber-400",   icon: Clock       },
  partial:          { label: "Partial",    cls: "bg-blue-50 text-blue-700 border-blue-200",         dotCls: "bg-blue-400",    icon: Truck       },
  fully_dispatched: { label: "Dispatched", cls: "bg-emerald-50 text-emerald-700 border-emerald-200",dotCls: "bg-emerald-400", icon: CheckCircle2 },
}

const ORDER_STATUS_CLS: Record<string, string> = {
  "New Order":          "bg-sky-50 text-sky-700 border-sky-200",
  "In Progress":        "bg-violet-50 text-violet-700 border-violet-200",
  "Ready for Dispatch": "bg-orange-50 text-orange-700 border-orange-200",
  "Invoiced":           "bg-amber-50 text-amber-700 border-amber-200",
  "In Transit":         "bg-blue-50 text-blue-700 border-blue-200",
  "Partial Delivered":  "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Delivered":          "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Void":               "bg-gray-100 text-gray-500 border-gray-200",
}

const ORDER_STATUSES = [
  "New Order", "In Progress", "Ready for Dispatch",
  "Invoiced", "In Transit", "Partial Delivered", "Delivered", "Void",
]

type SortKey = "order_created_at" | "customer_name" | "quantity" | "subtotal" | "qty_remaining" | "dispatch_status"

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string; icon: React.ElementType; accent: string
}) {
  return (
    <Card className="border border-sk-border bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sk-text-3">{label}</p>
            <p className="mt-1 text-[22px] font-bold leading-none text-sk-text-1">{value}</p>
            {sub && <p className="mt-0.5 text-[11px] text-sk-text-3">{sub}</p>}
          </div>
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", accent)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Dispatch progress bar ────────────────────────────────────────────────────

function DispatchBar({ dispatched, total, showLabel = true }: {
  dispatched: number; total: number; showLabel?: boolean
}) {
  const pct = total > 0 ? Math.min(100, Math.round((dispatched / total) * 100)) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-500" : pct > 0 ? "bg-blue-500" : "bg-gray-200")}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && <span className="shrink-0 text-[11px] tabular-nums text-sk-text-3">{pct}%</span>}
    </div>
  )
}

// ─── Desktop table row ────────────────────────────────────────────────────────

function TableRow({ entry, onView }: { entry: ItemOrderEntry; onView: () => void }) {
  const dc = DC[entry.dispatch_status]
  const DcIcon = dc.icon

  return (
    <tr className="group border-b border-sk-border transition-colors last:border-0 hover:bg-sk-page-bg">
      {/* Order */}
      <td className="px-5 py-4">
        <p className="text-[14px] font-bold text-sk-primary">
          {entry.internal_order_number ?? "—"}
        </p>
        {entry.sales_order_number && (
          <p className="text-[11px] text-sk-text-3">SO: {entry.sales_order_number}</p>
        )}
        <p className="mt-0.5 text-[11px] text-sk-text-3">{relDate(entry.order_created_at)}</p>
      </td>

      {/* Customer */}
      <td className="px-5 py-4">
        <p className="font-semibold text-sk-text-1">{entry.customer_name}</p>
        {entry.customer_phone && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-sk-text-3">
            <Phone className="h-3 w-3" /> {entry.customer_phone}
          </div>
        )}
      </td>

      {/* Qty + progress */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="space-y-0.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sk-text-3">Ordered</p>
            <p className="text-[15px] font-bold text-sk-text-1">{entry.quantity}</p>
          </div>
          <div className="h-6 w-px bg-sk-border" />
          <div className="space-y-0.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sk-text-3">Sent</p>
            <p className="text-[15px] font-bold text-blue-600">{entry.qty_net_dispatched}</p>
          </div>
          <div className="h-6 w-px bg-sk-border" />
          <div className="space-y-0.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sk-text-3">Left</p>
            <p className={cn("text-[15px] font-bold", entry.qty_remaining > 0 ? "text-amber-600" : "text-emerald-600")}>
              {entry.qty_remaining}
            </p>
          </div>
        </div>
        <div className="mt-2">
          <DispatchBar dispatched={entry.qty_net_dispatched} total={entry.quantity} />
        </div>
      </td>

      {/* Dispatch status */}
      <td className="px-5 py-4">
        <div className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold", dc.cls)}>
          <DcIcon className="h-3 w-3" />
          {dc.label}
        </div>
        {entry.latest_dispatch_date && (
          <p className="mt-1 text-[11px] text-sk-text-3">{fmtDate(entry.latest_dispatch_date)}</p>
        )}
        {entry.latest_courier_name && (
          <p className="text-[11px] text-sk-text-3">{entry.latest_courier_name}</p>
        )}
        {entry.latest_tracking_number && (
          <p className="text-[11px] font-medium text-sk-text-2">{entry.latest_tracking_number}</p>
        )}
      </td>

      {/* Order status */}
      <td className="px-5 py-4">
        <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium", ORDER_STATUS_CLS[entry.order_status] ?? "bg-gray-100 text-gray-500 border-gray-200")}>
          {entry.order_status}
        </span>
      </td>

      {/* Value */}
      <td className="px-5 py-4 text-right">
        <p className="font-bold text-sk-text-1">{fmt(entry.subtotal)}</p>
        <p className="text-[11px] text-sk-text-3">{fmt(entry.unit_price)}/unit</p>
      </td>

      {/* Action */}
      <td className="px-5 py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onView}
          className="h-8 gap-1.5 rounded-lg bg-sk-primary/10 px-3 text-[12px] font-semibold text-sk-primary opacity-0 transition-opacity group-hover:opacity-100 hover:bg-sk-primary/20"
        >
          View Order <ExternalLink className="h-3 w-3" />
        </Button>
      </td>
    </tr>
  )
}

// ─── Mobile order card ────────────────────────────────────────────────────────

function OrderCard({ entry, onView }: { entry: ItemOrderEntry; onView: () => void }) {
  const dc = DC[entry.dispatch_status]
  const DcIcon = dc.icon

  return (
    <div className="rounded-xl border border-sk-border bg-white shadow-sm overflow-hidden">
      {/* Header stripe */}
      <div className={cn("px-4 py-2.5 flex items-center justify-between", dc.dotCls === "bg-emerald-400" ? "bg-emerald-50" : dc.dotCls === "bg-blue-400" ? "bg-blue-50" : "bg-amber-50")}>
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", dc.dotCls)} />
          <span className="text-[12px] font-bold text-sk-primary">{entry.internal_order_number ?? "—"}</span>
          {entry.sales_order_number && <span className="text-[11px] text-sk-text-3">· {entry.sales_order_number}</span>}
        </div>
        <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium", ORDER_STATUS_CLS[entry.order_status] ?? "bg-gray-100 text-gray-500 border-gray-200")}>
          {entry.order_status}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Customer */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sk-text-1">{entry.customer_name}</p>
            {entry.customer_phone && (
              <p className="flex items-center gap-1 text-[11px] text-sk-text-3 mt-0.5">
                <Phone className="h-3 w-3" />{entry.customer_phone}
              </p>
            )}
          </div>
          <p className="text-[11px] text-sk-text-3 shrink-0">{relDate(entry.order_created_at)}</p>
        </div>

        {/* Qty tiles */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { l: "Ordered",    v: entry.quantity,           cls: "text-sk-text-1" },
            { l: "Sent",       v: entry.qty_net_dispatched, cls: "text-blue-600"  },
            { l: "Returned",   v: entry.qty_returned,       cls: "text-red-500"   },
            { l: "Remaining",  v: entry.qty_remaining,      cls: entry.qty_remaining > 0 ? "text-amber-600" : "text-emerald-600" },
          ].map(col => (
            <div key={col.l} className="rounded-lg border border-sk-border bg-sk-page-bg p-2 text-center">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-sk-text-3">{col.l}</p>
              <p className={cn("text-[16px] font-bold", col.cls)}>{col.v}</p>
            </div>
          ))}
        </div>

        {/* Progress + dispatch badge */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <DispatchBar dispatched={entry.qty_net_dispatched} total={entry.quantity} />
          </div>
          <div className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold shrink-0", dc.cls)}>
            <DcIcon className="h-3 w-3" />{dc.label}
          </div>
        </div>

        {/* Courier / tracking */}
        {(entry.latest_courier_name || entry.latest_tracking_number) && (
          <div className="rounded-lg border border-sk-border bg-sk-page-bg px-3 py-2 flex flex-wrap gap-x-4 gap-y-1">
            {entry.latest_courier_name && (
              <span className="text-[11px] text-sk-text-3"><span className="font-medium text-sk-text-2">Courier:</span> {entry.latest_courier_name}</span>
            )}
            {entry.latest_tracking_number && (
              <span className="text-[11px] text-sk-text-3"><span className="font-medium text-sk-text-2">Tracking:</span> {entry.latest_tracking_number}</span>
            )}
          </div>
        )}

        {/* Footer: value + view button */}
        <div className="flex items-center justify-between pt-1 border-t border-sk-border">
          <div>
            <p className="text-[14px] font-bold text-sk-text-1">{fmt(entry.subtotal)}</p>
            <p className="text-[11px] text-sk-text-3">{fmt(entry.unit_price)}/unit</p>
          </div>
          <Button
            onClick={onView}
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded-lg bg-sk-primary/10 px-3 text-[12px] font-semibold text-sk-primary hover:bg-sk-primary/20"
          >
            View Order <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [item, setItem] = useState<ItemSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState("")
  const [customerFilter, setCustomerFilter] = useState("all")
  const [orderStatusFilter, setOrderStatusFilter] = useState("all")
  const [dispatchFilter, setDispatchFilter] = useState("all")

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("order_created_at")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await getItemByKey(id)
      if (!res.success) { setError(res.error ?? "Not found"); return }
      setItem(res.data)
    } catch (e: any) {
      setError(e.message ?? "Unexpected error")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // ── Derived filter options ──────────────────────────────────────────────────
  const uniqueCustomers = useMemo(() => {
    if (!item) return []
    const seen = new Map<string, string>()
    for (const o of item.orders) if (o.customer_id) seen.set(o.customer_id, o.customer_name)
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [item])

  // ── Filtered + sorted orders ────────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    if (!item) return []
    let data = [...item.orders]

    if (search.trim()) {
      const q = search.toLowerCase()
      data = data.filter(o =>
        o.customer_name.toLowerCase().includes(q) ||
        (o.internal_order_number ?? "").toLowerCase().includes(q) ||
        (o.sales_order_number ?? "").toLowerCase().includes(q) ||
        (o.latest_tracking_number ?? "").toLowerCase().includes(q) ||
        (o.latest_courier_name ?? "").toLowerCase().includes(q)
      )
    }
    if (customerFilter !== "all") data = data.filter(o => o.customer_id === customerFilter)
    if (orderStatusFilter !== "all") data = data.filter(o => o.order_status === orderStatusFilter)
    if (dispatchFilter !== "all") data = data.filter(o => o.dispatch_status === dispatchFilter)

    data.sort((a, b) => {
      let av: any, bv: any
      if (sortKey === "customer_name")   { av = a.customer_name;   bv = b.customer_name }
      else if (sortKey === "quantity")   { av = a.quantity;         bv = b.quantity }
      else if (sortKey === "subtotal")   { av = a.subtotal;         bv = b.subtotal }
      else if (sortKey === "qty_remaining") { av = a.qty_remaining; bv = b.qty_remaining }
      else if (sortKey === "dispatch_status") {
        const o: Record<DispatchStatus, number> = { not_dispatched: 0, partial: 1, fully_dispatched: 2 }
        av = o[a.dispatch_status]; bv = o[b.dispatch_status]
      }
      else { av = a.order_created_at; bv = b.order_created_at }
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })

    return data
  }, [item, search, customerFilter, orderStatusFilter, dispatchFilter, sortKey, sortDir])

  function handleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(k); setSortDir("desc") }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 opacity-30" />
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-sk-primary" /> : <ArrowDown className="h-3 w-3 text-sk-primary" />
  }

  const activeFilters = [customerFilter !== "all", orderStatusFilter !== "all", dispatchFilter !== "all"].filter(Boolean).length

  function clearFilters() {
    setCustomerFilter("all"); setOrderStatusFilter("all"); setDispatchFilter("all"); setSearch("")
  }

  function exportCSV() {
    if (!item) return
    const rows = [["Order #", "SO Number", "Customer", "Phone", "Order Status", "Dispatch Status", "Ordered", "Dispatched", "Remaining", "Unit Price", "Total", "Courier", "Tracking", "Order Date"]]
    for (const o of filteredOrders) {
      rows.push([
        o.internal_order_number ?? "", o.sales_order_number ?? "",
        o.customer_name, o.customer_phone ?? "",
        o.order_status, DC[o.dispatch_status].label,
        String(o.quantity), String(o.qty_net_dispatched), String(o.qty_remaining),
        String(o.unit_price), String(o.subtotal),
        o.latest_courier_name ?? "", o.latest_tracking_number ?? "",
        fmtDate(o.order_created_at),
      ])
    }
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    a.download = `${item.item_name.replace(/\s+/g, "-")}-orders-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-28 animate-pulse rounded-xl bg-gray-100" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />)}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-50" />)}
        </div>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-red-400" />
        <p className="text-[14px] font-medium text-sk-text-1">{error ?? "Item not found"}</p>
        <Button onClick={() => router.back()} variant="outline" className="mt-4 gap-2"><ArrowLeft className="h-4 w-4" />Go Back</Button>
      </div>
    )
  }

  const pendingCount  = item.orders.filter(o => o.dispatch_status !== "fully_dispatched").length
  const dispatchedPct = item.total_quantity > 0 ? Math.round((item.total_dispatched / item.total_quantity) * 100) : 0

  return (
    <div className="space-y-6">

      {/* ── Back button ──────────────────────────────────────────────────────── */}
      <button
        onClick={() => router.push("/dashboard/items")}
        className="flex items-center gap-2 text-[13px] font-medium text-sk-text-3 transition-colors hover:text-sk-text-1"
      >
        <ArrowLeft className="h-4 w-4" />
        All Items
      </button>

      {/* ── Item header ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-sk-border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sk-primary/10">
              <Package className="h-7 w-7 text-sk-primary" />
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-sk-text-1">{item.item_name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {item.item_sku && (
                  <span className="flex items-center gap-1 rounded-md border border-sk-border bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-sk-text-2">
                    <Hash className="h-3 w-3 text-sk-text-3" />{item.item_sku}
                  </span>
                )}
                {item.item_category && (
                  <Badge variant="outline" className="text-[11px]">{item.item_category}</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Dispatch progress */}
          <div className="sm:text-right">
            <div className="flex items-center gap-2 sm:justify-end">
              <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={cn("h-full rounded-full", dispatchedPct === 100 ? "bg-emerald-500" : "bg-sk-primary")}
                  style={{ width: `${dispatchedPct}%` }}
                />
              </div>
              <span className="text-[13px] font-bold text-sk-text-1">{dispatchedPct}%</span>
            </div>
            <p className="mt-1 text-[12px] text-sk-text-3">
              {item.total_dispatched} of {item.total_quantity} units dispatched
            </p>
            {item.last_ordered_at && (
              <p className="mt-0.5 text-[11px] text-sk-text-3">
                Last ordered: {relDate(item.last_ordered_at)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Orders"     value={String(item.total_orders)}    sub={`${item.unique_customers} customer${item.unique_customers !== 1 ? "s" : ""}`}   icon={ShoppingCart} accent="bg-sk-primary/10 text-sk-primary" />
        <StatCard label="Total Quantity"   value={String(item.total_quantity)}  sub={`${item.total_dispatched} dispatched`}    icon={Package}      accent="bg-violet-50 text-violet-600" />
        <StatCard label="Pending"          value={String(pendingCount)}         sub={`${item.total_remaining} units remaining`}icon={Clock}        accent="bg-amber-50 text-amber-600" />
        <StatCard label="Total Value"      value={fmt(item.total_value)}        sub="across all orders"                        icon={TrendingUp}   accent="bg-emerald-50 text-emerald-600" />
      </div>

      {/* ── Customers strip ──────────────────────────────────────────────────── */}
      {uniqueCustomers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">Ordered by:</span>
          {uniqueCustomers.map(c => (
            <span key={c.id} className="flex items-center gap-1.5 rounded-full border border-sk-border bg-white px-3 py-1 text-[12px] font-medium text-sk-text-2 shadow-sm">
              <Users className="h-3.5 w-3.5 text-sk-text-3" />{c.name}
            </span>
          ))}
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sk-text-3" />
          <Input
            placeholder="Search order, customer, tracking…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 text-[13px]"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-sk-text-3 hover:text-sk-text-1">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Dispatch filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className={cn("h-9 gap-2 text-[13px]", dispatchFilter !== "all" && "border-sk-primary bg-sk-primary/5 text-sk-primary")}>
                <Truck className="h-3.5 w-3.5" />
                {dispatchFilter === "all" ? "Dispatch" : DC[dispatchFilter as DispatchStatus]?.label ?? "Dispatch"}
                <ChevronDown className="h-3.5 w-3.5 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 p-1.5">
              {[{ v: "all", l: "All" }, { v: "not_dispatched", l: "Pending" }, { v: "partial", l: "Partial" }, { v: "fully_dispatched", l: "Dispatched" }].map(opt => (
                <DropdownMenuItem key={opt.v} onClick={() => setDispatchFilter(opt.v)}
                  className={cn("text-[13px] rounded-md cursor-pointer", dispatchFilter === opt.v && "bg-sk-primary/10 text-sk-primary font-medium")}>
                  {opt.l}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Order status filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className={cn("h-9 gap-2 text-[13px]", orderStatusFilter !== "all" && "border-sk-primary bg-sk-primary/5 text-sk-primary")}>
                <Filter className="h-3.5 w-3.5" />
                {orderStatusFilter === "all" ? "Order Status" : orderStatusFilter}
                <ChevronDown className="h-3.5 w-3.5 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 p-1.5">
              <DropdownMenuItem onClick={() => setOrderStatusFilter("all")}
                className={cn("text-[13px] rounded-md cursor-pointer", orderStatusFilter === "all" && "bg-sk-primary/10 text-sk-primary font-medium")}>
                All Statuses
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {ORDER_STATUSES.map(s => (
                <DropdownMenuItem key={s} onClick={() => setOrderStatusFilter(s)}
                  className={cn("text-[13px] rounded-md cursor-pointer", orderStatusFilter === s && "bg-sk-primary/10 text-sk-primary font-medium")}>
                  {s}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Customer filter */}
          {uniqueCustomers.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className={cn("h-9 gap-2 text-[13px]", customerFilter !== "all" && "border-sk-primary bg-sk-primary/5 text-sk-primary")}>
                  <Users className="h-3.5 w-3.5" />
                  {customerFilter === "all" ? "Customer" : (uniqueCustomers.find(c => c.id === customerFilter)?.name ?? "Customer")}
                  <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-60 w-52 overflow-y-auto p-1.5">
                <DropdownMenuItem onClick={() => setCustomerFilter("all")}
                  className={cn("text-[13px] rounded-md cursor-pointer", customerFilter === "all" && "bg-sk-primary/10 text-sk-primary font-medium")}>
                  All Customers
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {uniqueCustomers.map(c => (
                  <DropdownMenuItem key={c.id} onClick={() => setCustomerFilter(c.id)}
                    className={cn("text-[13px] rounded-md cursor-pointer", customerFilter === c.id && "bg-sk-primary/10 text-sk-primary font-medium")}>
                    {c.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {(activeFilters > 0 || search) && (
            <button onClick={clearFilters} className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-100 transition-colors">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}

          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4 text-sk-text-3", refreshing && "animate-spin")} />
          </Button>

          <Button variant="outline" className="h-9 gap-2 text-[13px]" onClick={exportCSV} disabled={filteredOrders.length === 0}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>
      </div>

      {/* ── Results summary ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-sk-text-3">
          <span className="font-semibold text-sk-text-1">{filteredOrders.length}</span> of{" "}
          <span className="font-semibold text-sk-text-1">{item.total_orders}</span> orders
        </p>
        {filteredOrders.length > 0 && (
          <p className="text-[12px] text-sk-text-3">
            Value: <span className="font-semibold text-sk-text-1">{fmt(filteredOrders.reduce((s, o) => s + o.subtotal, 0))}</span>
            {" · "}Qty: <span className="font-semibold text-sk-text-1">{filteredOrders.reduce((s, o) => s + o.quantity, 0)}</span>
          </p>
        )}
      </div>

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-sk-border bg-white py-20 text-center">
          <ShoppingCart className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-[14px] font-medium text-sk-text-2">No orders match your filters</p>
          {(activeFilters > 0 || search) && (
            <button onClick={clearFilters} className="mt-3 text-[12px] font-medium text-sk-primary underline">Clear filters</button>
          )}
        </div>
      ) : (
        <>
          {/* ── Desktop table ──────────────────────────────────────────────── */}
          <div className="hidden lg:block overflow-hidden rounded-2xl border border-sk-border bg-white shadow-sm">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-sk-border bg-gray-50/80">
                <tr>
                  {([
                    { k: "order_created_at" as SortKey, l: "Order" },
                    { k: "customer_name"    as SortKey, l: "Customer" },
                    { k: "quantity"         as SortKey, l: "Quantity" },
                    { k: "dispatch_status"  as SortKey, l: "Dispatch" },
                    { k: null,                           l: "Order Status" },
                    { k: "subtotal"         as SortKey, l: "Value" },
                    { k: null,                           l: "" },
                  ] as { k: SortKey | null; l: string }[]).map((col, i) => (
                    <th key={i} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">
                      {col.k ? (
                        <button onClick={() => handleSort(col.k!)} className="flex items-center gap-1.5 hover:text-sk-text-1 transition-colors">
                          {col.l} <SortIcon k={col.k} />
                        </button>
                      ) : col.l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(entry => (
                  <TableRow
                    key={entry.order_item_id}
                    entry={entry}
                    onView={() => router.push(`/dashboard/orders/${entry.order_id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards ───────────────────────────────────────────────── */}
          <div className="space-y-3 lg:hidden">
            {filteredOrders.map(entry => (
              <OrderCard
                key={entry.order_item_id}
                entry={entry}
                onView={() => router.push(`/dashboard/orders/${entry.order_id}`)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
