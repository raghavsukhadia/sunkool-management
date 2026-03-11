"use server"

import { createClient } from "@/lib/supabase/server"

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

export async function getDashboardStats(): Promise<
  { success: true; data: DashboardStats } | { success: false; error: string }
> {
  try {
    const supabase = await createClient()
    const { data: orders, error } = await supabase
      .from("orders")
      .select("order_status, payment_status, total_price, sales_order_number")

    if (error) return { success: false, error: error.message }
    const list = orders ?? []

    const stats: DashboardStats = {
      totalOrders: list.length,
      pendingOrders: list.filter((o) => o.order_status === "Pending").length,
      inProductionOrders: list.filter((o) => o.order_status === "In Production").length,
      dispatchedOrders: list.filter(
        (o) => o.order_status === "Partial Dispatch" || o.order_status === "Dispatched"
      ).length,
      deliveredOrders: list.filter((o) => o.order_status === "Delivered").length,
      totalRevenue: list.reduce((sum, o) => sum + (o.total_price ?? 0), 0),
      unpaidInvoices: list.filter(
        (o) => o.payment_status === "Pending" && o.order_status === "Delivered"
      ).length,
      partialPaymentOrders: list.filter((o) => o.payment_status === "Partial").length,
      missingSalesOrderNumber: list.filter((o) => !o.sales_order_number).length,
      lastUpdated: new Date(),
    }

    return { success: true, data: stats }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch dashboard stats"
    return { success: false, error: message }
  }
}
