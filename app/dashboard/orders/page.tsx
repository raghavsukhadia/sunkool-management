"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getAllOrders, getCompletedOrderIds, getOrdersExportData } from "@/app/actions/orders"
import {
  ShoppingCart,
  Plus,
  Search,
  Eye,
  Filter,
  ChevronRight,
  X,
  Calendar,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Download,
} from "lucide-react"
import * as XLSX from "xlsx"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { OrderCardList } from "@/components/orders/OrderCardList"
import { OrderItemsDropdown } from "@/components/orders/OrderItemsDropdown"
import { CustomerFilterDropdown } from "@/components/orders/CustomerFilterDropdown"
import type { OrderLineItemSummary } from "@/app/actions/orders"

interface Order {
  id: string
  internal_order_number: string | null
  sales_order_number: string | null
  order_status: string
  payment_status: string
  total_price: number
  requested_payment_amount?: number | null
  cash_discount: boolean
  created_at: string
  updated_at: string
  item_count: number
  line_items?: OrderLineItemSummary[]
  customers: {
    id: string
    name: string
    email: string | null
    phone: string | null
  } | null
}

function getOrderDisplayTotal(order: Order): number {
  return order.requested_payment_amount != null ? Number(order.requested_payment_amount) : (order.total_price ?? 0)
}

const VALID_STATUSES = ["New Order", "In Progress", "Ready for Dispatch", "Invoiced", "In Transit", "Partial Delivered", "Delivered", "Void"]

export default function OrdersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [showSearchPanel, setShowSearchPanel] = useState(false)
  const [sortBy, setSortBy] = useState<"created_at" | "total_price" | "sales_order_number">("created_at")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [paymentFilter, setPaymentFilter] = useState<string>("all")
  const [completedOrderIds, setCompletedOrderIds] = useState<string[]>([])
  const [completedOnly, setCompletedOnly] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [customerFilter, setCustomerFilter] = useState<"all" | string>("all")

  const uniqueCustomers = useMemo(() => {
    const map = new Map<string, string>()
    for (const o of orders) {
      const c = o.customers
      if (c?.id && c.name) map.set(c.id, c.name)
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
  }, [orders])

  useEffect(() => {
    const status = searchParams.get("status")
    if (status && VALID_STATUSES.includes(status)) {
      setStatusFilter(status)
      setShowSearchPanel(true)
    }
  }, [searchParams])

  useEffect(() => {
    loadOrders()
  }, [])

  const handleExport = async () => {
    const ids = filteredAndSortedOrders.map((o) => o.id)
    if (ids.length === 0) {
      setError("No orders to export")
      return
    }
    setExporting(true)
    setError(null)
    try {
      const res = await getOrdersExportData(ids)
      if (!res.success || !res.data) {
        setError(res.error || "Export failed")
        return
      }
      const headers = [
        "Order Id",
        "Order ID",
        "Timestamp",
        "Dispatched date",
        "Customer Name",
        "Inv No",
        "Order Status",
        "Order",
        "Bill To",
        "Ship To",
        "Card Pic",
        "Docket no",
        "COURIER NAME",
        "Expected Delivered",
      ]
      const rows = res.data.map((r) => [
        r.internal_order_number ?? "",
        r.sales_order_number ?? "",
        r.created_at,
        r.dispatch_date,
        r.customer_name,
        r.invoice_number ?? "",
        r.order_status,
        r.item_details,
        r.bill_to,
        r.ship_to,
        r.card_pic,
        r.tracking_id ?? "",
        r.courier_name,
        r.expected_delivered,
      ])
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Orders")
      const date = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `orders-export-${date}.xlsx`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Export failed")
    } finally {
      setExporting(false)
    }
  }

  const loadOrders = async () => {
    setLoading(true)
    setError(null)
    try {
      const [ordersResult, completedResult] = await Promise.all([
        getAllOrders(),
        getCompletedOrderIds(),
      ])
      if (ordersResult.success && ordersResult.data) {
        setOrders(ordersResult.data as unknown as Order[])
      } else {
        setError(ordersResult.error || "Failed to load orders")
      }
      if (completedResult.success && completedResult.data) {
        setCompletedOrderIds(completedResult.data)
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort orders
  const filteredAndSortedOrders = (() => {
    let filtered = [...orders]

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = orders.filter(order =>
        order.internal_order_number?.toLowerCase().includes(term) ||
        order.sales_order_number?.toLowerCase().includes(term) ||
        order.customers?.name.toLowerCase().includes(term) ||
        order.customers?.email?.toLowerCase().includes(term) ||
        order.customers?.phone?.toLowerCase().includes(term) ||
        order.id.toLowerCase().includes(term)
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(order => order.order_status === statusFilter)
    }

    // Payment status filter
    if (paymentFilter !== "all") {
      filtered = filtered.filter(order => order.payment_status === paymentFilter)
    }

    // Customer filter
    if (customerFilter !== "all") {
      filtered = filtered.filter((order) => order.customers?.id === customerFilter)
    }

    // Completed filter: default "All Orders" excludes completed; clicking "Completed" shows only completed
    const completedSet = new Set(completedOrderIds)
    if (completedOnly) {
      filtered = filtered.filter(order => completedSet.has(order.id))
    } else {
      filtered = filtered.filter(order => !completedSet.has(order.id))
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any
      let bVal: any

      switch (sortBy) {
        case "created_at":
          aVal = new Date(a.created_at).getTime()
          bVal = new Date(b.created_at).getTime()
          break
        case "total_price":
          aVal = a.total_price || 0
          bVal = b.total_price || 0
          break
        case "sales_order_number":
          aVal = a.sales_order_number || ""
          bVal = b.sales_order_number || ""
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1
      return 0
    })

    return filtered
  })()

  const getStatusColor = (status: string) => {
    switch (status) {
      case "New Order":
        return "border-yellow-200 bg-yellow-50 text-yellow-800"
      case "In Progress":
        return "border-purple-200 bg-purple-50 text-purple-800"
      case "Ready for Dispatch":
        return "border-orange-200 bg-orange-50 text-orange-800"
      case "Invoiced":
        return "border-cyan-200 bg-cyan-50 text-cyan-800"
      case "In Transit":
        return "border-sky-200 bg-sky-50 text-sky-800"
      case "Partial Delivered":
        return "border-teal-200 bg-teal-50 text-teal-800"
      case "Delivered":
        return "border-emerald-200 bg-emerald-50 text-emerald-800"
      case "Void":
        return "border-red-200 bg-red-50 text-red-800"
      default:
        return "border-slate-200 bg-slate-50 text-slate-700"
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "Paid":
        return "border-green-200 bg-green-50 text-green-800"
      case "Pending":
        return "border-amber-200 bg-amber-50 text-amber-800"
      case "Delivered Unpaid":
        return "border-orange-200 bg-orange-50 text-orange-800"
      case "Partial":
        return "border-blue-200 bg-blue-50 text-blue-800"
      case "Refunded":
        return "border-red-200 bg-red-50 text-red-800"
      default:
        return "border-slate-200 bg-slate-50 text-slate-700"
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-sk-primary"></div>
          <p className="text-sk-text-2">Loading orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-8 lg:space-y-6">
      {/* Header - desktop */}
      <div className="hidden border-b border-sk-border pb-4 lg:flex lg:items-end lg:justify-between lg:gap-4">
        <div className="space-y-3">
          <div className="h-1 w-14 rounded-full bg-sk-primary" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-sk-text-1">All Orders</h1>
            <p className="mt-1.5 text-sm text-sk-text-2">Manage and track all orders across the pipeline.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleExport}
            disabled={exporting}
            variant="outline"
            className="gap-2 border-sk-border bg-white text-sk-text-1 hover:bg-sk-page-bg"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Exporting..." : "Export"}
          </Button>
          <Button onClick={() => router.push("/dashboard/orders/new")} className="gap-2 px-4">
            <Plus className="w-4 h-4 mr-2" />
            New Order
          </Button>
        </div>
      </div>

      {/* Header - mobile: title + Filter + New Order */}
      <div className="flex items-center justify-between gap-3 border-b border-sk-border pb-3 lg:hidden">
        <div className="min-w-0">
          <div className="mb-2 h-1 w-10 rounded-full bg-sk-primary" />
          <h1 className="text-xl font-semibold tracking-tight text-sk-text-1">Orders</h1>
          <p className="truncate text-sm text-sk-text-2">{filteredAndSortedOrders.length} orders</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="min-h-[44px] gap-2 border-sk-border bg-white text-sk-text-1 hover:bg-sk-page-bg">
                <Filter className="w-4 h-4" />
                Filter
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl border-sk-border bg-white">
              <SheetHeader>
                <SheetTitle>Filter & sort</SheetTitle>
                <SheetDescription className="sr-only">
                  Filter and sort orders by customer, status, payment, and date.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-5 pb-8">
                <div>
                  <Label className="text-sm font-semibold text-sk-text-1">Search</Label>
                  <div className="relative mt-1.5">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sk-text-3 w-4 h-4" />
                    <Input
                      placeholder="Order #, customer, email, phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-11 border-sk-border bg-white pl-9 focus-visible:ring-sk-primary"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-sk-text-1">Order Status</Label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="mt-1.5 flex h-11 w-full rounded-md border border-sk-border bg-white px-3 py-2 text-base text-sk-text-1 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-sk-primary focus-visible:ring-offset-2"
                  >
                    <option value="all">All Statuses</option>
                    {VALID_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-sk-text-1">Payment Status</Label>
                  <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    className="mt-1.5 flex h-11 w-full rounded-md border border-sk-border bg-white px-3 py-2 text-base text-sk-text-1 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-sk-primary focus-visible:ring-offset-2"
                  >
                    <option value="all">All</option>
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                    <option value="Partial">Partial</option>
                    <option value="Delivered Unpaid">Delivered Unpaid</option>
                    <option value="Refunded">Refunded</option>
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-sk-text-1">Customer</Label>
                  <div className="mt-1.5">
                    <CustomerFilterDropdown
                      customers={uniqueCustomers}
                      value={customerFilter}
                      onChange={setCustomerFilter}
                      className="min-h-11 h-11"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-semibold text-sk-text-1">Sort by</Label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as "created_at" | "total_price" | "sales_order_number")}
                      className="mt-1.5 flex h-11 w-full rounded-md border border-sk-border bg-white px-3 py-2 text-base text-sk-text-1 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-sk-primary focus-visible:ring-offset-2"
                    >
                      <option value="created_at">Date</option>
                      <option value="total_price">Amount</option>
                      <option value="sales_order_number">Order #</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-sk-text-1">Order</Label>
                    <select
                      value={sortDirection}
                      onChange={(e) => setSortDirection(e.target.value as "asc" | "desc")}
                      className="mt-1.5 flex h-11 w-full rounded-md border border-sk-border bg-white px-3 py-2 text-base text-sk-text-1 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-sk-primary focus-visible:ring-offset-2"
                    >
                      <option value="desc">Newest first</option>
                      <option value="asc">Oldest first</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCompletedOnly((prev) => !prev)}
                  className={`w-full text-left p-4 rounded-xl border min-h-[44px] ${
                    completedOnly ? "border-green-200 bg-green-50" : "border-sk-border bg-sk-page-bg"
                  }`}
                >
                  <span className="font-medium text-sk-text-1">Completed only</span>
                  <span className="mt-0.5 block text-sm text-sk-text-2">
                    {completedOrderIds.length} completed · {completedOnly ? "Showing completed" : "Tap to show"}
                  </span>
                </button>
                <Button className="w-full min-h-[44px]" onClick={() => setFilterSheetOpen(false)}>
                  Done
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <Button onClick={() => router.push("/dashboard/orders/new")} className="min-h-[44px] gap-2">
            <Plus className="w-4 h-4" />
            New
          </Button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center justify-between rounded-r-md border-l-4 border-red-500 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filter Panel - desktop only */}
      <Card className="hidden border border-sk-border bg-white lg:block">
        <CardHeader className="border-b border-sk-border bg-[#fcf7f2] pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="rounded-md bg-sk-primary-tint p-1.5">
                <Filter className="w-4 h-4 text-sk-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-sk-text-1">Search & Filter</CardTitle>
                <CardDescription className="mt-1 text-sm text-sk-text-2">Refine orders by customer, status, payment state, and sort order.</CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSearchPanel(!showSearchPanel)}
              className="flex items-center gap-1.5 text-sk-text-2 hover:bg-sk-page-bg hover:text-sk-text-1"
            >
              {showSearchPanel ? "Hide" : "Show"} Options
              {showSearchPanel ? <ChevronRight className="w-4 h-4 rotate-90" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-sk-text-3 w-4 h-4" />
            <Input
              placeholder="Search by order number, customer name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 border-sk-border bg-white pl-10 pr-10 text-sm focus-visible:ring-sk-primary"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 rounded p-1 text-sk-text-3 transition-colors hover:bg-sk-page-bg hover:text-sk-text-2"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {showSearchPanel && (
            <div className="space-y-5 border-t border-sk-border pt-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="mb-3 block text-sm font-semibold text-sk-text-1">Order Status</Label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-sk-border bg-white px-3 py-2 text-sm text-sk-text-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sk-primary focus-visible:ring-offset-2"
                  >
                    <option value="all">All Statuses</option>
                    <option value="New Order">New Order</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Ready for Dispatch">Ready for Dispatch</option>
                    <option value="Invoiced">Invoiced</option>
                    <option value="In Transit">In Transit</option>
                    <option value="Partial Delivered">Partial Delivered</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Void">Void</option>
                  </select>
                </div>
                <div>
                  <Label className="mb-3 block text-sm font-semibold text-sk-text-1">Payment Status</Label>
                  <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-sk-border bg-white px-3 py-2 text-sm text-sk-text-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sk-primary focus-visible:ring-offset-2"
                  >
                    <option value="all">All Payment Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                    <option value="Partial">Partial</option>
                    <option value="Delivered Unpaid">Delivered Unpaid</option>
                    <option value="Refunded">Refunded</option>
                  </select>
                </div>
                <div>
                  <Label className="mb-3 block text-sm font-semibold text-sk-text-1">Customer</Label>
                  <CustomerFilterDropdown
                    customers={uniqueCustomers}
                    value={customerFilter}
                    onChange={setCustomerFilter}
                    className="h-10"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-3">
                <div className="rounded-xl border border-sk-border bg-[#fcf7f2] p-4 text-center">
                  <div className="text-3xl font-semibold text-sk-text-1">{filteredAndSortedOrders.length}</div>
                  <div className="mt-1.5 text-xs font-medium uppercase tracking-[0.16em] text-sk-text-3">Filtered Orders</div>
                </div>
                <button
                  type="button"
                  onClick={() => setCompletedOnly((prev) => !prev)}
                  className={`w-full cursor-pointer rounded-xl border p-4 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 ${
                    completedOnly
                      ? "border-green-300 bg-green-50 ring-2 ring-green-400"
                      : "border-green-200 bg-white hover:bg-green-50"
                  }`}
                >
                  <div className="text-3xl font-bold text-green-700">{completedOrderIds.length}</div>
                  <div className="mt-1.5 text-xs font-medium uppercase tracking-[0.16em] text-sk-text-3">Completed</div>
                  {completedOnly && (
                    <div className="text-xs text-green-700 mt-1 font-medium">Showing completed only · click to clear</div>
                  )}
                </button>
                <div className="rounded-xl border border-sk-border bg-white p-4 text-center">
                  <div className="text-3xl font-semibold text-sk-text-1">
                    ₹{filteredAndSortedOrders.reduce((sum, o) => sum + getOrderDisplayTotal(o), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="mt-1.5 text-xs font-medium uppercase tracking-[0.16em] text-sk-text-3">Total Value</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders - mobile: card list */}
      <div className="lg:hidden">
        {filteredAndSortedOrders.length === 0 ? (
          <div className="rounded-xl border border-sk-border bg-white px-4 py-12 text-center">
            <ShoppingCart className="mx-auto mb-3 h-12 w-12 text-sk-text-3" />
            <p className="font-medium text-sk-text-2">
              {completedOnly
                ? "No completed orders match your filters"
                : searchTerm || statusFilter !== "all" || paymentFilter !== "all"
                  ? "No orders match your filters"
                  : completedOrderIds.length > 0
                    ? "All orders are completed"
                    : "No orders yet"}
            </p>
            {!searchTerm && statusFilter === "all" && paymentFilter === "all" && !completedOnly && completedOrderIds.length === 0 && (
              <Button onClick={() => router.push("/dashboard/orders/new")} className="mt-4 min-h-[44px]">
                <Plus className="w-4 h-4 mr-2" />
                Create New Order
              </Button>
            )}
          </div>
        ) : (
          <OrderCardList data={filteredAndSortedOrders} />
        )}
      </div>

      {/* Orders Table - desktop only */}
      <Card className="hidden border border-sk-border bg-white lg:block">
        <CardHeader className="border-b border-sk-border bg-[#fcf7f2]">
          <CardTitle className="flex items-center gap-2.5 text-lg font-semibold text-sk-text-1">
            <div className="rounded-md bg-sk-primary-tint p-1.5">
              <ShoppingCart className="w-4 h-4 text-sk-primary" />
            </div>
            Orders
            <span className="ml-1 text-sm font-normal text-sk-text-2">
              ({filteredAndSortedOrders.length})
            </span>
          </CardTitle>
          <CardDescription className="mt-1.5 flex flex-wrap items-center gap-2 text-sk-text-2">
            {completedOnly ? (
              <>Click any row to view details. <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-800">Showing completed only</span></>
            ) : (
              <>In-progress orders only. Click the <strong>Completed</strong> card above to see {completedOrderIds.length} finished order{completedOrderIds.length !== 1 ? "s" : ""}.</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredAndSortedOrders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="mx-auto mb-3 h-12 w-12 text-sk-text-3" />
              <p className="font-medium text-sk-text-2">
                {completedOnly
                  ? "No completed orders match your filters"
                  : searchTerm || statusFilter !== "all" || paymentFilter !== "all"
                    ? "No orders match your filters"
                    : completedOrderIds.length > 0
                      ? "All orders are completed"
                      : "No orders yet"}
              </p>
              <p className="mt-1 text-sm text-sk-text-3">
                {completedOnly
                  ? "Completed = all items produced, all delivered, full amount paid."
                  : searchTerm || statusFilter !== "all" || paymentFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : completedOrderIds.length > 0
                      ? "Click the Completed card above to see finished orders."
                      : "Create your first order to get started"}
              </p>
              {!searchTerm && statusFilter === "all" && paymentFilter === "all" && !completedOnly && completedOrderIds.length === 0 && (
                <Button onClick={() => router.push("/dashboard/orders/new")} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Order
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-sk-border bg-[#fcf7f2]">
                    <th className="px-8 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-sk-text-3">
                      <button
                        onClick={() => {
                          if (sortBy === "sales_order_number") {
                            setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                          } else {
                            setSortBy("sales_order_number")
                            setSortDirection("asc")
                          }
                        }}
                        className="group flex items-center gap-1.5 transition-colors hover:text-sk-text-1"
                      >
                        Order #
                        {sortBy === "sales_order_number" ? (
                          sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5 text-sk-primary" /> : <ArrowDown className="h-3.5 w-3.5 text-sk-primary" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-sk-text-3 group-hover:text-sk-text-2" />
                        )}
                      </button>
                    </th>
                    <th className="px-8 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-sk-text-3">Customer</th>
                    <th className="px-8 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-sk-text-3">Items</th>
                    <th className="px-8 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-sk-text-3">Order Status</th>
                    <th className="px-8 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-sk-text-3">Payment Status</th>
                    <th className="px-8 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-sk-text-3">
                      <button
                        onClick={() => {
                          if (sortBy === "total_price") {
                            setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                          } else {
                            setSortBy("total_price")
                            setSortDirection("desc")
                          }
                        }}
                        className="group flex items-center gap-1.5 transition-colors hover:text-sk-text-1"
                      >
                        Total
                        {sortBy === "total_price" ? (
                          sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5 text-sk-primary" /> : <ArrowDown className="h-3.5 w-3.5 text-sk-primary" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-sk-text-3 group-hover:text-sk-text-2" />
                        )}
                      </button>
                    </th>
                    <th className="px-8 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-sk-text-3">
                      <button
                        onClick={() => {
                          if (sortBy === "created_at") {
                            setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                          } else {
                            setSortBy("created_at")
                            setSortDirection("desc")
                          }
                        }}
                        className="group flex items-center gap-1.5 transition-colors hover:text-sk-text-1"
                      >
                        Date
                        {sortBy === "created_at" ? (
                          sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5 text-sk-primary" /> : <ArrowDown className="h-3.5 w-3.5 text-sk-primary" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-sk-text-3 group-hover:text-sk-text-2" />
                        )}
                      </button>
                    </th>
                    <th className="px-8 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-sk-text-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedOrders.map((order, index) => (
                    <tr
                      key={order.id}
                      className={`cursor-pointer border-b border-sk-border transition-colors hover:bg-sk-page-bg ${index % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}
                      onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                    >
                      <td className="px-8 py-5 align-middle">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-sk-text-1">
                            {order.internal_order_number || order.sales_order_number || `#${order.id.slice(0, 8)}`}
                          </span>
                          {order.sales_order_number && order.internal_order_number && (
                            <span className="mt-0.5 text-xs text-sk-text-2">Sales: {order.sales_order_number}</span>
                          )}
                          {order.cash_discount && (
                            <span className="mt-1 inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">Cash Discount</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5 align-middle">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-sk-text-1">
                            {order.customers?.name || "N/A"}
                          </span>
                          {order.customers?.email && (
                            <span className="mt-0.5 text-xs text-sk-text-2">{order.customers.email}</span>
                          )}
                          {order.customers?.phone && (
                            <span className="mt-0.5 text-xs text-sk-text-3">{order.customers.phone}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5 align-middle" onClick={(e) => e.stopPropagation()}>
                        <OrderItemsDropdown
                          orderId={order.id}
                          count={order.item_count || 0}
                        />
                      </td>
                      <td className="px-8 py-5 align-middle">
                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${getStatusColor(order.order_status)}`}>
                          {order.order_status}
                        </span>
                      </td>
                      <td className="px-8 py-5 align-middle">
                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${getPaymentStatusColor(order.payment_status)}`}>
                          {order.payment_status}
                        </span>
                      </td>
                      <td className="px-8 py-5 align-middle">
                        <span className="text-sm font-semibold text-sk-text-1">
                          ₹{getOrderDisplayTotal(order).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-8 py-5 align-middle">
                        <div className="flex flex-col">
                          <span className="text-sm text-sk-text-1">
                            {new Date(order.created_at).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-sk-text-3">
                            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5 align-middle">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/dashboard/orders/${order.id}`)
                          }}
                          className="h-9 w-9 rounded-full border border-transparent p-0 text-sk-text-2 hover:border-sk-border hover:bg-white hover:text-sk-primary"
                          aria-label={`View ${order.internal_order_number || order.sales_order_number || order.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
