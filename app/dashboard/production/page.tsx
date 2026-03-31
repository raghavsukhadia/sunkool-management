"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Package, Clock, CheckCircle, ExternalLink, Printer, Activity, Search, Maximize2, Minimize2, ChevronRight, X } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  getProductionQueue,
  getProductionItems,
  getProductionRecordsList,
  type ProductionQueueRow,
  type ProductionQueueResult,
} from "@/app/actions/production"
import {
  getStockPrediction,
  getFastSlowMoving,
  getDeadStock,
  type StockPredictionRow,
  type FastSlowRow,
  type DeadStockRow,
} from "@/app/actions/inventory-health"
import { OrderJourneySheet } from "@/components/production/OrderJourneySheet"

interface ProductionItem {
  id: string
  order_id: string
  orders: {
    internal_order_number: string
    sales_order_number?: string
    customers: {
      name: string
    }
  }
  inventory_items: {
    name: string
    serial_number?: string
  }
  quantity: number
  dispatched_quantity: number
}

interface ProductionRecord {
  id: string
  production_number: string
  production_type: string
  status: string
  created_at: string
  dispatches: {
    order_id: string
    orders: {
      internal_order_number: string
    }
  }[]
}

type QueueStatusFilter = "All" | "Pending" | "In Progress" | "Completed"

export default function ProductionPage() {
  const [productionItems, setProductionItems] = useState<ProductionItem[]>([])
  const [productionRecords, setProductionRecords] = useState<ProductionRecord[]>([])
  const [queueData, setQueueData] = useState<ProductionQueueResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"pending" | "needed" | "inventory-health">("pending")
  const [inventoryHealthView, setInventoryHealthView] = useState<"stock-prediction" | "fast-slow" | "dead-stock">("stock-prediction")
  const [inventoryHealthDays, setInventoryHealthDays] = useState<7 | 30 | 90>(30)
  const [inventoryHealthSearch, setInventoryHealthSearch] = useState("")
  const [stockPredictionData, setStockPredictionData] = useState<StockPredictionRow[]>([])
  const [fastSlowData, setFastSlowData] = useState<FastSlowRow[]>([])
  const [deadStockData, setDeadStockData] = useState<DeadStockRow[]>([])
  const [inventoryHealthLoading, setInventoryHealthLoading] = useState(false)
  const [isNeededFullscreen, setIsNeededFullscreen] = useState(false)
  const [neededLastUpdated, setNeededLastUpdated] = useState<Date | null>(null)
  const [queueSearch, setQueueSearch] = useState("")
  const [queueStatusFilter, setQueueStatusFilter] = useState<QueueStatusFilter>("All")
  const [queueCustomerFilter, setQueueCustomerFilter] = useState("")
  const [queueItemFilter, setQueueItemFilter] = useState("")
  const [useDefaultOpenOnlyFilter, setUseDefaultOpenOnlyFilter] = useState(true)
  const [selectedRow, setSelectedRow] = useState<ProductionQueueRow | null>(null)
  const [journeyOpen, setJourneyOpen] = useState(false)
  const neededFullscreenRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [queueRes, itemsRes, recordsRes] = await Promise.all([
          getProductionQueue(),
          getProductionItems(),
          getProductionRecordsList(),
        ])
        if (queueRes.success) setQueueData(queueRes.data)
        if (itemsRes.success) setProductionItems(itemsRes.data as ProductionItem[])
        if (recordsRes.success) setProductionRecords(recordsRes.data as ProductionRecord[])
        setNeededLastUpdated(new Date())
      } catch (error) {
        console.error("Error fetching production data:", error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    const onFullscreenChange = () => setIsNeededFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [])

  useEffect(() => {
    if (filter !== "inventory-health") return
    const loadHealth = async () => {
      setInventoryHealthLoading(true)
      try {
        const [stockRes, fastRes, deadRes] = await Promise.all([
          getStockPrediction({ days: inventoryHealthDays }),
          getFastSlowMoving({ days: inventoryHealthDays }),
          getDeadStock({ daysNoMovement: inventoryHealthDays }),
        ])
        if (stockRes.success) setStockPredictionData(stockRes.data)
        if (fastRes.success) setFastSlowData(fastRes.data)
        if (deadRes.success) setDeadStockData(deadRes.data)
      } catch (e) {
        console.error("Inventory health load error:", e)
      } finally {
        setInventoryHealthLoading(false)
      }
    }
    loadHealth()
  }, [filter, inventoryHealthDays])

  const inProgressRecords = productionRecords.filter(r => r.status === "in_production" || r.status === "In Progress")
  const completedRecords = productionRecords.filter(r => r.status === "completed" || r.status === "Completed")

  const uniqueQueueCustomers = Array.from(new Set((queueData?.rows ?? []).map((row) => row.customerName))).sort((a, b) => a.localeCompare(b))
  const uniqueQueueItems = Array.from(new Set((queueData?.rows ?? []).map((row) => row.itemName))).sort((a, b) => a.localeCompare(b))

  const getQueueRowStatus = (row: ProductionQueueRow): QueueStatusFilter => {
    if (row.remaining <= 0) return "Completed"
    return row.produced > 0 ? "In Progress" : "Pending"
  }

  const filteredQueueRows = (queueData?.rows ?? []).filter((row) => {
    const search = queueSearch.trim().toLowerCase()
    if (search) {
      const matchesSearch = [row.orderNumber, row.customerName, row.itemName].some((value) =>
        value.toLowerCase().includes(search)
      )
      if (!matchesSearch) return false
    }

    if (queueCustomerFilter && row.customerName !== queueCustomerFilter) return false
    if (queueItemFilter && row.itemName !== queueItemFilter) return false

    const rowStatus = getQueueRowStatus(row)
    if (queueStatusFilter === "All") {
      if (useDefaultOpenOnlyFilter && rowStatus === "Completed") return false
    } else if (rowStatus !== queueStatusFilter) {
      return false
    }

    return true
  })

  const hasActiveQueueFilters =
    queueSearch.trim().length > 0 ||
    queueCustomerFilter.length > 0 ||
    queueItemFilter.length > 0 ||
    queueStatusFilter !== "All" ||
    !useDefaultOpenOnlyFilter

  // Needed: aggregate by item name, sum remaining (only rows with remaining > 0)
  const neededList = (() => {
    if (!queueData?.rows?.length) return []
    const byName: Record<string, number> = {}
    for (const row of queueData.rows) {
      if (row.remaining <= 0) continue
      byName[row.itemName] = (byName[row.itemName] ?? 0) + row.remaining
    }
    return Object.entries(byName)
      .map(([itemName, remaining]) => ({ itemName, remaining }))
      .sort((a, b) => a.itemName.localeCompare(b.itemName))
  })()

  const handleFullscreenNeeded = () => {
    neededFullscreenRef.current?.requestFullscreen()
  }

  const handleExitFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
  }

  const handlePrintNeeded = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return
    const rows = neededList
      .map(
        (r) =>
          `<tr><td style="padding:8px 12px;border:1px solid #ddd">${escapeHtml(r.itemName)}</td><td style="padding:8px 12px;border:1px solid #ddd;text-align:right">${r.remaining}</td></tr>`
      )
      .join("")
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head><title>Production Needed</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; }
            h1 { font-size: 1.25rem; margin-bottom: 16px; }
            table { border-collapse: collapse; width: 100%; max-width: 500px; }
            th { padding: 10px 12px; border: 1px solid #333; background: #f5f5f5; text-align: left; }
          </style>
        </head>
        <body>
          <h1>Production Needed – ${new Date().toLocaleDateString()}</h1>
          <table>
            <thead><tr><th>Item</th><th style="text-align:right">Remaining</th></tr></thead>
            <tbody>${rows || "<tr><td colspan=\"2\">No items needed</td></tr>"}</tbody>
          </table>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    printWindow.close()
  }

  const handleRowClick = (row: ProductionQueueRow) => {
    setSelectedRow(row)
    setJourneyOpen(true)
  }

  const handleNeededItemClick = (itemName: string) => {
    setFilter("pending")
    setQueueSearch(itemName)
  }

  const handleQueueStatusChange = (value: QueueStatusFilter) => {
    setQueueStatusFilter(value)
    setUseDefaultOpenOnlyFilter(false)
  }

  const handleClearQueueFilters = () => {
    setQueueSearch("")
    setQueueStatusFilter("All")
    setQueueCustomerFilter("")
    setQueueItemFilter("")
    setUseDefaultOpenOnlyFilter(true)
  }

  const getProgressPercent = (row: ProductionQueueRow) => {
    if (row.ordered <= 0) return 0
    return Math.min(100, Math.round((row.produced / row.ordered) * 100))
  }

  function escapeHtml(s: string) {
    const div = { textContent: s }
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  }

  const todayLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date())

  return (
    <div className="space-y-5 bg-[#F1F5F9] lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0F172A]">Production</h1>
          <p className="mt-0.5 text-xs text-slate-400">{todayLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="h-9 rounded-lg border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-600 hover:bg-orange-50 hover:text-orange-500"
          >
            Export
          </Button>
          <Link href="/dashboard/orders/new">
            <Button className="h-9 rounded-lg bg-orange-500 px-4 text-[13px] font-medium text-white hover:bg-orange-600">
              + New Order
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="h-[3px] w-full bg-orange-500"></div>
          <div className="px-5 py-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-slate-400">Orders in Production</p>
            <div className="mt-2 text-4xl font-semibold text-slate-900">{queueData?.ordersInProductionCount ?? 0}</div>
            <p className="mt-1 text-xs text-slate-400">Approved or In Production</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="h-[3px] w-full bg-violet-500"></div>
          <div className="px-5 py-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-slate-400">In Progress</p>
            <div className="mt-2 text-4xl font-semibold text-slate-900">{inProgressRecords.length}</div>
            <p className="mt-1 text-xs text-slate-400">Production records</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="h-[3px] w-full bg-green-600"></div>
          <div className="px-5 py-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-slate-400">Completed</p>
            <div className="mt-2 text-4xl font-semibold text-slate-900">{completedRecords.length}</div>
            <p className="mt-1 text-xs text-slate-400">Recent completions</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="h-[3px] w-full bg-cyan-600"></div>
          <div className="px-5 py-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-slate-400">Total Units to Produce</p>
            <div className="mt-2 text-4xl font-semibold text-slate-900">{queueData?.totalUnitsRemaining ?? 0}</div>
            <p className="mt-1 text-xs text-slate-400">Remaining across all items</p>
          </div>
        </div>
      </div>

      {/* Filter Buttons - wrap on mobile, min height for touch */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => setFilter("pending")}
          className={cn(
            "h-9 rounded-lg px-4 text-[13px] font-medium transition-colors",
            filter === "pending"
              ? "border-orange-500 bg-orange-500 text-white hover:bg-orange-600 hover:text-white"
              : "border-slate-200 bg-white text-slate-600 hover:bg-orange-50 hover:text-orange-500"
          )}
        >
          <Clock className="h-4 w-4" />
          Queue – Item-wise ({filteredQueueRows.length})
        </Button>
        <Button
          variant="outline"
          onClick={() => setFilter("needed")}
          className={cn(
            "h-9 rounded-lg px-4 text-[13px] font-medium transition-colors",
            filter === "needed"
              ? "border-orange-500 bg-orange-500 text-white hover:bg-orange-600 hover:text-white"
              : "border-slate-200 bg-white text-slate-600 hover:bg-orange-50 hover:text-orange-500"
          )}
        >
          <Package className="h-4 w-4" />
          Needed ({neededList.length})
        </Button>
        <Button
          variant="outline"
          onClick={() => setFilter("inventory-health")}
          className={cn(
            "h-9 rounded-lg px-4 text-[13px] font-medium transition-colors",
            filter === "inventory-health"
              ? "border-orange-500 bg-orange-500 text-white hover:bg-orange-600 hover:text-white"
              : "border-slate-200 bg-white text-slate-600 hover:bg-orange-50 hover:text-orange-500"
          )}
        >
          <Activity className="h-4 w-4" />
          Inventory Health
        </Button>
      </div>

      {/* Content based on filter */}
      {loading ? (
        <Card className="rounded-xl border-slate-200">
          <CardContent className="py-8">
            <p className="text-center text-slate-500">Loading production data...</p>
          </CardContent>
        </Card>
      ) : filter === "pending" ? (
        <Card className="overflow-hidden rounded-xl border-slate-200 bg-white">
          <CardHeader className="border-b border-slate-200 bg-white px-5 py-4">
            <div className="flex flex-col gap-3 lg:gap-4">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-900">Production queue – complete orders, item-wise</CardTitle>
                <p className="mt-1 text-xs text-slate-400">Single sheet: all orders in production with item breakdown (Ordered / Produced / Remaining).</p>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                    placeholder="Search by order, customer, or item"
                    className="h-9 rounded-lg border-slate-200 bg-white pl-9 text-sm placeholder:text-slate-400 focus-visible:border-orange-500 focus-visible:ring-[3px] focus-visible:ring-orange-500/15"
                  />
                </div>

                <select
                  value={queueStatusFilter}
                  onChange={(e) => handleQueueStatusChange(e.target.value as QueueStatusFilter)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-orange-500 focus:outline-none focus:ring-[3px] focus:ring-orange-500/15 lg:w-[150px]"
                >
                  <option value="All">All</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>

                <select
                  value={queueCustomerFilter}
                  onChange={(e) => setQueueCustomerFilter(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-orange-500 focus:outline-none focus:ring-[3px] focus:ring-orange-500/15 lg:w-[190px]"
                >
                  <option value="">All customers</option>
                  {uniqueQueueCustomers.map((customer) => (
                    <option key={customer} value={customer}>{customer}</option>
                  ))}
                </select>

                <select
                  value={queueItemFilter}
                  onChange={(e) => setQueueItemFilter(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-orange-500 focus:outline-none focus:ring-[3px] focus:ring-orange-500/15 lg:w-[190px]"
                >
                  <option value="">All items</option>
                  {uniqueQueueItems.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>

                {hasActiveQueueFilters ? (
                  <Button
                    variant="outline"
                    onClick={handleClearQueueFilters}
                    className="h-9 gap-1 rounded-lg border-slate-200 text-xs text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear filters
                  </Button>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!filteredQueueRows.length ? (
              <div className="py-12 text-center">
                <CheckCircle className="mx-auto mb-3 h-12 w-12 text-green-500" />
                <p className="text-slate-500">{queueData?.rows?.length ? "No queue rows match your search and filters" : "No orders in production"}</p>
                <p className="mt-1 text-sm text-slate-400">Orders with status Approved or In Production will appear here with item-wise details.</p>
              </div>
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="space-y-3 p-4 lg:hidden">
                  {filteredQueueRows.map((row) => {
                    const progressPercent = getProgressPercent(row)

                    return (
                    <button
                      key={row.itemId}
                      type="button"
                      onClick={() => handleRowClick(row)}
                      className="block w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-orange-200 hover:bg-orange-50/40 hover:shadow-md active:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-orange-500">{row.orderNumber}</p>
                          <p className="mt-0.5 truncate text-sm text-slate-600">{row.customerName}</p>
                          <p className="mt-1 text-sm font-medium text-slate-800">{row.itemName}</p>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span>Ordered: {row.ordered}</span>
                            <span>Produced: {row.produced}</span>
                            <span className="font-semibold text-slate-700">Remaining:</span>
                            <span className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                              row.remaining === 0
                                ? "px-0 text-slate-300"
                                : row.remaining <= 10
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-red-100 text-red-600"
                            )}>{row.remaining === 0 ? "—" : row.remaining}</span>
                          </div>
                          <div className="mt-3">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={cn("h-full rounded-full", progressPercent >= 100 ? "bg-green-500" : "bg-orange-500")}
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                            <p className="mt-1 text-[11px] font-medium text-slate-400">{progressPercent}% complete</p>
                          </div>
                        </div>
                        <Link
                          href={`/dashboard/orders/${row.orderId}`}
                          onClick={(event) => event.stopPropagation()}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors hover:border-orange-500 hover:bg-orange-50 hover:text-orange-500"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </button>
                  )})}
                </div>

                {/* Desktop: table */}
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full">
                    <thead className="border-b-2 border-slate-200 bg-slate-50">
                      <tr>
                        <th className="h-10 px-4 text-left text-[11px] font-medium uppercase tracking-[0.07em] text-slate-500">Order #</th>
                        <th className="h-10 px-4 text-left text-[11px] font-medium uppercase tracking-[0.07em] text-slate-500">Customer</th>
                        <th className="h-10 px-4 text-left text-[11px] font-medium uppercase tracking-[0.07em] text-slate-500">Item</th>
                        <th className="h-10 px-4 text-center text-[11px] font-medium uppercase tracking-[0.07em] text-slate-500">Ordered</th>
                        <th className="h-10 px-4 text-center text-[11px] font-medium uppercase tracking-[0.07em] text-slate-500">Produced</th>
                        <th className="h-10 px-4 text-center text-[11px] font-medium uppercase tracking-[0.07em] text-slate-500">Progress</th>
                        <th className="h-10 px-4 text-center text-[11px] font-medium uppercase tracking-[0.07em] text-slate-500">Remaining</th>
                        <th className="h-10 w-20 px-4 text-center text-[11px] font-medium uppercase tracking-[0.07em] text-slate-500">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQueueRows.map((row, index) => {
                        const isFirstInGroup = index === 0 || filteredQueueRows[index - 1].orderId !== row.orderId
                        const progressPercent = getProgressPercent(row)

                        return (
                          <tr
                            key={row.itemId}
                            onClick={() => handleRowClick(row)}
                            className={cn(
                              "h-12 cursor-pointer border-b border-slate-100 text-[13px] text-slate-900 transition-colors hover:bg-orange-50",
                              index % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"
                            )}
                          >
                            <td className={cn(
                              "px-4 py-0",
                              isFirstInGroup ? "border-l-[3px] border-l-orange-500" : "border-l-[3px] border-l-orange-200"
                            )}>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleRowClick(row)
                                }}
                                className="inline-flex items-center text-xs font-medium text-orange-500 hover:text-orange-600"
                              >
                                {row.orderNumber}
                              </button>
                            </td>
                            <td className="max-w-[180px] truncate px-4 py-0 text-[13px] text-slate-600">{row.customerName}</td>
                            <td className="max-w-[200px] truncate px-4 py-0 text-[13px] font-medium text-slate-900">{row.itemName}</td>
                            <td className="px-4 py-0 text-center text-[13px] font-medium text-slate-900">{row.ordered}</td>
                            <td className="px-4 py-0 text-center text-[13px] font-medium text-slate-900">{row.produced}</td>
                            <td className="px-4 py-0 align-middle">
                              <div className="mx-auto w-[90px]">
                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                                  <div
                                    className={cn("h-full rounded-full", progressPercent >= 100 ? "bg-green-500" : "bg-orange-500")}
                                    style={{ width: `${progressPercent}%` }}
                                  />
                                </div>
                                <p className="mt-1 text-center text-[11px] text-slate-400">{progressPercent}%</p>
                              </div>
                            </td>
                            <td className="px-4 py-0 text-center">
                              {row.remaining === 0 ? (
                                <span className="text-[13px] font-medium text-slate-300">—</span>
                              ) : (
                                <span className={cn(
                                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                                  row.remaining <= 10 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-600"
                                )}>
                                  {row.remaining}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-0 text-center">
                              <Link
                                href={`/dashboard/orders/${row.orderId}`}
                                onClick={(event) => event.stopPropagation()}
                                title="Open order"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-all hover:border-orange-500 hover:bg-orange-50 hover:text-orange-500"
                              >
                                <ExternalLink className="h-[13px] w-[13px]" />
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  <div className="flex items-center justify-between border-t-2 border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-400">Showing {filteredQueueRows.length} of {queueData?.rows.length ?? 0} items</p>
                    <span className="text-xs text-slate-400">All items loaded</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : filter === "needed" ? (
        <div
          ref={neededFullscreenRef}
          className="relative rounded-lg bg-white border border-slate-200 [&:fullscreen]:p-8 [&:fullscreen]:min-h-screen [&:fullscreen]:bg-slate-50 [&:fullscreen]:flex [&:fullscreen]:flex-col [&:fullscreen]:border-0"
        >
          {isNeededFullscreen && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExitFullscreen}
              className="absolute top-4 right-4 z-10 gap-2 print:hidden bg-white shadow-md hover:bg-slate-50"
              aria-label="Exit fullscreen"
            >
              <Minimize2 className="h-4 w-4" />
              Exit fullscreen
            </Button>
          )}
          <Card className="border-l-4 border-l-indigo-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-semibold text-slate-900">Production – Needed</CardTitle>
                <p className="text-sm text-slate-500 mt-1">Items with remaining quantity to produce (aggregated).</p>
                {neededLastUpdated && (
                  <p className="text-xs text-slate-400 mt-1">Last updated: {neededLastUpdated.toLocaleTimeString()}</p>
                )}
              </div>
              <div className="flex gap-2 print:hidden">
                <Button onClick={handlePrintNeeded} className="gap-2" variant="outline">
                  <Printer className="h-4 w-4" />
                  Print list
                </Button>
                <Button onClick={handleFullscreenNeeded} className="gap-2" variant="outline" aria-label="View fullscreen">
                  <Maximize2 className="h-4 w-4" />
                  FullScreen
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {neededList.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-slate-500">No items needed</p>
                  <p className="text-sm text-slate-400 mt-1">All items in production orders are fully produced.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
                  {(() => {
                    const mid = Math.ceil(neededList.length / 2)
                    const firstHalf = neededList.slice(0, mid)
                    const secondHalf = neededList.slice(mid)
                    const renderTable = (rows: { itemName: string; remaining: number }[], tableKey: string) => (
                      <div key={tableKey} className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                        <table className="w-full">
                          <thead className="bg-slate-100 border-b-2 border-slate-200">
                            <tr>
                              <th className="text-left p-4 text-sm font-semibold text-slate-700 uppercase tracking-wider">Item</th>
                              <th className="text-right p-4 text-sm font-semibold text-slate-700 uppercase tracking-wider w-32">Remaining</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {rows.map(({ itemName, remaining }, index) => (
                              <tr
                                key={itemName}
                                onClick={() => handleNeededItemClick(itemName)}
                                className={cn(
                                  "cursor-pointer transition-colors",
                                  index % 2 === 0 ? "bg-white hover:bg-slate-50/70" : "bg-slate-50/50 hover:bg-slate-100/50"
                                )}
                              >
                                <td className="p-4 text-base font-medium text-slate-900">{itemName}</td>
                                <td className="p-4 text-right">
                                  <div className="flex items-center justify-end gap-3">
                                    <Badge variant="secondary" className="border-0 bg-amber-100 px-3 py-1 text-lg font-bold text-amber-800">
                                      {remaining}
                                    </Badge>
                                    <ChevronRight className="h-4 w-4 text-slate-400" />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                    return (
                      <>
                        {renderTable(firstHalf, "needed-table-1")}
                        {secondHalf.length > 0 ? renderTable(secondHalf, "needed-table-2") : null}
                      </>
                    )
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : filter === "inventory-health" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Inventory Health</CardTitle>
            <p className="text-sm text-slate-500 mt-1">Stock prediction, fast/slow moving items, and dead stock detection.</p>
            <div className="flex flex-wrap items-center gap-4 mt-4">
              <div className="flex gap-2">
                {([7, 30, 90] as const).map((d) => (
                  <Button
                    key={d}
                    variant={inventoryHealthDays === d ? "default" : "outline"}
                    size="sm"
                    onClick={() => setInventoryHealthDays(d)}
                  >
                    Last {d} days
                  </Button>
                ))}
              </div>
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by item name..."
                  value={inventoryHealthSearch}
                  onChange={(e) => setInventoryHealthSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3 border-b border-slate-200 pb-0">
              <Button
                variant={inventoryHealthView === "stock-prediction" ? "default" : "ghost"}
                size="sm"
                onClick={() => setInventoryHealthView("stock-prediction")}
                className="rounded-b-none"
              >
                Stock Prediction
              </Button>
              <Button
                variant={inventoryHealthView === "fast-slow" ? "default" : "ghost"}
                size="sm"
                onClick={() => setInventoryHealthView("fast-slow")}
                className="rounded-b-none"
              >
                Fast / Slow Moving
              </Button>
              <Button
                variant={inventoryHealthView === "dead-stock" ? "default" : "ghost"}
                size="sm"
                onClick={() => setInventoryHealthView("dead-stock")}
                className="rounded-b-none"
              >
                Dead Stock
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {inventoryHealthLoading ? (
              <div className="py-12 text-center text-slate-500">Loading inventory health data...</div>
            ) : inventoryHealthView === "stock-prediction" ? (
              (() => {
                const filtered = stockPredictionData.filter((r) =>
                  r.itemName.toLowerCase().includes(inventoryHealthSearch.toLowerCase())
                )
                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-500">
                      No inventory items match. Stock data is for active inventory items only.
                    </div>
                  )
                }
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left p-3 text-xs font-semibold text-slate-600 uppercase">Item</th>
                          <th className="text-right p-3 text-xs font-semibold text-slate-600 uppercase">Current stock</th>
                          <th className="text-right p-3 text-xs font-semibold text-slate-600 uppercase">Demand ({inventoryHealthDays}d)</th>
                          <th className="text-right p-3 text-xs font-semibold text-slate-600 uppercase">Weeks of stock</th>
                          <th className="text-center p-3 text-xs font-semibold text-slate-600 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filtered.map((r) => (
                          <tr key={r.itemId} className="hover:bg-slate-50/50">
                            <td className="p-3 font-medium text-slate-900">{r.itemName}</td>
                            <td className="p-3 text-right text-sm text-slate-700">{r.currentStock.toLocaleString()}</td>
                            <td className="p-3 text-right text-sm text-slate-700">{r.demandInPeriod}</td>
                            <td className="p-3 text-right text-sm text-slate-700">{r.weeksOfStock ?? "—"}</td>
                            <td className="p-3 text-center">
                              <Badge
                                variant="secondary"
                                className={
                                  r.status === "low"
                                    ? "bg-amber-100 text-amber-800"
                                    : r.status === "excess"
                                      ? "bg-slate-200 text-slate-700"
                                      : r.status === "no_demand"
                                        ? "bg-slate-100 text-slate-600"
                                        : "bg-green-100 text-green-800"
                                }
                              >
                                {r.status === "no_demand" ? "No demand" : r.status === "low" ? "Low" : r.status === "excess" ? "Excess" : "Ok"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })()
            ) : inventoryHealthView === "fast-slow" ? (
              (() => {
                const filtered = fastSlowData.filter((r) =>
                  r.itemName.toLowerCase().includes(inventoryHealthSearch.toLowerCase())
                )
                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-500">
                      No movement in the selected period. Try a longer date range.
                    </div>
                  )
                }
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left p-3 text-xs font-semibold text-slate-600 uppercase">Item</th>
                          <th className="text-left p-3 text-xs font-semibold text-slate-600 uppercase">Type</th>
                          <th className="text-right p-3 text-xs font-semibold text-slate-600 uppercase">Quantity dispatched</th>
                          <th className="text-center p-3 text-xs font-semibold text-slate-600 uppercase">Classification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filtered.map((r) => (
                          <tr key={`${r.itemType}-${r.itemId}`} className="hover:bg-slate-50/50">
                            <td className="p-3 font-medium text-slate-900">{r.itemName}</td>
                            <td className="p-3 text-sm text-slate-600 capitalize">{r.itemType}</td>
                            <td className="p-3 text-right text-sm font-medium text-slate-700">{r.quantityDispatched}</td>
                            <td className="p-3 text-center">
                              <Badge
                                variant="secondary"
                                className={
                                  r.classification === "Fast"
                                    ? "bg-green-100 text-green-800"
                                    : r.classification === "Slow"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-slate-100 text-slate-700"
                                }
                              >
                                {r.classification}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })()
            ) : (
              (() => {
                const filtered = deadStockData.filter((r) =>
                  r.itemName.toLowerCase().includes(inventoryHealthSearch.toLowerCase())
                )
                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-500">
                      No dead stock in the selected period (all items had some movement).
                    </div>
                  )
                }
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left p-3 text-xs font-semibold text-slate-600 uppercase">Item</th>
                          <th className="text-left p-3 text-xs font-semibold text-slate-600 uppercase">Type</th>
                          <th className="text-right p-3 text-xs font-semibold text-slate-600 uppercase">Last movement</th>
                          <th className="text-right p-3 text-xs font-semibold text-slate-600 uppercase">Days since movement</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filtered.map((r) => (
                          <tr key={`${r.itemType}-${r.itemId}`} className="hover:bg-slate-50/50">
                            <td className="p-3 font-medium text-slate-900">{r.itemName}</td>
                            <td className="p-3 text-sm text-slate-600 capitalize">{r.itemType}</td>
                            <td className="p-3 text-right text-sm text-slate-600">{r.lastMovementAt ? new Date(r.lastMovementAt).toLocaleDateString() : "—"}</td>
                            <td className="p-3 text-right text-sm text-slate-600">{r.daysSinceMovement ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })()
            )}
          </CardContent>
        </Card>
      ) : null}
      <OrderJourneySheet open={journeyOpen} onOpenChange={setJourneyOpen} row={selectedRow} />
    </div>
  )
}

