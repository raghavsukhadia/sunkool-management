"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { getCustomerById } from "@/app/actions/customers"
import type { CustomerDetail, OrderLogEntry } from "@/app/actions/customers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ArrowLeft, Phone, Mail, MapPin, User, FileText, Calendar,
  AlertCircle, TrendingUp, Package, ExternalLink, Search, Copy, Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`
  return `₹${value.toLocaleString("en-IN")}`
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(dateStr))
}

function formatRelativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return formatDate(dateStr)
}

// ─── Badge / Tag maps ────────────────────────────────────────────────────────

const ORDER_STATUS_COLORS: Record<string, string> = {
  "New Order":          "border-yellow-200 bg-yellow-50 text-yellow-800",
  "In Progress":        "border-purple-200 bg-purple-50 text-purple-800",
  "Ready for Dispatch": "border-orange-200 bg-orange-50 text-orange-800",
  "Invoiced":           "border-cyan-200 bg-cyan-50 text-cyan-800",
  "In Transit":         "border-sky-200 bg-sky-50 text-sky-800",
  "Partial Delivered":  "border-teal-200 bg-teal-50 text-teal-800",
  "Delivered":          "border-emerald-200 bg-emerald-50 text-emerald-800",
  "Void":               "border-red-200 bg-red-50 text-red-800",
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  "Paid":               "border-green-200 bg-green-50 text-green-800",
  "Pending":            "border-amber-200 bg-amber-50 text-amber-800",
  "Partial":            "border-blue-200 bg-blue-50 text-blue-800",
  "Delivered Unpaid":   "border-red-200 bg-red-50 text-red-800",
  "Refunded":           "border-slate-200 bg-slate-50 text-slate-700",
}

const TAG_COLORS: Record<string, string> = {
  "High Value":      "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Frequent Buyer":  "bg-blue-50 text-blue-700 border-blue-200",
  "Account Overdue": "bg-red-50 text-red-700 border-red-200",
  "New Customer":    "bg-violet-50 text-violet-700 border-violet-200",
  "Inactive":        "bg-slate-100 text-slate-500 border-slate-200",
  "No Orders":       "bg-slate-100 text-slate-500 border-slate-200",
}

const INSIGHT_STYLES = {
  warning: { dot: "bg-amber-400",   text: "text-amber-700",   bg: "bg-amber-50 border-amber-200"   },
  success: { dot: "bg-emerald-400", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  info:    { dot: "bg-blue-400",    text: "text-blue-700",    bg: "bg-blue-50 border-blue-200"     },
}

const ORDER_STATUSES = [
  "all", "New Order", "In Progress", "Ready for Dispatch",
  "Invoiced", "In Transit", "Partial Delivered", "Delivered", "Void",
]

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status, type }: { status: string; type: "order" | "payment" }) {
  const cls = (type === "order" ? ORDER_STATUS_COLORS : PAYMENT_STATUS_COLORS)[status]
    ?? "border-slate-200 bg-slate-50 text-slate-700"
  return (
    <span className={cn("inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium", cls)}>
      {status}
    </span>
  )
}

function TagPill({ tag }: { tag: string }) {
  const cls = TAG_COLORS[tag] ?? "bg-slate-100 text-slate-600 border-slate-200"
  return (
    <span className={cn("inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", cls)}>
      {tag}
    </span>
  )
}

function InitialsAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("")
  const sz = size === "lg" ? "h-16 w-16 text-2xl" : "h-11 w-11 text-base"
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full bg-orange-100 font-bold text-orange-600", sz)}>
      {initials}
    </div>
  )
}

function KpiCard({
  label, value, sub, accent, large,
}: { label: string; value: string | number; sub?: string; accent?: string; large?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {accent && <div className={cn("h-[3px] w-full", accent)} />}
      <div className="px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
        <p className={cn("mt-1.5 font-bold leading-none", large ? "text-3xl" : "text-2xl", "text-slate-900")}>{value}</p>
        {sub && <p className="mt-1.5 text-[11px] text-slate-400">{sub}</p>}
      </div>
    </div>
  )
}

function TopItemsChart({ items }: { items: CustomerDetail["top_items"] }) {
  if (!items.length) return <p className="text-sm text-slate-400">No item data available.</p>
  const max = Math.max(...items.map(i => i.total_quantity))
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={item.item_name}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="max-w-[65%] truncate text-[12px] font-medium text-slate-700">
              <span className="mr-1.5 text-[10px] text-slate-400">#{i + 1}</span>
              {item.item_name}
            </span>
            <span className="text-[12px] font-bold text-slate-900">{item.total_quantity.toLocaleString()} units</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-orange-400 transition-all"
              style={{ width: `${Math.round((item.total_quantity / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function describeLogEntry(entry: OrderLogEntry): string {
  const parts: string[] = []
  if (entry.old_status && entry.new_status && entry.old_status !== entry.new_status)
    parts.push(`${entry.old_status} → ${entry.new_status}`)
  else if (entry.new_status && !entry.old_status)
    parts.push(`Status: ${entry.new_status}`)
  if (entry.old_payment_status && entry.new_payment_status && entry.old_payment_status !== entry.new_payment_status)
    parts.push(`Payment: ${entry.old_payment_status} → ${entry.new_payment_status}`)
  else if (entry.new_payment_status && !entry.old_payment_status)
    parts.push(`Payment: ${entry.new_payment_status}`)
  return parts.join(" · ") || "Order updated"
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orderSearch, setOrderSearch] = useState("")
  const [orderStatusFilter, setOrderStatusFilter] = useState("all")
  const [copiedPhone, setCopiedPhone] = useState(false)

  useEffect(() => {
    if (!id) return
    getCustomerById(id).then(res => {
      if (res.success && res.data) setCustomer(res.data)
      else setError(res.error ?? "Customer not found")
      setLoading(false)
    })
  }, [id])

  const filteredOrders = useMemo(() => {
    if (!customer?.orders) return []
    let o = customer.orders
    if (orderSearch.trim()) {
      const s = orderSearch.trim().toLowerCase()
      o = o.filter(order =>
        order.internal_order_number?.toLowerCase().includes(s) ||
        order.sales_order_number?.toLowerCase().includes(s) ||
        order.order_status.toLowerCase().includes(s) ||
        order.payment_status.toLowerCase().includes(s)
      )
    }
    if (orderStatusFilter !== "all") o = o.filter(o => o.order_status === orderStatusFilter)
    return o
  }, [customer?.orders, orderSearch, orderStatusFilter])

  const copyPhone = () => {
    if (!customer?.phone) return
    navigator.clipboard.writeText(customer.phone).then(() => {
      setCopiedPhone(true)
      setTimeout(() => setCopiedPhone(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-red-500">
        <AlertCircle className="h-6 w-6" />
        <p>{error ?? "Customer not found."}</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/customers")}>
          Back to Customers
        </Button>
      </div>
    )
  }

  const avgOrderValue = customer.total_orders > 0
    ? Math.round(customer.lifetime_value / customer.total_orders)
    : 0
  const memberSince = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(
    new Date(customer.created_at)
  )
  const unpaidOrders = customer.orders.filter(
    o => o.payment_status === "Pending" || o.payment_status === "Delivered Unpaid" || o.payment_status === "Partial"
  )

  return (
    <div className="space-y-5">

      {/* ── Back nav ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push("/dashboard/customers")}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          All Customers
        </button>
      </div>

      {/* ── Hero ── */}
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <InitialsAvatar name={customer.name} size="lg" />
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold text-slate-900">{customer.name}</h1>
              {customer.smart_tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {customer.smart_tags.map(tag => <TagPill key={tag} tag={tag} />)}
                </div>
              )}
              <p className="mt-2 text-[12px] text-slate-400">Member since {memberSince}</p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            {customer.phone && (
              <button
                onClick={copyPhone}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-600 shadow-sm transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
              >
                {copiedPhone ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                {copiedPhone ? "Copied!" : customer.phone}
              </button>
            )}
            {customer.email && (
              <a
                href={`mailto:${customer.email}`}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-600 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
              >
                <Mail className="h-4 w-4" />
                Email
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Total Orders"
          value={customer.total_orders}
          sub={customer.last_order_date ? `Last: ${formatRelativeDate(customer.last_order_date)}` : "No orders yet"}
          accent="bg-orange-500"
        />
        <KpiCard
          label="Lifetime Value"
          value={formatCurrency(customer.lifetime_value)}
          sub={`Avg ${formatCurrency(avgOrderValue)} / order`}
          accent="bg-blue-500"
        />
        <KpiCard
          label="Unpaid Amount"
          value={customer.unpaid_delivered_amount > 0 ? formatCurrency(customer.unpaid_delivered_amount) : "Clear"}
          sub={customer.unpaid_delivered > 0 ? `${customer.unpaid_delivered} order${customer.unpaid_delivered > 1 ? "s" : ""} pending` : "No outstanding dues"}
          accent={customer.unpaid_delivered > 0 ? "bg-red-500" : "bg-emerald-500"}
        />
        <KpiCard
          label="Avg Order Value"
          value={formatCurrency(avgOrderValue)}
          sub={`${customer.total_orders} total order${customer.total_orders !== 1 ? "s" : ""}`}
          accent="bg-violet-500"
        />
      </div>

      {/* ── Main 2-column layout ── */}
      <div className="grid gap-5 lg:grid-cols-5">

        {/* LEFT: Contact + Insights + Top Items */}
        <div className="space-y-4 lg:col-span-2">

          {/* Contact Info */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-[13px] font-semibold text-slate-700">Contact Info</h2>
            </div>
            <ul className="space-y-3 px-4 py-4">
              {customer.phone && (
                <li className="flex items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    <Phone className="h-3.5 w-3.5 text-slate-500" />
                  </div>
                  <a href={`tel:${customer.phone}`} className="text-[13px] font-medium text-slate-700 hover:text-orange-600">
                    {customer.phone}
                  </a>
                </li>
              )}
              {customer.email && (
                <li className="flex items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    <Mail className="h-3.5 w-3.5 text-slate-500" />
                  </div>
                  <a href={`mailto:${customer.email}`} className="break-all text-[13px] text-slate-700 hover:text-blue-600">
                    {customer.email}
                  </a>
                </li>
              )}
              {customer.contact_person && (
                <li className="flex items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    <User className="h-3.5 w-3.5 text-slate-500" />
                  </div>
                  <span className="text-[13px] text-slate-700">{customer.contact_person}</span>
                </li>
              )}
              {customer.address && (
                <li className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    <MapPin className="h-3.5 w-3.5 text-slate-500" />
                  </div>
                  <span className="text-[13px] leading-relaxed text-slate-700">{customer.address}</span>
                </li>
              )}
              {customer.notes && (
                <li className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    <FileText className="h-3.5 w-3.5 text-slate-500" />
                  </div>
                  <span className="text-[13px] italic leading-relaxed text-slate-500">{customer.notes}</span>
                </li>
              )}
              <li className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <span className="text-[12px] text-slate-400">Member since {memberSince}</span>
              </li>
            </ul>
          </div>

          {/* Unpaid Orders Alert */}
          {unpaidOrders.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <h2 className="text-[13px] font-semibold text-red-700">
                  {unpaidOrders.length} Unpaid Order{unpaidOrders.length > 1 ? "s" : ""}
                </h2>
              </div>
              <p className="text-[12px] text-red-600 mb-3">
                Total outstanding: <span className="font-bold">{formatCurrency(customer.unpaid_delivered_amount)}</span>
              </p>
              <div className="space-y-1.5">
                {unpaidOrders.slice(0, 3).map(o => (
                  <div key={o.id} className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-medium text-red-700">
                      {o.internal_order_number ?? o.sales_order_number}
                    </span>
                    <StatusBadge status={o.payment_status} type="payment" />
                  </div>
                ))}
                {unpaidOrders.length > 3 && (
                  <p className="text-[11px] text-red-500">+{unpaidOrders.length - 3} more</p>
                )}
              </div>
            </div>
          )}

          {/* Smart Insights */}
          {customer.insights.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  Smart Insights
                </h2>
              </div>
              <ul className="space-y-2 px-4 py-4">
                {customer.insights.map((insight, i) => {
                  const s = INSIGHT_STYLES[insight.type]
                  return (
                    <li key={i} className={cn("flex items-start gap-2.5 rounded-xl border p-3 text-[12px]", s.bg)}>
                      <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", s.dot)} />
                      <span className={s.text}>{insight.message}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Top Items */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
                <Package className="h-4 w-4 text-orange-500" />
                Top Ordered Items
              </h2>
            </div>
            <div className="px-4 py-4">
              <TopItemsChart items={customer.top_items} />
            </div>
          </div>
        </div>

        {/* RIGHT: Order History + Activity */}
        <div className="space-y-4 lg:col-span-3">

          {/* Order History */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900">Order History</h2>
                <p className="mt-0.5 text-[12px] text-slate-400">
                  {customer.total_orders} order{customer.total_orders !== 1 ? "s" : ""} ·{" "}
                  {formatCurrency(customer.lifetime_value)} total value
                </p>
              </div>
              <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[12px] font-semibold text-orange-600">
                {filteredOrders.length} / {customer.orders.length}
              </span>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  placeholder="Search orders…"
                  className="h-8 border-slate-200 bg-white pl-8 text-[13px] focus-visible:border-orange-400 focus-visible:ring-[3px] focus-visible:ring-orange-400/15"
                />
              </div>
              <select
                value={orderStatusFilter}
                onChange={e => setOrderStatusFilter(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 focus:border-orange-400 focus:outline-none focus:ring-[3px] focus:ring-orange-400/15 sm:w-[180px]"
              >
                {ORDER_STATUSES.map(s => (
                  <option key={s} value={s}>{s === "all" ? "All Statuses" : s}</option>
                ))}
              </select>
            </div>

            {/* Table */}
            <div className="[overflow-x:clip]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="sticky top-[68px] z-10 border-b border-slate-200 bg-[#fcf7f2]">
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">#</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">Order No.</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">Status</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">Payment</th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">Items</th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">Value</th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">Date</th>
                    <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-400">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-[13px] text-slate-400">
                        {customer.orders.length === 0 ? "No orders placed yet." : "No orders match your filters."}
                      </td>
                    </tr>
                  )}
                  {filteredOrders.map((order, idx) => {
                    const displayVal = order.requested_payment_amount != null
                      ? Number(order.requested_payment_amount)
                      : Number(order.total_price ?? 0)
                    const isUnpaid = order.payment_status === "Pending"
                      || order.payment_status === "Delivered Unpaid"
                      || order.payment_status === "Partial"
                    return (
                      <tr
                        key={order.id}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-orange-50/50",
                          isUnpaid && "bg-red-50/30",
                          idx % 2 === 1 && !isUnpaid && "bg-slate-50/40"
                        )}
                        onClick={() => window.open(`/dashboard/orders/${order.id}`, "_blank")}
                      >
                        <td className="px-4 py-3 text-[11px] text-slate-300">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            {order.internal_order_number && (
                              <span className="font-mono text-[12px] font-semibold text-slate-800">
                                {order.internal_order_number}
                              </span>
                            )}
                            {order.sales_order_number && (
                              <span className="text-[11px] text-slate-400">{order.sales_order_number}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={order.order_status} type="order" />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={order.payment_status} type="payment" />
                        </td>
                        <td className="px-4 py-3 text-right text-[12px] text-slate-500">
                          {order.item_count > 0 ? order.item_count : "—"}
                        </td>
                        <td className={cn("px-4 py-3 text-right text-[13px] font-semibold", isUnpaid ? "text-red-600" : "text-slate-800")}>
                          {formatCurrency(displayVal)}
                        </td>
                        <td className="px-4 py-3 text-right text-[12px] text-slate-400">
                          {formatRelativeDate(order.created_at)}
                        </td>
                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <Link
                            href={`/dashboard/orders/${order.id}`}
                            target="_blank"
                            className="inline-flex items-center justify-center rounded-md p-1 text-slate-400 transition-colors hover:bg-orange-100 hover:text-orange-600"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer summary */}
            {filteredOrders.length > 0 && (
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-5 py-3">
                <p className="text-[11px] text-slate-400">
                  Click any row to open order · highlighted rows have unpaid dues
                </p>
                <p className="text-[12px] font-semibold text-slate-600">
                  Total: {formatCurrency(filteredOrders.reduce((s, o) => s + (o.requested_payment_amount != null ? Number(o.requested_payment_amount) : Number(o.total_price ?? 0)), 0))}
                </p>
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          {customer.activity_log.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-[15px] font-semibold text-slate-900">Activity Timeline</h2>
                <p className="mt-0.5 text-[12px] text-slate-400">Recent order status changes</p>
              </div>
              <div className="px-5 py-4">
                <div className="relative">
                  <div className="absolute left-[9px] top-2 h-[calc(100%-16px)] w-px bg-slate-200" />
                  <ul className="space-y-4 pl-7">
                    {customer.activity_log.slice(0, 20).map(entry => {
                      const matchedOrder = customer.orders.find(o => o.id === entry.order_id)
                      const orderRef = matchedOrder?.internal_order_number ?? matchedOrder?.sales_order_number ?? null
                      return (
                        <li key={entry.id} className="relative flex flex-col gap-0.5">
                          <span className="absolute -left-7 top-[3px] h-[10px] w-[10px] rounded-full border-2 border-white bg-orange-400 ring-2 ring-orange-100" />
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[12px] font-medium text-slate-700">{describeLogEntry(entry)}</span>
                            <span className="shrink-0 text-[11px] text-slate-400">{formatRelativeDate(entry.created_at)}</span>
                          </div>
                          {orderRef && (
                            <button
                              onClick={() => window.open(`/dashboard/orders/${entry.order_id}`, "_blank")}
                              className="w-fit text-[11px] font-mono text-slate-400 hover:text-orange-500"
                            >
                              {orderRef}
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
