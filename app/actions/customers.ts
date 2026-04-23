"use server"

import { createClient } from "@/lib/supabase/server"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomerOrder {
  id: string
  internal_order_number: string | null
  sales_order_number: string | null
  order_status: string
  payment_status: string
  total_price: number
  requested_payment_amount: number | null
  cash_discount: boolean
  created_at: string
  item_count: number
}

export interface TopOrderedItem {
  item_name: string
  total_quantity: number
}

export interface OrderLogEntry {
  id: string
  order_id: string
  old_status: string | null
  new_status: string | null
  old_payment_status: string | null
  new_payment_status: string | null
  created_at: string
}

export type InsightType = "warning" | "success" | "info"

export interface Insight {
  type: InsightType
  message: string
}

export interface CustomerWithStats {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  contact_person: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  total_orders: number
  unpaid_delivered: number
  unpaid_delivered_amount: number
  lifetime_value: number
  last_order_date: string | null
  smart_tags: string[]
}

export interface CustomerDetail extends CustomerWithStats {
  orders: CustomerOrder[]
  top_items: TopOrderedItem[]
  activity_log: OrderLogEntry[]
  insights: Insight[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeSmartTags(
  customer: { created_at: string },
  stats: {
    total_orders: number
    unpaid_delivered: number
    unpaid_delivered_amount?: number
    lifetime_value: number
    last_order_date: string | null
  }
): string[] {
  const tags: string[] = []
  const now = Date.now()
  const daysSinceCreated = (now - new Date(customer.created_at).getTime()) / 86400000

  if (stats.lifetime_value >= 500000) tags.push("High Value")
  if (stats.total_orders >= 10) tags.push("Frequent Buyer")
  if (daysSinceCreated <= 90) tags.push("New Customer")
  if (stats.unpaid_delivered > 0) tags.push("Account Overdue")

  if (stats.last_order_date) {
    const daysSinceLast = (now - new Date(stats.last_order_date).getTime()) / 86400000
    if (daysSinceLast > 180) tags.push("Inactive")
  } else if (stats.total_orders === 0) {
    tags.push("No Orders")
  }

  return tags
}

function computeInsights(
  customer: CustomerWithStats,
  orders: CustomerOrder[],
  topItems: TopOrderedItem[]
): Insight[] {
  const insights: Insight[] = []
  const now = Date.now()

  if (customer.unpaid_delivered > 0) {
    const unpaidVal = orders
      .filter(o =>
        o.payment_status === "Pending" ||
        o.payment_status === "Delivered Unpaid" ||
        o.payment_status === "Partial"
      )
      .reduce((sum, o) => sum + (o.requested_payment_amount != null ? Number(o.requested_payment_amount) : Number(o.total_price ?? 0)), 0)
    insights.push({
      type: "warning",
      message: `${customer.unpaid_delivered} delivered order${customer.unpaid_delivered > 1 ? "s" : ""} pending payment (₹${unpaidVal.toLocaleString("en-IN")})`,
    })
  }

  const daysSinceCreated = (now - new Date(customer.created_at).getTime()) / 86400000
  if (daysSinceCreated >= 365) {
    const years = Math.floor(daysSinceCreated / 365)
    insights.push({ type: "success", message: `Loyal customer for ${years} year${years > 1 ? "s" : ""}` })
  }

  if (customer.last_order_date) {
    const daysSinceLast = (now - new Date(customer.last_order_date).getTime()) / 86400000
    if (daysSinceLast > 180) {
      insights.push({ type: "warning", message: `No orders in the last ${Math.floor(daysSinceLast / 30)} months` })
    } else if (daysSinceLast <= 30) {
      insights.push({ type: "success", message: "Ordered within the last month" })
    }
  } else {
    insights.push({ type: "info", message: "No orders placed yet" })
  }

  if (customer.total_orders >= 10) {
    insights.push({ type: "success", message: `${customer.total_orders} total orders — frequent buyer` })
  }

  if (customer.lifetime_value >= 500000) {
    insights.push({
      type: "success",
      message: `High value account — ₹${(customer.lifetime_value / 100000).toFixed(1)}L lifetime`,
    })
  }

  if (topItems.length > 0) {
    insights.push({
      type: "info",
      message: `Most ordered: ${topItems[0].item_name} (${topItems[0].total_quantity} units)`,
    })
  }

  return insights
}

// ─── Server Actions ───────────────────────────────────────────────────────────

export async function getCustomersWithStats(): Promise<{
  success: boolean
  data: CustomerWithStats[] | null
  error: string | null
}> {
  const supabase = await createClient()

  const [customersResult, ordersResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, email, phone, address, contact_person, notes, is_active, created_at, updated_at")
      .order("name", { ascending: true }),
    supabase
      .from("orders")
      .select("customer_id, order_status, payment_status, total_price, requested_payment_amount, created_at"),
  ])

  if (customersResult.error) return { success: false, data: null, error: customersResult.error.message }
  if (ordersResult.error) return { success: false, data: null, error: ordersResult.error.message }

  const customers = customersResult.data ?? []
  const orders = ordersResult.data ?? []

  type StatsEntry = {
    total_orders: number
    unpaid_delivered: number
    unpaid_delivered_amount: number
    lifetime_value: number
    last_order_date: string | null
  }

  const statsMap = new Map<string, StatsEntry>()

  for (const order of orders) {
    if (!order.customer_id) continue
    if (!statsMap.has(order.customer_id)) {
      statsMap.set(order.customer_id, {
        total_orders: 0,
        unpaid_delivered: 0,
        unpaid_delivered_amount: 0,
        lifetime_value: 0,
        last_order_date: null,
      })
    }
    const s = statsMap.get(order.customer_id)!
    s.total_orders += 1
    const val =
      order.requested_payment_amount != null
        ? Number(order.requested_payment_amount)
        : Number(order.total_price ?? 0)
    s.lifetime_value += val
    const isUnpaid =
      order.payment_status === "Pending" ||
      order.payment_status === "Delivered Unpaid" ||
      order.payment_status === "Partial"
    if (isUnpaid) {
      s.unpaid_delivered += 1
      s.unpaid_delivered_amount += val
    }
    if (!s.last_order_date || order.created_at > s.last_order_date) {
      s.last_order_date = order.created_at
    }
  }

  const result: CustomerWithStats[] = customers.map(c => {
    const stats = statsMap.get(c.id) ?? {
      total_orders: 0,
      unpaid_delivered: 0,
      unpaid_delivered_amount: 0,
      lifetime_value: 0,
      last_order_date: null,
    }
    return {
      ...c,
      ...stats,
      smart_tags: computeSmartTags(c, stats),
    }
  })

  result.sort((a, b) => b.lifetime_value - a.lifetime_value)

  return { success: true, data: result, error: null }
}

export async function getCustomerById(id: string): Promise<{
  success: boolean
  data: CustomerDetail | null
  error: string | null
}> {
  const supabase = await createClient()

  const [customerResult, ordersResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, email, phone, address, contact_person, notes, is_active, created_at, updated_at")
      .eq("id", id)
      .single(),
    supabase
      .from("orders")
      .select(
        "id, internal_order_number, sales_order_number, order_status, payment_status, total_price, requested_payment_amount, cash_discount, created_at"
      )
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
  ])

  if (customerResult.error) return { success: false, data: null, error: customerResult.error.message }
  if (ordersResult.error) return { success: false, data: null, error: ordersResult.error.message }

  const customer = customerResult.data
  const orders = ordersResult.data ?? []
  const orderIds = orders.map(o => o.id)

  const [itemsResult, logResult] = await Promise.all([
    orderIds.length > 0
      ? supabase
          .from("order_items")
          .select("order_id, quantity, inventory_items:inventory_item_id(item_name)")
          .in("order_id", orderIds)
      : Promise.resolve({ data: [] as Array<{ order_id: string; quantity: number; inventory_items: { item_name: string } | null }>, error: null }),
    orderIds.length > 0
      ? supabase
          .from("order_log")
          .select("id, order_id, old_status, new_status, old_payment_status, new_payment_status, created_at")
          .in("order_id", orderIds)
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as OrderLogEntry[], error: null }),
  ])

  if (itemsResult.error) return { success: false, data: null, error: itemsResult.error.message }
  if (logResult.error) return { success: false, data: null, error: logResult.error.message }

  // Count items per order
  const itemCountMap = new Map<string, number>()
  const itemQtyMap = new Map<string, number>()

  for (const item of (itemsResult.data ?? [])) {
    itemCountMap.set(item.order_id, (itemCountMap.get(item.order_id) ?? 0) + 1)
    const name = (item.inventory_items as { item_name: string } | null)?.item_name
    if (name) {
      itemQtyMap.set(name, (itemQtyMap.get(name) ?? 0) + Number(item.quantity ?? 0))
    }
  }

  const top_items: TopOrderedItem[] = [...itemQtyMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([item_name, total_quantity]) => ({ item_name, total_quantity }))

  // Aggregate stats
  let total_orders = orders.length
  let unpaid_delivered = 0
  let unpaid_delivered_amount = 0
  let lifetime_value = 0
  let last_order_date: string | null = null

  for (const order of orders) {
    const val =
      order.requested_payment_amount != null
        ? Number(order.requested_payment_amount)
        : Number(order.total_price ?? 0)
    lifetime_value += val
    const isUnpaid =
      order.payment_status === "Pending" ||
      order.payment_status === "Delivered Unpaid" ||
      order.payment_status === "Partial"
    if (isUnpaid) {
      unpaid_delivered++
      unpaid_delivered_amount += val
    }
    if (!last_order_date || order.created_at > last_order_date) last_order_date = order.created_at
  }

  const stats = { total_orders, unpaid_delivered, unpaid_delivered_amount, lifetime_value, last_order_date }
  const smart_tags = computeSmartTags(customer, stats)

  const customerOrders: CustomerOrder[] = orders.map(o => ({
    ...o,
    item_count: itemCountMap.get(o.id) ?? 0,
  }))

  const customerWithStats: CustomerWithStats = { ...customer, ...stats, smart_tags }
  const insights = computeInsights(customerWithStats, customerOrders, top_items)

  return {
    success: true,
    data: {
      ...customerWithStats,
      orders: customerOrders,
      top_items,
      activity_log: (logResult.data ?? []) as OrderLogEntry[],
      insights,
    },
    error: null,
  }
}
