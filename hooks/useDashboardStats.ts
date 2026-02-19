"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { RealtimeChannel } from "@supabase/supabase-js"

export interface DashboardStats {
  totalOrders: number
  pendingOrders: number
  inProductionOrders: number
  dispatchedOrders: number
  deliveredOrders: number
  totalRevenue: number
  unpaidInvoices: number
  partialPaymentOrders: number
  missingSalesOrderNumber: number
  lastUpdated: Date
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  let realtimeChannel: RealtimeChannel

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("order_status, payment_status, total_price, sales_order_number")

      if (ordersError) throw ordersError

      if (!orders) {
        setStats(null)
        return
      }

      const calculatedStats: DashboardStats = {
        totalOrders: orders.length,
        pendingOrders: orders.filter(o => o.order_status === "Pending").length,
        inProductionOrders: orders.filter(o => o.order_status === "In Production").length,
        dispatchedOrders: orders.filter(o => o.order_status === "Partial Dispatch" || o.order_status === "Dispatched").length,
        deliveredOrders: orders.filter(o => o.order_status === "Delivered").length,
        totalRevenue: orders.reduce((sum, o) => sum + (o.total_price || 0), 0),
        unpaidInvoices: orders.filter(o => o.payment_status === "Pending" && o.order_status === "Delivered").length,
        partialPaymentOrders: orders.filter(o => o.payment_status === "Partial Payment").length,
        missingSalesOrderNumber: orders.filter(o => !o.sales_order_number).length,
        lastUpdated: new Date(),
      }

      setStats(calculatedStats)
    } catch (err) {
      console.error("Dashboard stats fetch error:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch stats")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()

    // Subscribe to realtime changes
    realtimeChannel = supabase
      .channel("orders_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          fetchStats()
        }
      )
      .subscribe()

    return () => {
      realtimeChannel?.unsubscribe()
    }
  }, [])

  return { stats, loading, error }
}
