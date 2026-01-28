"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Factory, Package, Clock, CheckCircle, AlertCircle, ExternalLink } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

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
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"pending" | "in-progress" | "completed">("pending")
  const supabase = createClient()

  useEffect(() => {
    fetchProductionData()
  }, [])

  const fetchProductionData = async () => {
    try {
      // Fetch items that need production (Approved orders with items not fully dispatched)
      const { data: items, error: itemsError } = await supabase
        .from("order_items")
        .select(`
          *,
          orders!inner (
            internal_order_number,
            sales_order_number,
            order_status,
            customers (name)
          ),
          inventory_items (
            name,
            serial_number
          )
        `)
        .in("orders.order_status", ["Approved", "Partial Dispatch"])
        .order("created_at", { ascending: true })

      if (itemsError) throw itemsError

      // Fetch production records
      const { data: records, error: recordsError } = await supabase
        .from("production_records")
        .select(`
          *,
          dispatches (
            order_id,
            orders (internal_order_number)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(20)

      if (recordsError) throw recordsError

      setProductionItems(items || [])
      setProductionRecords(records || [])
    } catch (error) {
      console.error("Error fetching production data:", error)
    } finally {
      setLoading(false)
    }
  }

  const pendingItems = productionItems.filter(
    item => item.quantity > (item.dispatched_quantity || 0)
  )

  const inProgressRecords = productionRecords.filter(r => r.status === "In Progress")
  const completedRecords = productionRecords.filter(r => r.status === "Completed")

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
            <CardTitle className="text-sm font-semibold text-slate-700">Pending Production</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pendingItems.length}</div>
            <p className="text-xs text-slate-500 mt-1">Items awaiting production</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inProgressRecords.length}</div>
            <p className="text-xs text-slate-500 mt-1">Currently in production</p>
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
            <CardTitle className="text-sm font-semibold text-slate-700">Total Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">
              {pendingItems.reduce((sum, item) => sum + (item.quantity - (item.dispatched_quantity || 0)), 0)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Units to produce</p>
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
          Pending Items ({pendingItems.length})
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
        <div className="space-y-3">
          {pendingItems.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-slate-500">No items pending production</p>
                  <p className="text-sm text-slate-400 mt-1">All orders are either dispatched or in production</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            pendingItems.map(item => {
              const remainingQty = item.quantity - (item.dispatched_quantity || 0)
              return (
                <Card key={item.id} className="border-slate-200 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/dashboard/orders/${item.order_id}`}
                            className="font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            {item.orders?.internal_order_number}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          {item.orders?.sales_order_number && (
                            <Badge variant="outline">{item.orders.sales_order_number}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-600">
                          Customer: <span className="font-medium">{item.orders?.customers?.name}</span>
                        </p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-3">
                          <Package className="h-5 w-5 text-blue-600" />
                          <div>
                            <p className="font-semibold text-slate-900">{item.inventory_items?.name}</p>
                            {item.inventory_items?.serial_number && (
                              <p className="text-xs text-slate-500">Serial: {item.inventory_items.serial_number}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-amber-600">{remainingQty}</div>
                          <p className="text-xs text-slate-500">units to produce</p>
                          {item.dispatched_quantity > 0 && (
                            <p className="text-xs text-green-600 mt-1">{item.dispatched_quantity} dispatched</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {(filter === "in-progress" ? inProgressRecords : completedRecords).map(record => (
            <Card key={record.id} className="border-slate-200 hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900">{record.production_number}</span>
                      <Badge variant={record.status === "Completed" ? "default" : "secondary"}>
                        {record.status}
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

