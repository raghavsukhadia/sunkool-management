"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Factory, Package, Clock, CheckCircle, ExternalLink, Printer, Activity, Search, Maximize2, Minimize2 } from "lucide-react"
import Link from "next/link"
import {
  getProductionQueue,
  getProductionItems,
  getProductionRecordsList,
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

  const pendingItems = productionItems.filter(
    item => item.quantity > (item.dispatched_quantity || 0)
  )

  const inProgressRecords = productionRecords.filter(r => r.status === "in_production" || r.status === "In Progress")
  const completedRecords = productionRecords.filter(r => r.status === "completed" || r.status === "Completed")

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

  function escapeHtml(s: string) {
    const div = { textContent: s }
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  }

  return (
    <div className="space-y-5 lg:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-2 lg:gap-3">
          <Factory className="h-6 w-6 lg:h-8 lg:w-8 text-blue-600" />
          Production Queue
        </h1>
        <p className="text-slate-600 mt-2 text-sm lg:text-base">
          Track items pending production and manage production records
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-200 border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Orders in Production</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{queueData?.ordersInProductionCount ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">Approved or In Production</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inProgressRecords.length}</div>
            <p className="text-xs text-slate-500 mt-1">Production records</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedRecords.length}</div>
            <p className="text-xs text-slate-500 mt-1">Recent completions</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 border-l-4 border-l-indigo-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Total Units to Produce</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">{queueData?.totalUnitsRemaining ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">Remaining across all items</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Buttons - wrap on mobile, min height for touch */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filter === "pending" ? "default" : "outline"}
          onClick={() => setFilter("pending")}
          className="gap-2 min-h-[44px]"
        >
          <Clock className="h-4 w-4" />
          Queue – Item-wise ({queueData?.rows?.length ?? 0})
        </Button>
        <Button
          variant={filter === "needed" ? "default" : "outline"}
          onClick={() => setFilter("needed")}
          className="gap-2 min-h-[44px]"
        >
          <Package className="h-4 w-4" />
          Needed ({neededList.length})
        </Button>
        <Button
          variant={filter === "inventory-health" ? "default" : "outline"}
          onClick={() => setFilter("inventory-health")}
          className="gap-2 min-h-[44px]"
        >
          <Activity className="h-4 w-4" />
          Inventory Health
        </Button>
      </div>

      {/* Content based on filter */}
      {loading ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-slate-500">Loading production data...</p>
          </CardContent>
        </Card>
      ) : filter === "pending" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Production queue – complete orders, item-wise</CardTitle>
            <p className="text-sm text-slate-500">Single sheet: all orders in production with item breakdown (Ordered / Produced / Remaining).</p>
          </CardHeader>
          <CardContent className="p-0">
            {!queueData?.rows?.length ? (
              <div className="py-12 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-slate-500">No orders in production</p>
                <p className="text-sm text-slate-400 mt-1">Orders with status Approved or In Production will appear here with item-wise details.</p>
              </div>
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="lg:hidden space-y-3 p-4">
                  {queueData.rows.map((row) => (
                    <Link
                      key={row.itemId}
                      href={`/dashboard/orders/${row.orderId}`}
                      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md active:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 truncate">{row.orderNumber}</p>
                          <p className="text-sm text-slate-600 truncate mt-0.5">{row.customerName}</p>
                          <p className="text-sm font-medium text-slate-800 mt-1">{row.itemName}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
                            <span>Ordered: {row.ordered}</span>
                            <span>Produced: {row.produced}</span>
                            <span className={row.remaining > 0 ? "font-semibold text-amber-600" : "font-semibold text-green-600"}>
                              Remaining: {row.remaining}
                            </span>
                          </div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-slate-400 shrink-0 mt-1" />
                      </div>
                    </Link>
                  ))}
                </div>
                {/* Desktop: table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left p-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Order #</th>
                        <th className="text-left p-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Customer</th>
                        <th className="text-left p-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Item</th>
                        <th className="text-center p-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Ordered</th>
                        <th className="text-center p-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Produced</th>
                        <th className="text-center p-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Remaining</th>
                        <th className="text-center p-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-28">Link</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {queueData.rows.map((row) => (
                        <tr key={row.itemId} className="hover:bg-slate-50/50">
                          <td className="p-3">
                            <Link href={`/dashboard/orders/${row.orderId}`} className="font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
                              {row.orderNumber}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </td>
                          <td className="p-3 text-sm text-slate-700">{row.customerName}</td>
                          <td className="p-3 text-sm font-medium text-slate-900">{row.itemName}</td>
                          <td className="p-3 text-center text-sm text-slate-700">{row.ordered}</td>
                          <td className="p-3 text-center text-sm text-slate-700">{row.produced}</td>
                          <td className="p-3 text-center">
                            <span className={`text-sm font-semibold ${row.remaining > 0 ? "text-amber-600" : "text-green-600"}`}>
                              {row.remaining}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <Link href={`/dashboard/orders/${row.orderId}`} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                              Open order
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                                className={index % 2 === 0 ? "bg-white hover:bg-slate-50/70" : "bg-slate-50/50 hover:bg-slate-100/50"}
                              >
                                <td className="p-4 text-base font-medium text-slate-900">{itemName}</td>
                                <td className="p-4 text-right">
                                  <Badge variant="secondary" className="text-lg font-bold px-3 py-1 bg-amber-100 text-amber-800 border-0">
                                    {remaining}
                                  </Badge>
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
    </div>
  )
}

