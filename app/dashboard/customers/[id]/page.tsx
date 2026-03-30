"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { getCustomerById } from "@/app/actions/customers"
import type { CustomerDetail, OrderLogEntry } from "@/app/actions/customers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  User,
  FileText,
  Calendar,
  AlertCircle,
  TrendingUp,
  Package,
} from "lucide-react"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`
  return `₹${value.toLocaleString("en-IN")}`
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(dateStr))
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

// ─── Badge helpers ─────────────────────────────────────────────────────────

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
  "Paid":    "border-green-200 bg-green-50 text-green-800",
  "Pending": "border-amber-200 bg-amber-50 text-amber-800",
  "Partial": "border-blue-200 bg-blue-50 text-blue-800",
}

const TAG_COLORS: Record<string, string> = {
  "High Value":       "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "Frequent Buyer":   "bg-blue-50 text-blue-700 border border-blue-200",
  "Account Overdue":  "bg-red-50 text-red-700 border border-red-200",
  "New Customer":     "bg-purple-50 text-purple-700 border border-purple-200",
  "Inactive":         "bg-gray-100 text-gray-500 border border-gray-200",
  "No Orders":        "bg-gray-100 text-gray-500 border border-gray-200",
}

function StatusBadge({ status, type }: { status: string; type: "order" | "payment" }) {
  const map = type === "order" ? ORDER_STATUS_COLORS : PAYMENT_STATUS_COLORS
  const cls = map[status] ?? "border-gray-200 bg-gray-50 text-gray-700"
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {status}
    </span>
  )
}

function TagPill({ tag }: { tag: string }) {
  const cls = TAG_COLORS[tag] ?? "bg-gray-100 text-gray-600 border border-gray-200"
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>
      {tag}
    </span>
  )
}

// ─── Activity log event description ──────────────────────────────────────────

function describeLogEntry(entry: OrderLogEntry): string {
  const parts: string[] = []
  if (entry.old_status && entry.new_status && entry.old_status !== entry.new_status) {
    parts.push(`Status: ${entry.old_status} → ${entry.new_status}`)
  } else if (entry.new_status && !entry.old_status) {
    parts.push(`Status set to ${entry.new_status}`)
  }
  if (
    entry.old_payment_status &&
    entry.new_payment_status &&
    entry.old_payment_status !== entry.new_payment_status
  ) {
    parts.push(`Payment: ${entry.old_payment_status} → ${entry.new_payment_status}`)
  } else if (entry.new_payment_status && !entry.old_payment_status) {
    parts.push(`Payment set to ${entry.new_payment_status}`)
  }
  return parts.join(" · ") || "Order updated"
}

// ─── Initials avatar ─────────────────────────────────────────────────────────

function InitialsAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? "")
    .join("")
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xl font-bold text-orange-600">
      {initials}
    </div>
  )
}

// ─── Bar chart ───────────────────────────────────────────────────────────────

function TopItemsChart({ items }: { items: CustomerDetail["top_items"] }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400">No item data available.</p>
  }
  const max = Math.max(...items.map(i => i.total_quantity))
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.item_name}>
          <div className="mb-0.5 flex items-center justify-between">
            <span className="max-w-[70%] truncate text-xs text-gray-700">{item.item_name}</span>
            <span className="text-xs font-semibold text-gray-900">{item.total_quantity} units</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-orange-400"
              style={{ width: `${Math.round((item.total_quantity / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Insight dot color ────────────────────────────────────────────────────────

const INSIGHT_STYLES = {
  warning: { dot: "bg-amber-400", text: "text-amber-700", bg: "bg-amber-50 border-amber-100" },
  success: { dot: "bg-emerald-400", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
  info:    { dot: "bg-blue-400",    text: "text-blue-700",    bg: "bg-blue-50 border-blue-100" },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getCustomerById(id).then(res => {
      if (res.success && res.data) {
        setCustomer(res.data)
      } else {
        setError(res.error ?? "Customer not found")
      }
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-red-500">
        <AlertCircle className="h-5 w-5" />
        <p>{error ?? "Customer not found."}</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/customers")}>
          Back to Customers
        </Button>
      </div>
    )
  }

  const memberSince = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(
    new Date(customer.created_at)
  )

  return (
    <div className="space-y-5 p-4 lg:p-6">
      {/* Back button */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/customers")}
          className="gap-1.5 text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          All Customers
        </Button>
      </div>

      {/* Hero Card */}
      <Card className="border-gray-200 shadow-none">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <InitialsAvatar name={customer.name} />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900">{customer.name}</h1>
              {customer.smart_tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {customer.smart_tags.map(tag => (
                    <TagPill key={tag} tag={tag} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* KPI chips */}
          <div className="mt-4 grid grid-cols-3 divide-x divide-gray-100 rounded-xl border border-gray-100 bg-gray-50">
            <div className="px-4 py-3 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Orders</p>
              <p className="mt-0.5 text-xl font-bold text-gray-900">{customer.total_orders}</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Lifetime Value</p>
              <p className="mt-0.5 text-xl font-bold text-gray-900">{formatCurrency(customer.lifetime_value)}</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Unpaid</p>
              <p className={`mt-0.5 text-xl font-bold ${customer.unpaid_delivered > 0 ? "text-red-600" : "text-gray-900"}`}>
                {customer.unpaid_delivered}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two-column layout */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* LEFT: Contact / Insights / Top Items */}
        <div className="space-y-4 lg:col-span-2">
          {/* Contact Info */}
          <Card className="border-gray-200 shadow-none">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-gray-700">Contact Info</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <ul className="space-y-2.5">
                {customer.phone && (
                  <li className="flex items-start gap-2.5 text-sm">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                    <span className="text-gray-700">{customer.phone}</span>
                  </li>
                )}
                {customer.email && (
                  <li className="flex items-start gap-2.5 text-sm">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                    <span className="break-all text-gray-700">{customer.email}</span>
                  </li>
                )}
                {customer.contact_person && (
                  <li className="flex items-start gap-2.5 text-sm">
                    <User className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                    <span className="text-gray-700">{customer.contact_person}</span>
                  </li>
                )}
                {customer.address && (
                  <li className="flex items-start gap-2.5 text-sm">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                    <span className="text-gray-700">{customer.address}</span>
                  </li>
                )}
                {customer.notes && (
                  <li className="flex items-start gap-2.5 text-sm">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                    <span className="text-gray-600 italic">{customer.notes}</span>
                  </li>
                )}
                <li className="flex items-start gap-2.5 text-sm">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <span className="text-gray-500">Member since {memberSince}</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Smart Insights */}
          {customer.insights.length > 0 && (
            <Card className="border-gray-200 shadow-none">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 px-4">
                <ul className="space-y-2">
                  {customer.insights.map((insight, i) => {
                    const s = INSIGHT_STYLES[insight.type]
                    return (
                      <li
                        key={i}
                        className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-xs ${s.bg}`}
                      >
                        <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
                        <span className={s.text}>{insight.message}</span>
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Top Items */}
          <Card className="border-gray-200 shadow-none">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <Package className="h-4 w-4 text-orange-500" />
                Top Ordered Items
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <TopItemsChart items={customer.top_items} />
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Order History + Activity Timeline */}
        <div className="space-y-4 lg:col-span-3">
          {/* Order History */}
          <Card className="border-gray-200 shadow-none">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-gray-700">Order History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">#</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">Order No.</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">Status</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">Payment</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-400">Value</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-400">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {customer.orders.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                          No orders placed yet.
                        </td>
                      </tr>
                    )}
                    {customer.orders.map((order, idx) => {
                      const displayVal =
                        order.requested_payment_amount != null
                          ? Number(order.requested_payment_amount)
                          : Number(order.total_price ?? 0)
                      return (
                        <tr
                          key={order.id}
                          className="cursor-pointer transition-colors hover:bg-orange-50/40"
                          onClick={() => window.open(`/dashboard/orders/${order.id}`, "_blank")}
                        >
                          <td className="px-4 py-2.5 text-xs text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-col gap-0.5">
                              {order.internal_order_number && (
                                <span className="font-mono text-xs font-semibold text-gray-800">
                                  {order.internal_order_number}
                                </span>
                              )}
                              {order.sales_order_number && (
                                <span className="text-[11px] text-gray-400">{order.sales_order_number}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={order.order_status} type="order" />
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={order.payment_status} type="payment" />
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                            {formatCurrency(displayVal)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs text-gray-400">
                            {formatRelativeDate(order.created_at)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          {customer.activity_log.length > 0 && (
            <Card className="border-gray-200 shadow-none">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold text-gray-700">Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent className="pb-4 px-4">
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[7px] top-2 h-[calc(100%-16px)] w-px bg-gray-200" />
                  <ul className="space-y-4 pl-6">
                    {customer.activity_log.slice(0, 20).map(entry => {
                      // Find order number for display
                      const matchedOrder = customer.orders.find(o => o.id === entry.order_id)
                      const orderRef = matchedOrder?.internal_order_number ?? matchedOrder?.sales_order_number ?? null
                      return (
                        <li key={entry.id} className="relative flex flex-col gap-0.5">
                          <span className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-orange-300 ring-1 ring-orange-200" />
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-medium text-gray-700">
                              {describeLogEntry(entry)}
                            </span>
                            <span className="shrink-0 text-[10px] text-gray-400">
                              {formatRelativeDate(entry.created_at)}
                            </span>
                          </div>
                          {orderRef && (
                            <span className="text-[10px] font-mono text-gray-400">{orderRef}</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
