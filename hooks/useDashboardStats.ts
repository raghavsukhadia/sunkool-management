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
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("order_status, payment_status, total_price, sales_order_number", {
          count: "planned",
        })

      if (ordersError) throw ordersError

      const stats: DashboardStats = {
        totalOrders: orders?.length || 0,
        pendingOrders: orders?.filter(o => o.order_status === "Pending").length || 0,
        inProductionOrders: orders?.filter(o => o.order_status === "In Production").length || 0,
        dispatchedOrders: orders?.filter(o => o.order_status === "Partial Dispatch" || o.order_status === "Dispatched").length || 0,
        deliveredOrders: orders?.filter(o => o.order_status === "Delivered").length || 0,
        totalRevenue: orders?.reduce((sum, o) => sum + (o.total_price || 0), 0) || 0,
        unpaidInvoices: orders?.filter(o => o.payment_status === "Pending" && o.order_status === "Delivered").length || 0,
        partialPaymentOrders: orders?.filter(o => o.payment_status === "Partial Payment").length || 0,
        missingSalesOrderNumber: orders?.filter(o => !o.sales_order_number).length || 0,
        lastUpdated: new Date(),
      }

      setStats(stats)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch stats")
      setLoading(false)
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
