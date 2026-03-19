"use client"

import { useState, useEffect } from "react"
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

const VALID_STATUSES = ["New Order", "In Progress", "Ready for Dispatch", "Invoiced", "In Transit", "Delivered", "Void"]

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
        setOrders(ordersResult.data as any as Order[])
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
        return "bg-yellow-100 text-yellow-800"
      case "In Progress":
        return "bg-purple-100 text-purple-800"
      case "Ready for Dispatch":
        return "bg-orange-100 text-orange-800"
      case "Invoiced":
        return "bg-blue-100 text-blue-800"
      case "In Transit":
        return "bg-indigo-100 text-indigo-800"
      case "Delivered":
        return "bg-emerald-100 text-emerald-800"
      case "Void":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-800"
      case "Pending":
        return "bg-yellow-100 text-yellow-800"
      case "Delivered Unpaid":
        return "bg-orange-100 text-orange-800"
      case "Partial":
        return "bg-blue-100 text-blue-800"
      case "Refunded":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
          <p className="text-gray-500">Loading orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 lg:space-y-6 pb-8">
      {/* Header - desktop */}
      <div className="hidden lg:flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">All Orders</h1>
          <p className="text-gray-600 mt-1.5 text-sm">Manage and track all orders</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleExport}
            disabled={exporting}
            variant="outline"
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Exporting..." : "Export"}
          </Button>
          <Button
            onClick={() => router.push("/dashboard/orders/new")}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Order
          </Button>
        </div>
      </div>

      {/* Header - mobile: title + Filter + New Order */}
      <div className="lg:hidden flex items-center justify-between gap-3 pb-2">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Orders</h1>
          <p className="text-gray-500 text-sm truncate">{filteredAndSortedOrders.length} orders</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="min-h-[44px] gap-2">
                <Filter className="w-4 h-4" />
                Filter
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>Filter & sort</SheetTitle>
                <SheetDescription className="sr-only">
                  Filter and sort orders by status, payment, and date.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-5 pb-8">
                <div>
                  <Label className="text-sm font-semibold text-gray-700">Search</Label>
                  <div className="relative mt-1.5">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Order #, customer, email, phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-11"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-700">Order Status</Label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="mt-1.5 flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base"
                  >
                    <option value="all">All Statuses</option>
                    {VALID_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-700">Payment Status</Label>
                  <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    className="mt-1.5 flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base"
                  >
                    <option value="all">All</option>
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                    <option value="Partial">Partial</option>
                    <option value="Delivered Unpaid">Delivered Unpaid</option>
                    <option value="Refunded">Refunded</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-semibold text-gray-700">Sort by</Label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as "created_at" | "total_price" | "sales_order_number")}
                      className="mt-1.5 flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base"
                    >
                      <option value="created_at">Date</option>
                      <option value="total_price">Amount</option>
                      <option value="sales_order_number">Order #</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-gray-700">Order</Label>
                    <select
                      value={sortDirection}
                      onChange={(e) => setSortDirection(e.target.value as "asc" | "desc")}
                      className="mt-1.5 flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base"
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
                    completedOnly ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <span className="font-medium text-gray-900">Completed only</span>
                  <span className="block text-sm text-gray-500 mt-0.5">
                    {completedOrderIds.length} completed · {completedOnly ? "Showing completed" : "Tap to show"}
                  </span>
                </button>
                <Button
                  className="w-full min-h-[44px] bg-amber-500 hover:bg-amber-600 text-slate-900"
                  onClick={() => setFilterSheetOpen(false)}
                >
                  Done
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <Button
            onClick={() => router.push("/dashboard/orders/new")}
            className="min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            <Plus className="w-4 h-4" />
            New
          </Button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-50 border-l-4 border-red-500 rounded-r-md flex items-center justify-between shadow-sm">
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
      <Card className="hidden lg:block shadow-sm">
        <CardHeader className="pb-4 bg-gray-50 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-blue-100 rounded-md">
                <Filter className="w-4 h-4 text-blue-600" />
              </div>
              <CardTitle className="text-lg font-semibold text-gray-900">Search & Filter</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSearchPanel(!showSearchPanel)}
              className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              {showSearchPanel ? "Hide" : "Show"} Options
              {showSearchPanel ? <ChevronRight className="w-4 h-4 rotate-90" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by order number, customer name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10 h-11 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {showSearchPanel && (
            <div className="pt-5 border-t border-gray-200 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold mb-3 block text-gray-700">Order Status</Label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    <option value="all">All Statuses</option>
                    <option value="New Order">New Order</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Ready for Dispatch">Ready for Dispatch</option>
                    <option value="Invoiced">Invoiced</option>
                    <option value="In Transit">In Transit</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Void">Void</option>
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-semibold mb-3 block text-gray-700">Payment Status</Label>
                  <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    <option value="all">All Payment Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                    <option value="Partial">Partial</option>
                    <option value="Delivered Unpaid">Delivered Unpaid</option>
                    <option value="Refunded">Refunded</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-3">
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                  <div className="text-3xl font-bold text-blue-700">{filteredAndSortedOrders.length}</div>
                  <div className="text-xs font-medium text-gray-600 mt-1.5">Filtered Orders</div>
                </div>
                <button
                  type="button"
                  onClick={() => setCompletedOnly((prev) => !prev)}
                  className={`text-center w-full p-4 rounded-lg border transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 ${
                    completedOnly
                      ? "bg-gradient-to-br from-green-100 to-emerald-100 border-green-300 ring-2 ring-green-400"
                      : "bg-gradient-to-br from-green-50 to-emerald-50 border-green-100 hover:from-green-100 hover:to-emerald-100"
                  }`}
                >
                  <div className="text-3xl font-bold text-green-700">{completedOrderIds.length}</div>
                  <div className="text-xs font-medium text-gray-600 mt-1.5">Completed</div>
                  {completedOnly && (
                    <div className="text-xs text-green-700 mt-1 font-medium">Showing completed only · click to clear</div>
                  )}
                </button>
                <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-100">
                  <div className="text-3xl font-bold text-purple-700">
                    ₹{filteredAndSortedOrders.reduce((sum, o) => sum + getOrderDisplayTotal(o), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs font-medium text-gray-600 mt-1.5">Total Value</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders - mobile: card list */}
      <div className="lg:hidden">
        {filteredAndSortedOrders.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-xl border border-slate-200 bg-white">
            <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              {completedOnly
                ? "No completed orders match your filters"
                : searchTerm || statusFilter !== "all" || paymentFilter !== "all"
                  ? "No orders match your filters"
                  : completedOrderIds.length > 0
                    ? "All orders are completed"
                    : "No orders yet"}
            </p>
            {!searchTerm && statusFilter === "all" && paymentFilter === "all" && !completedOnly && completedOrderIds.length === 0 && (
              <Button
                onClick={() => router.push("/dashboard/orders/new")}
                className="mt-4 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white"
              >
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
      <Card className="hidden lg:block shadow-sm">
        <CardHeader className="bg-gray-50 border-b">
          <CardTitle className="flex items-center gap-2.5 text-lg font-semibold text-gray-900">
            <div className="p-1.5 bg-blue-100 rounded-md">
              <ShoppingCart className="w-4 h-4 text-blue-600" />
            </div>
            Orders
            <span className="text-sm font-normal text-gray-500 ml-1">
              ({filteredAndSortedOrders.length})
            </span>
          </CardTitle>
          <CardDescription className="mt-1.5 flex items-center gap-2 flex-wrap">
            {completedOnly ? (
              <>Click on any order to view details. <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Showing completed only</span></>
            ) : (
              <>In-progress orders only. Click the <strong>Completed</strong> card above to see {completedOrderIds.length} finished order{completedOrderIds.length !== 1 ? "s" : ""}.</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredAndSortedOrders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                {completedOnly
                  ? "No completed orders match your filters"
                  : searchTerm || statusFilter !== "all" || paymentFilter !== "all"
                    ? "No orders match your filters"
                    : completedOrderIds.length > 0
                      ? "All orders are completed"
                      : "No orders yet"}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {completedOnly
                  ? "Completed = all items produced, all delivered, full amount paid."
                  : searchTerm || statusFilter !== "all" || paymentFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : completedOrderIds.length > 0
                      ? "Click the Completed card above to see finished orders."
                      : "Create your first order to get started"}
              </p>
              {!searchTerm && statusFilter === "all" && paymentFilter === "all" && !completedOnly && completedOrderIds.length === 0 && (
                <Button
                  onClick={() => router.push("/dashboard/orders/new")}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Order
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50/50">
                    <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">
                      <button
                        onClick={() => {
                          if (sortBy === "sales_order_number") {
                            setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                          } else {
                            setSortBy("sales_order_number")
                            setSortDirection("asc")
                          }
                        }}
                        className="flex items-center gap-1.5 hover:text-gray-900 transition-colors group"
                      >
                        Order #
                        {sortBy === "sales_order_number" ? (
                          sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
                        )}
                      </button>
                    </th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Customer</th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Items</th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Order Status</th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Payment Status</th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">
                      <button
                        onClick={() => {
                          if (sortBy === "total_price") {
                            setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                          } else {
                            setSortBy("total_price")
                            setSortDirection("desc")
                          }
                        }}
                        className="flex items-center gap-1.5 hover:text-gray-900 transition-colors group"
                      >
                        Total
                        {sortBy === "total_price" ? (
                          sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
                        )}
                      </button>
                    </th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">
                      <button
                        onClick={() => {
                          if (sortBy === "created_at") {
                            setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                          } else {
                            setSortBy("created_at")
                            setSortDirection("desc")
                          }
                        }}
                        className="flex items-center gap-1.5 hover:text-gray-900 transition-colors group"
                      >
                        Date
                        {sortBy === "created_at" ? (
                          sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
                        )}
                      </button>
                    </th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b hover:bg-blue-50/30 transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                    >
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {order.internal_order_number || order.sales_order_number || `#${order.id.slice(0, 8)}`}
                          </span>
                          {order.sales_order_number && order.internal_order_number && (
                            <span className="text-xs text-gray-500 mt-0.5">Sales: {order.sales_order_number}</span>
                          )}
                          {order.cash_discount && (
                            <span className="text-xs text-yellow-600 mt-0.5">Cash Discount</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {order.customers?.name || "N/A"}
                          </span>
                          {order.customers?.email && (
                            <span className="text-xs text-gray-500 mt-0.5">{order.customers.email}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-gray-700">{order.item_count || 0}</span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.order_status)}`}>
                          {order.order_status}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(order.payment_status)}`}>
                          {order.payment_status}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-semibold text-gray-900">
                          ₹{getOrderDisplayTotal(order).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-700">
                            {new Date(order.created_at).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/dashboard/orders/${order.id}`)
                          }}
                          className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
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
