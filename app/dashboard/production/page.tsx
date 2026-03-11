"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Factory, Package, Clock, CheckCircle, ExternalLink, Printer } from "lucide-react"
import Link from "next/link"
import {
  getProductionQueue,
  getProductionItems,
  getProductionRecordsList,
  type ProductionQueueResult,
} from "@/app/actions/production"

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
  const [filter, setFilter] = useState<"pending" | "needed" | "in-progress" | "completed">("pending")

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
      } catch (error) {
        console.error("Error fetching production data:", error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Factory className="h-8 w-8 text-blue-600" />
          Production Queue
        </h1>
        <p className="text-slate-600 mt-2">
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

      {/* Filter Buttons */}
      <div className="flex gap-2">
        <Button
          variant={filter === "pending" ? "default" : "outline"}
          onClick={() => setFilter("pending")}
          className="gap-2"
        >
          <Clock className="h-4 w-4" />
          Queue – Item-wise ({queueData?.rows?.length ?? 0})
        </Button>
        <Button
          variant={filter === "needed" ? "default" : "outline"}
          onClick={() => setFilter("needed")}
          className="gap-2"
        >
          <Package className="h-4 w-4" />
          Needed ({neededList.length})
        </Button>
        <Button
          variant={filter === "in-progress" ? "default" : "outline"}
          onClick={() => setFilter("in-progress")}
          className="gap-2"
        >
          <Factory className="h-4 w-4" />
          In Progress ({inProgressRecords.length})
        </Button>
        <Button
          variant={filter === "completed" ? "default" : "outline"}
          onClick={() => setFilter("completed")}
          className="gap-2"
        >
          <CheckCircle className="h-4 w-4" />
          Completed ({completedRecords.length})
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
              <div className="overflow-x-auto">
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
            )}
          </CardContent>
        </Card>
      ) : filter === "needed" ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Needed</CardTitle>
              <p className="text-sm text-slate-500 mt-1">Items with remaining quantity to produce (aggregated).</p>
            </div>
            <Button onClick={handlePrintNeeded} className="gap-2 print:hidden" variant="outline">
              <Printer className="h-4 w-4" />
              Print list
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {neededList.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-slate-500">No items needed</p>
                <p className="text-sm text-slate-400 mt-1">All items in production orders are fully produced.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left p-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Item</th>
                      <th className="text-right p-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-28">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {neededList.map(({ itemName, remaining }) => (
                      <tr key={itemName} className="hover:bg-slate-50/50">
                        <td className="p-3 font-medium text-slate-900">{itemName}</td>
                        <td className="p-3 text-right">
                          <span className="font-semibold text-amber-600">{remaining}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(filter === "in-progress" ? inProgressRecords : completedRecords).map(record => (
            <Card key={record.id} className="border-slate-200 hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900">{record.production_number}</span>
                      <Badge variant={record.status === "completed" || record.status === "Completed" ? "default" : "secondary"}>
                        {record.status === "in_production" || record.status === "In Progress" ? "In Progress" : record.status === "completed" || record.status === "Completed" ? "Completed" : record.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600">Type: {record.production_type}</p>
                  </div>
                  <div className="text-right text-sm text-slate-500">
                    {new Date(record.created_at).toLocaleDateString()}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {record.dispatches && record.dispatches.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-600">Related Orders:</p>
                    <div className="flex flex-wrap gap-2">
                      {record.dispatches.map((dispatch, idx) => (
                        <Link
                          key={idx}
                          href={`/dashboard/orders/${dispatch.order_id}`}
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          {dispatch.orders?.internal_order_number}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

