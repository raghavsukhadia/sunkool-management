"use server"

import { createClient } from "@/lib/supabase/server"

export interface DashboardStats {
  totalOrders: number
  pendingOrders: number
  inProductionOrders: number
  readyForDispatchOrders: number
  invoicedOrders: number
  inTransitOrders: number
  dispatchedOrders: number
  partialDeliveredOrders: number
  deliveredOrders: number
  voidOrders: number
  totalRevenue: number
  unpaidInvoices: number
  partialPaymentOrders: number
  missingSalesOrderNumber: number
  lastUpdated: Date
}

export interface RevenueByDayPoint {
  date: string
  revenue: number
  orders: number
}

export interface RecentActivityRow {
  id: string
  order_id: string
  order_number: string
  action: "created" | "updated" | "deleted" | "shipped" | "paid"
  description: string
  customer_name: string
  status_label: "In Progress" | "In Transit" | "Delivered" | "Payment due" | "New Order"
  user_name: string
  created_at: string
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
      pendingOrders: list.filter((o) => o.order_status === "New Order").length,
      inProductionOrders: list.filter((o) => o.order_status === "In Progress").length,
      readyForDispatchOrders: list.filter((o) => o.order_status === "Ready for Dispatch").length,
      invoicedOrders: list.filter((o) => o.order_status === "Invoiced").length,
      inTransitOrders: list.filter((o) => o.order_status === "In Transit").length,
      dispatchedOrders: list.filter(
        (o) =>
          o.order_status === "Ready for Dispatch" ||
          o.order_status === "In Transit" ||
          o.order_status === "Invoiced"
      ).length,
      partialDeliveredOrders: list.filter((o) => o.order_status === "Partial Delivered").length,
      deliveredOrders: list.filter((o) => o.order_status === "Delivered").length,
      voidOrders: list.filter((o) => o.order_status === "Void").length,
      totalRevenue: list.reduce((sum, o) => sum + (o.total_price ?? 0), 0),
      unpaidInvoices: list.filter(
        (o) =>
          o.payment_status === "Pending" &&
          (o.order_status === "Delivered" || o.order_status === "Partial Delivered")
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

export async function getRevenueByDay(dayCount: number): Promise<
  { success: true; data: RevenueByDayPoint[] } | { success: false; error: string }
> {
  try {
    const supabase = await createClient()
    const start = new Date()
    start.setDate(start.getDate() - dayCount)
    start.setHours(0, 0, 0, 0)

    const { data: orders, error } = await supabase
      .from("orders")
      .select("created_at, total_price")
      .gte("created_at", start.toISOString())
      .neq("order_status", "Void")

    if (error) return { success: false, error: error.message }

    const byDay: Record<string, { revenue: number; orders: number }> = {}
    for (let i = 0; i < dayCount; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (dayCount - 1 - i))
      const key = d.toISOString().slice(0, 10)
      byDay[key] = { revenue: 0, orders: 0 }
    }

    for (const o of orders ?? []) {
      const key = (o.created_at as string).slice(0, 10)
      if (!byDay[key]) byDay[key] = { revenue: 0, orders: 0 }
      byDay[key].revenue += o.total_price ?? 0
      byDay[key].orders += 1
    }

    const sorted = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date: new Date(date + "Z").toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        revenue: Math.round(v.revenue),
        orders: v.orders,
      }))

    return { success: true, data: sorted }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch revenue by day"
    return { success: false, error: message }
  }
}

function statusToAction(
  newStatus: string | null,
  newPayment: string | null,
  oldPayment: string | null
): RecentActivityRow["action"] {
  if (newPayment === "Paid" && oldPayment !== "Paid") return "paid"
  if (newStatus === "Delivered" || newStatus === "Partial Delivered") return "shipped"
  return "updated"
}

function toStatusLabel(
  newStatus: string | null,
  newPayment: string | null
): RecentActivityRow["status_label"] {
  if (
    newPayment === "Pending" &&
    (newStatus === "Delivered" || newStatus === "Partial Delivered")
  ) {
    return "Payment due"
  }

  if (newStatus === "In Progress") return "In Progress"
  if (newStatus === "In Transit") return "In Transit"
  if (newStatus === "Delivered" || newStatus === "Partial Delivered") return "Delivered"
  return "New Order"
}

export async function getRecentActivity(limit: number): Promise<
  { success: true; data: RecentActivityRow[] } | { success: false; error: string }
> {
  try {
    const supabase = await createClient()
    const { data: rows, error } = await supabase
      .from("order_log")
      .select(
        `
        id,
        order_id,
        new_status,
        new_payment_status,
        old_payment_status,
        created_at,
        orders!inner ( internal_order_number, customers:customer_id ( name ) ),
        changed_by_user_id ( full_name )
      `
      )
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) return { success: false, error: error.message }

    type LogRow = {
      id: string
      order_id: string
      new_status: string | null
      new_payment_status: string | null
      old_payment_status: string | null
      created_at: string
      orders:
        | {
            internal_order_number: string | null
            customers: { name: string | null } | { name: string | null }[] | null
          }
        | {
            internal_order_number: string | null
            customers: { name: string | null } | { name: string | null }[] | null
          }[]
        | null
      profiles?: { full_name: string | null } | null
      changed_by_user_id?: { full_name: string | null } | { full_name: string | null }[] | null
    }
    const list = (rows ?? []) as LogRow[]

    const out: RecentActivityRow[] = list.map((row) => {
      const ordersObj = Array.isArray(row.orders) ? row.orders[0] : row.orders
      const customerRaw = ordersObj?.customers
      const customerObj = Array.isArray(customerRaw) ? customerRaw[0] : customerRaw
      const orderNumber = ordersObj?.internal_order_number ?? row.order_id.slice(0, 8)
      const action = statusToAction(
        row.new_status,
        row.new_payment_status,
        row.old_payment_status
      )
      const statusLabel = toStatusLabel(row.new_status, row.new_payment_status)
      const description =
        action === "paid"
          ? `Order ${orderNumber} payment → Paid`
          : `Order ${orderNumber} → ${row.new_status ?? "updated"}`
      const profileRaw = row.profiles ?? row.changed_by_user_id
      const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw
      return {
        id: row.id,
        order_id: row.order_id,
        order_number: orderNumber,
        action,
        description,
        customer_name: customerObj?.name ?? "Unknown customer",
        status_label: statusLabel,
        user_name: profile?.full_name ?? "System",
        created_at: row.created_at,
      }
    })

    return { success: true, data: out }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch recent activity"
    return { success: false, error: message }
  }
}

export async function getDashboardData(): Promise<
  | { success: true; data: { stats: DashboardStats; revenueByDay: RevenueByDayPoint[]; recentActivity: RecentActivityRow[] } }
  | { success: false; error: string }
> {
  const [statsRes, revenueRes, activityRes] = await Promise.all([
    getDashboardStats(),
    getRevenueByDay(7),
    getRecentActivity(5),
  ])

  if (!statsRes.success) return { success: false, error: statsRes.error }
  if (!revenueRes.success) return { success: false, error: revenueRes.error }
  if (!activityRes.success) return { success: false, error: activityRes.error }

  return {
    success: true,
    data: {
      stats: statsRes.data,
      revenueByDay: revenueRes.data,
      recentActivity: activityRes.data,
    },
  }
}
