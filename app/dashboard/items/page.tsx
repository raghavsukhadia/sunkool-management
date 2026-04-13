"use client"

import { useState, useEffect, useMemo, useDeferredValue } from "react"
import { useRouter } from "next/navigation"
import {
  Package, Search, X, ChevronRight,
  ArrowUp, ArrowDown, ArrowUpDown,
  CheckCircle2, Clock, Truck, AlertCircle,
  TrendingUp, Users, ShoppingCart,
  RefreshCw, Download, Filter, ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getAllItems, getItemsFilterOptions } from "@/app/actions/items"
import type { ItemSummary, ItemsStats } from "@/app/actions/items"
import { cn } from "@/lib/utils"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return "—"
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d))
}

function relDate(d: string | null) {
  if (!d) return "—"
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 30) return `${days}d ago`
  return fmtDate(d)
}

type SortKey = "item_name" | "total_orders" | "total_quantity" | "total_value" | "last_ordered_at" | "total_remaining"

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

function DispatchBar({ dispatched, total }: { dispatched: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((dispatched / total) * 100)) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn("h-full rounded-full", pct === 100 ? "bg-emerald-500" : pct > 0 ? "bg-blue-500" : "bg-gray-200")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] tabular-nums text-sk-text-3">{pct}%</span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ItemsPage() {
  const router = useRouter()

  const [items, setItems] = useState<ItemSummary[]>([])
  const [stats, setStats] = useState<ItemsStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [customerFilter, setCustomerFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [dispatchFilter, setDispatchFilter] = useState("all")

  const [sortKey, setSortKey] = useState<SortKey>("last_ordered_at")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const [filterOpts, setFilterOpts] = useState<{ customers: Array<{ id: string; name: string }>; categories: string[] }>({
    customers: [], categories: [],
  })

  const deferred = useDeferredValue(search)

  async function load(silent = false) {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const [res, opts] = await Promise.all([getAllItems(), getItemsFilterOptions()])
      if (!res.success) { setError(res.error ?? "Failed to load"); return }
      setItems(res.data ?? [])
      setStats(res.stats)
      setFilterOpts(opts)
    } catch (e: any) {
      setError(e.message ?? "Unexpected error")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    let data = [...items]

    if (deferred.trim()) {
      const q = deferred.toLowerCase()
      data = data.filter(i =>
        i.item_name.toLowerCase().includes(q) ||
        (i.item_sku ?? "").toLowerCase().includes(q) ||
        (i.item_category ?? "").toLowerCase().includes(q) ||
        i.orders.some(o =>
          o.customer_name.toLowerCase().includes(q) ||
          (o.internal_order_number ?? "").toLowerCase().includes(q) ||
          (o.sales_order_number ?? "").toLowerCase().includes(q)
        )
      )
    }
    if (customerFilter !== "all") data = data.filter(i => i.orders.some(o => o.customer_id === customerFilter))
    if (categoryFilter !== "all") data = data.filter(i => i.item_category === categoryFilter)
    if (dispatchFilter !== "all") {
      if (dispatchFilter === "fully_dispatched") data = data.filter(i => i.total_remaining === 0 && i.total_dispatched > 0)
      else if (dispatchFilter === "partial")      data = data.filter(i => i.total_remaining > 0 && i.total_dispatched > 0)
      else if (dispatchFilter === "not_dispatched") data = data.filter(i => i.total_dispatched === 0)
    }

    data.sort((a, b) => {
      let av: any, bv: any
      if      (sortKey === "item_name")       { av = a.item_name;       bv = b.item_name }
      else if (sortKey === "total_orders")    { av = a.total_orders;    bv = b.total_orders }
      else if (sortKey === "total_quantity")  { av = a.total_quantity;  bv = b.total_quantity }
      else if (sortKey === "total_value")     { av = a.total_value;     bv = b.total_value }
      else if (sortKey === "total_remaining") { av = a.total_remaining; bv = b.total_remaining }
      else                                    { av = a.last_ordered_at ?? ""; bv = b.last_ordered_at ?? "" }
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })

    return data
  }, [items, deferred, customerFilter, categoryFilter, dispatchFilter, sortKey, sortDir])

  function handleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(k); setSortDir("desc") }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 opacity-30" />
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-sk-primary" /> : <ArrowDown className="h-3 w-3 text-sk-primary" />
  }

  const activeFilters = [customerFilter !== "all", categoryFilter !== "all", dispatchFilter !== "all"].filter(Boolean).length

  function clearFilters() {
    setCustomerFilter("all"); setCategoryFilter("all"); setDispatchFilter("all"); setSearch("")
  }

  function exportCSV() {
    const rows = [["Item", "SKU", "Category", "Total Orders", "Total Qty", "Dispatched", "Remaining", "Customers", "Total Value", "Last Ordered"]]
    for (const i of filtered) {
      rows.push([
        i.item_name, i.item_sku ?? "", i.item_category ?? "",
        String(i.total_orders), String(i.total_quantity),
        String(i.total_dispatched), String(i.total_remaining),
        [...new Set(i.orders.map(o => o.customer_name))].join("; "),
        String(i.total_value), fmtDate(i.last_ordered_at),
      ])
    }
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    a.download = `items-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />)}
        </div>
        <div className="h-10 animate-pulse rounded-lg bg-gray-100" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-50" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-red-400" />
        <p className="text-[14px] font-medium text-sk-text-1">Failed to load items</p>
        <p className="mt-1 text-[12px] text-sk-text-3">{error}</p>
        <Button onClick={() => load()} className="mt-4 bg-sk-primary text-white hover:bg-sk-primary-dk">Retry</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Unique Items"     value={String(stats?.unique_items ?? 0)}    sub={`${stats?.total_orders ?? 0} total line items`}           icon={Package}      accent="bg-sk-primary/10 text-sk-primary" />
        <StatCard label="Total Quantity"   value={String(stats?.total_quantity ?? 0)}  sub="units across all orders"                                  icon={ShoppingCart} accent="bg-violet-50 text-violet-600" />
        <StatCard label="Pending Dispatch" value={String(stats?.pending_items ?? 0)}   sub={`${stats?.fully_dispatched_items ?? 0} fully dispatched`}  icon={Clock}        accent="bg-amber-50 text-amber-600" />
        <StatCard label="Total Value"      value={fmt(stats?.total_value ?? 0)}        sub="across all orders"                                        icon={TrendingUp}   accent="bg-emerald-50 text-emerald-600" />
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sk-text-3" />
          <Input
            placeholder="Search items, customers, orders…"
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
          {/* Dispatch */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className={cn("h-9 gap-2 text-[13px]", dispatchFilter !== "all" && "border-sk-primary bg-sk-primary/5 text-sk-primary")}>
                <Truck className="h-3.5 w-3.5" />
                {dispatchFilter === "all" ? "Dispatch" : dispatchFilter === "fully_dispatched" ? "Dispatched" : dispatchFilter === "partial" ? "Partial" : "Pending"}
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

          {/* Customer */}
          {filterOpts.customers.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className={cn("h-9 gap-2 text-[13px]", customerFilter !== "all" && "border-sk-primary bg-sk-primary/5 text-sk-primary")}>
                  <Users className="h-3.5 w-3.5" />
                  {customerFilter === "all" ? "Customer" : (filterOpts.customers.find(c => c.id === customerFilter)?.name ?? "Customer")}
                  <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-60 w-52 overflow-y-auto p-1.5">
                <DropdownMenuItem onClick={() => setCustomerFilter("all")}
                  className={cn("text-[13px] rounded-md cursor-pointer", customerFilter === "all" && "bg-sk-primary/10 text-sk-primary font-medium")}>
                  All Customers
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {filterOpts.customers.map(c => (
                  <DropdownMenuItem key={c.id} onClick={() => setCustomerFilter(c.id)}
                    className={cn("text-[13px] rounded-md cursor-pointer", customerFilter === c.id && "bg-sk-primary/10 text-sk-primary font-medium")}>
                    {c.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Category */}
          {filterOpts.categories.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className={cn("h-9 gap-2 text-[13px]", categoryFilter !== "all" && "border-sk-primary bg-sk-primary/5 text-sk-primary")}>
                  <Filter className="h-3.5 w-3.5" />
                  {categoryFilter === "all" ? "Category" : categoryFilter}
                  <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 p-1.5">
                <DropdownMenuItem onClick={() => setCategoryFilter("all")}
                  className={cn("text-[13px] rounded-md cursor-pointer", categoryFilter === "all" && "bg-sk-primary/10 text-sk-primary font-medium")}>
                  All Categories
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {filterOpts.categories.map(c => (
                  <DropdownMenuItem key={c} onClick={() => setCategoryFilter(c)}
                    className={cn("text-[13px] rounded-md cursor-pointer", categoryFilter === c && "bg-sk-primary/10 text-sk-primary font-medium")}>
                    {c}
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

          <Button variant="outline" className="h-9 gap-2 text-[13px]" onClick={exportCSV} disabled={filtered.length === 0}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>
      </div>

      {/* ── Results count ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-sk-text-3">
          <span className="font-semibold text-sk-text-1">{filtered.length}</span> of{" "}
          <span className="font-semibold text-sk-text-1">{items.length}</span> items
        </p>
        {filtered.length > 0 && (
          <p className="text-[12px] text-sk-text-3">
            Total: <span className="font-semibold text-sk-text-1">{fmt(filtered.reduce((s, i) => s + i.total_value, 0))}</span>
          </p>
        )}
      </div>

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-sk-border bg-white py-24 text-center">
          <Package className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-[14px] font-medium text-sk-text-2">No items found</p>
          <p className="mt-1 text-[12px] text-sk-text-3">Try adjusting your search or filters</p>
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
                    { k: "item_name"       as SortKey, l: "Item"         },
                    { k: "total_orders"    as SortKey, l: "Orders"       },
                    { k: "total_quantity"  as SortKey, l: "Total Qty"    },
                    { k: "total_value"     as SortKey, l: "Value"        },
                    { k: "total_remaining" as SortKey, l: "Remaining"    },
                    { k: "last_ordered_at" as SortKey, l: "Last Ordered" },
                  ]).map(col => (
                    <th key={col.k} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">
                      <button onClick={() => handleSort(col.k)} className="flex items-center gap-1.5 hover:text-sk-text-1 transition-colors">
                        {col.l} <SortIcon k={col.k} />
                      </button>
                    </th>
                  ))}
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">Customers</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-sk-border">
                {filtered.map(item => {
                  const uniqueNames = [...new Set(item.orders.map(o => o.customer_name))]
                  return (
                    <tr
                      key={item.item_key}
                      className="group cursor-pointer transition-colors hover:bg-sk-page-bg"
                      onClick={() => router.push(`/dashboard/items/${item.item_key}`)}
                    >
                      {/* Item */}
                      <td className="px-5 py-4">
                        <p className="font-semibold text-sk-text-1 max-w-[220px] truncate">{item.item_name}</p>
                        <div className="mt-0.5 flex flex-wrap gap-1.5">
                          {item.item_sku && <span className="text-[11px] text-sk-text-3">SKU: {item.item_sku}</span>}
                          {item.item_category && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-sk-text-3">{item.item_category}</span>}
                        </div>
                      </td>

                      {/* Orders */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-sk-primary/10 px-2.5 py-0.5 text-[12px] font-bold text-sk-primary">
                          <ShoppingCart className="h-3 w-3" />{item.total_orders}
                        </span>
                      </td>

                      {/* Total qty + progress */}
                      <td className="px-5 py-4">
                        <p className="font-semibold text-sk-text-1">{item.total_quantity}</p>
                        <DispatchBar dispatched={item.total_dispatched} total={item.total_quantity} />
                        <p className="mt-0.5 text-[11px] text-sk-text-3">{item.total_dispatched} sent</p>
                      </td>

                      {/* Value */}
                      <td className="px-5 py-4">
                        <p className="font-semibold text-sk-text-1">{fmt(item.total_value)}</p>
                      </td>

                      {/* Remaining */}
                      <td className="px-5 py-4">
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[12px] font-bold",
                          item.total_remaining === 0
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        )}>
                          {item.total_remaining === 0 ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {item.total_remaining === 0 ? "All sent" : item.total_remaining + " left"}
                        </span>
                      </td>

                      {/* Last ordered */}
                      <td className="px-5 py-4">
                        <p className="text-[13px] text-sk-text-2">{relDate(item.last_ordered_at)}</p>
                        <p className="text-[11px] text-sk-text-3">{fmtDate(item.last_ordered_at)}</p>
                      </td>

                      {/* Customers */}
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1 max-w-[160px]">
                          {uniqueNames.slice(0, 2).map(n => (
                            <span key={n} className="rounded-full border border-sk-border bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-sk-text-2 max-w-[120px] truncate">
                              {n}
                            </span>
                          ))}
                          {uniqueNames.length > 2 && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-sk-text-3">+{uniqueNames.length - 2}</span>
                          )}
                        </div>
                      </td>

                      {/* Arrow */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="text-[11px] font-medium text-sk-primary">Details</span>
                          <ChevronRight className="h-4 w-4 text-sk-primary" />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards ───────────────────────────────────────────────── */}
          <div className="space-y-3 lg:hidden">
            {filtered.map(item => {
              const uniqueNames = [...new Set(item.orders.map(o => o.customer_name))]
              return (
                <div
                  key={item.item_key}
                  className="rounded-xl border border-sk-border bg-white p-4 shadow-sm active:bg-gray-50"
                  onClick={() => router.push(`/dashboard/items/${item.item_key}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sk-text-1 truncate">{item.item_name}</p>
                      {item.item_category && <span className="text-[11px] text-sk-text-3">{item.item_category}</span>}
                    </div>
                    <span className={cn(
                      "shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold",
                      item.total_remaining === 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                    )}>
                      {item.total_remaining > 0 ? `${item.total_remaining} left` : "All sent"}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-sk-page-bg p-2">
                      <p className="text-[9px] text-sk-text-3 uppercase">Orders</p>
                      <p className="text-[14px] font-bold text-sk-primary">{item.total_orders}</p>
                    </div>
                    <div className="rounded-lg bg-sk-page-bg p-2">
                      <p className="text-[9px] text-sk-text-3 uppercase">Qty</p>
                      <p className="text-[14px] font-bold text-sk-text-1">{item.total_dispatched}/{item.total_quantity}</p>
                    </div>
                    <div className="rounded-lg bg-sk-page-bg p-2">
                      <p className="text-[9px] text-sk-text-3 uppercase">Value</p>
                      <p className="text-[14px] font-bold text-sk-text-1">{fmt(item.total_value)}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {uniqueNames.slice(0, 2).map(n => (
                        <span key={n} className="rounded-full border border-sk-border bg-gray-50 px-2 py-0.5 text-[10px] text-sk-text-2">{n}</span>
                      ))}
                      {uniqueNames.length > 2 && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-sk-text-3">+{uniqueNames.length - 2}</span>}
                    </div>
                    <ChevronRight className="h-4 w-4 text-sk-text-3" />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
