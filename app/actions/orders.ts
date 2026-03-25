"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { sendProductionRecordCreatedNotification } from "@/app/actions/notifications"
import { getCourierCompanies } from "@/app/actions/management"

// Generate next internal order number in sequence (SK01, SK02, SK03...)
async function generateNextOrderNumber(): Promise<string> {
  const supabase = await createClient()

  // Get all existing internal order numbers that match the SK## pattern
  const { data: orders, error } = await supabase
    .from("orders")
    .select("internal_order_number")
    .not("internal_order_number", "is", null)
    .like("internal_order_number", "SK%")
    .order("internal_order_number", { ascending: false })

  if (error) {
    console.error("Error fetching order numbers:", error)
    // Fallback: return SK01 if there's an error
    return "SK01"
  }

  if (!orders || orders.length === 0) {
    // First order
    return "SK01"
  }

  // Extract numbers from existing SK## format orders
  const orderNumbers: number[] = []
  for (const order of orders) {
    const orderNumber = order.internal_order_number
    if (orderNumber && orderNumber.startsWith("SK")) {
      // Extract numeric part after "SK"
      const numberPart = orderNumber.substring(2)
      // Remove any leading zeros and parse
      const num = parseInt(numberPart, 10)
      if (!isNaN(num) && num > 0) {
        orderNumbers.push(num)
      }
    }
  }

  if (orderNumbers.length === 0) {
    // No valid SK## numbers found, start from SK01
    return "SK01"
  }

  // Find the highest number and increment
  const maxNumber = Math.max(...orderNumbers)
  const nextNumber = maxNumber + 1

  // Format with zero padding: SK01, SK02, ..., SK09, SK10, SK11, etc.
  // Use 2-digit padding for numbers < 100, then no padding for >= 100
  if (nextNumber < 100) {
    return `SK${nextNumber.toString().padStart(2, '0')}`
  } else {
    return `SK${nextNumber}`
  }
}

// Check if an order item has been dispatched and get details
export async function getOrderItemDispatchStatus(orderItemId: string) {
  const supabase = await createClient()

  const { data: dispatchItems } = await supabase
    .from("dispatch_items")
    .select("quantity, dispatches!inner(dispatch_date, dispatch_type, shipment_status)")
    .eq("order_item_id", orderItemId)

  const totalDispatched = dispatchItems?.reduce((sum, item) => sum + item.quantity, 0) || 0

  return {
    hasBeenDispatched: totalDispatched > 0,
    totalDispatched,
    dispatchCount: dispatchItems?.length || 0,
    dispatchDetails: dispatchItems || []
  }
}

// Create a new order
export async function createOrder(formData: {
  customer_id: string
  sales_order_number?: string
  cash_discount: boolean
}) {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "User not authenticated" }
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return { success: false, error: "User profile not found" }
  }

  // Generate automatic internal order number (SK01, SK02, etc.)
  const internalOrderNumber = await generateNextOrderNumber()

  // Create order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: formData.customer_id,
      internal_order_number: internalOrderNumber, // Auto-generated internal order number
      sales_order_number: formData.sales_order_number || null, // Manual sales order number from other platforms
      cash_discount: formData.cash_discount,
      order_status: "New Order",
      payment_status: "Pending",
      total_price: 0, // Will be updated when items are added
      created_by: profile.id,
    })
    .select()
    .single()

  if (orderError) {
    return { success: false, error: orderError.message }
  }

  revalidatePath("/dashboard/orders")
  revalidatePath("/dashboard/orders/new")
  revalidatePath("/dashboard/follow-up")

  return { success: true, data: order }
}

// Get all customers for dropdown
export async function getCustomersForOrder() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("customers")
    .select("id, name, email, phone")
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (error) {
    return { success: false, error: error.message, data: null }
  }

  return { success: true, data, error: null }
}

/** One line on the orders list: display name, ordered qty, remaining (ordered − net dispatched). */
export type OrderLineItemSummary = {
  name: string
  ordered: number
  remaining: number
}

type InvItemForLineName = { item_name: string; parent_item_id: string | null }

function lineItemDisplayName(
  oi: {
    inventory_item_id?: string | null
    product_id?: string | null
    quantity: number
  },
  invMap: Map<string, InvItemForLineName>,
  productNameById: Record<string, string>,
  index: number
): string {
  const invId = oi.inventory_item_id ?? undefined
  const prodId = oi.product_id ?? undefined
  const inv = invId ? invMap.get(invId) : undefined
  const prod = prodId ? invMap.get(prodId) : undefined

  let name: string
  if (inv?.parent_item_id) {
    const parent = invMap.get(inv.parent_item_id)
    name = parent ? `${parent.item_name} → ${inv.item_name}` : inv.item_name
  } else if (prod && prod.parent_item_id === invId && inv) {
    name = `${inv.item_name} → ${prod.item_name}`
  } else if (prod && prod.parent_item_id) {
    const parent = invMap.get(prod.parent_item_id)
    name = parent ? `${parent.item_name} → ${prod.item_name}` : prod.item_name
  } else {
    name =
      (inv?.item_name || prod?.item_name) ||
      (prodId ? productNameById[prodId] : "") ||
      (invId ? productNameById[invId] : "") ||
      `Item ${index + 1}`
  }
  return name
}

function orderedRemainingForLine(
  orderItemId: string,
  orderedQty: number,
  netDispatchedByOrderItemId: Record<string, number>
): { ordered: number; remaining: number } {
  const net = netDispatchedByOrderItemId[orderItemId] ?? 0
  return { ordered: orderedQty, remaining: Math.max(0, orderedQty - net) }
}

/**
 * Resolves display names for order_items rows (inventory + optional products fallback).
 * Returns line items grouped by order_id, ordered by created_at within each order.
 */
async function buildLineItemsByOrderId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderItems: Array<{
    id: string
    order_id: string
    quantity: number
    inventory_item_id?: string | null
    product_id?: string | null
    created_at?: string | null
  }>,
  netDispatchedByOrderItemId: Record<string, number>
): Promise<Record<string, OrderLineItemSummary[]>> {
  if (!orderItems.length) return {}

  const sorted = [...orderItems].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
    return ta - tb
  })

  const allIds = new Set<string>()
  for (const oi of sorted) {
    if (oi.inventory_item_id) allIds.add(oi.inventory_item_id)
    if (oi.product_id) allIds.add(oi.product_id)
  }

  const idList = [...allIds]
  if (idList.length === 0) {
    const byOrderEmpty: Record<string, OrderLineItemSummary[]> = {}
    const idxEmpty: Record<string, number> = {}
    for (const oi of sorted) {
      if (!byOrderEmpty[oi.order_id]) byOrderEmpty[oi.order_id] = []
      const i = idxEmpty[oi.order_id] ?? 0
      idxEmpty[oi.order_id] = i + 1
      const { ordered, remaining } = orderedRemainingForLine(
        oi.id,
        oi.quantity,
        netDispatchedByOrderItemId
      )
      byOrderEmpty[oi.order_id].push({
        name: `Item ${i + 1}`,
        ordered,
        remaining,
      })
    }
    return byOrderEmpty
  }

  const { data: invRows } = await supabase
    .from("inventory_items")
    .select("id, item_name, parent_item_id")
    .in("id", idList)

  const invMap = new Map<string, InvItemForLineName>()
  for (const row of invRows || []) {
    invMap.set(row.id, {
      item_name: row.item_name ?? "",
      parent_item_id: row.parent_item_id ?? null,
    })
  }

  const missingForProducts = idList.filter((id) => !invMap.has(id))
  const productNameById: Record<string, string> = {}
  if (missingForProducts.length > 0) {
    const { data: prodRows } = await supabase
      .from("products")
      .select("id, name")
      .in("id", missingForProducts)
    for (const p of prodRows || []) {
      productNameById[p.id] = p.name ?? ""
    }
  }

  const byOrder: Record<string, OrderLineItemSummary[]> = {}
  const indexByOrder: Record<string, number> = {}

  for (const oi of sorted) {
    if (!byOrder[oi.order_id]) byOrder[oi.order_id] = []
    const idx = indexByOrder[oi.order_id] ?? 0
    indexByOrder[oi.order_id] = idx + 1
    const name = lineItemDisplayName(oi, invMap, productNameById, idx)
    const { ordered, remaining } = orderedRemainingForLine(
      oi.id,
      oi.quantity,
      netDispatchedByOrderItemId
    )
    byOrder[oi.order_id].push({ name, ordered, remaining })
  }

  return byOrder
}

// Get all orders for the orders list page
export async function getAllOrders() {
  const supabase = await createClient()

  const { data: orders, error } = await supabase
    .from("orders")
    .select(`
      id,
      internal_order_number,
      sales_order_number,
      order_status,
      payment_status,
      total_price,
      requested_payment_amount,
      cash_discount,
      created_at,
      updated_at,
      customers:customer_id (
        id,
        name,
        email,
        phone
      )
    `)
    .order("created_at", { ascending: false })

  if (error) {
    return { success: false, error: error.message, data: null }
  }

  // Get item counts and payment totals per order
  if (orders && orders.length > 0) {
    const orderIds = orders.map(o => o.id)

    const { data: orderItems } = await supabase
      .from("order_items")
      .select("id, order_id, quantity, inventory_item_id, product_id, created_at")
      .in("order_id", orderIds)

    const orderItemIds = (orderItems || []).map((oi) => oi.id)
    const netDispatchedByOrderItemId: Record<string, number> = {}
    if (orderItemIds.length > 0) {
      const { data: dispatchRows } = await supabase
        .from("dispatch_items")
        .select("order_item_id, quantity")
        .in("order_item_id", orderItemIds)
      for (const row of dispatchRows || []) {
        const oid = row.order_item_id as string
        netDispatchedByOrderItemId[oid] =
          (netDispatchedByOrderItemId[oid] || 0) + Number(row.quantity || 0)
      }
    }

    const lineItemsByOrder = await buildLineItemsByOrderId(
      supabase,
      orderItems || [],
      netDispatchedByOrderItemId
    )

    const itemCounts: Record<string, number> = {}
    orderItems?.forEach((item) => {
      itemCounts[item.order_id] = (itemCounts[item.order_id] || 0) + 1
    })

    const { data: payments } = await supabase
      .from("order_payments")
      .select("order_id, amount")
      .in("order_id", orderIds)

    const totalPaidByOrder: Record<string, number> = {}
    payments?.forEach(p => {
      const id = p.order_id
      totalPaidByOrder[id] = (totalPaidByOrder[id] || 0) + Number(p.amount || 0)
    })

    const ordersWithCounts = orders.map(order => {
      const requested = order.requested_payment_amount != null
        ? Number(order.requested_payment_amount)
        : (order.total_price ?? 0)
      const totalPaid = totalPaidByOrder[order.id] || 0
      const amountDue = Math.max(0, requested - totalPaid)
      // Only show "Paid" when there was an amount to pay and it's fully covered.
      // If requested is 0 and no payments, treat as Pending (not Paid).
      const derivedPaymentStatus =
        amountDue === 0 && (requested > 0 || totalPaid > 0)
          ? "Paid"
          : totalPaid > 0
            ? "Partial"
            : "Pending"
      return {
        ...order,
        item_count: itemCounts[order.id] || 0,
        line_items: lineItemsByOrder[order.id] || [],
        payment_status: derivedPaymentStatus
      }
    })

    return { success: true, data: ordersWithCounts, error: null }
  }

  return { success: true, data: orders || [], error: null }
}

/** Returns order IDs that meet strict "completed" criteria: all items produced, all delivered, full amount paid. Excludes Void. */
export async function getCompletedOrderIds(): Promise<{
  success: boolean
  data: string[] | null
  error: string | null
}> {
  const supabase = await createClient()

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, total_price, requested_payment_amount")
    .neq("order_status", "Void")

  if (ordersError) {
    return { success: false, error: ordersError.message, data: null }
  }
  if (!orders || orders.length === 0) {
    return { success: true, data: [], error: null }
  }

  const orderIds = orders.map((o) => o.id)

  const [
    { data: orderItems },
    { data: productionRecords },
    { data: dispatches },
    { data: payments },
  ] = await Promise.all([
    supabase.from("order_items").select("id, order_id, quantity").in("order_id", orderIds),
    supabase
      .from("production_records")
      .select("order_id, production_type, selected_quantities")
      .in("order_id", orderIds)
      .eq("status", "completed"),
    supabase.from("dispatches").select("id, order_id, shipment_status, dispatch_type").in("order_id", orderIds),
    supabase.from("order_payments").select("order_id, amount").in("order_id", orderIds),
  ])

  const dispatchIds = (dispatches || []).map((d) => d.id)
  let dispatchItemsData: { order_item_id: string; quantity: number; dispatch_id: string }[] = []
  if (dispatchIds.length > 0) {
    const { data: di } = await supabase
      .from("dispatch_items")
      .select("order_item_id, quantity, dispatch_id")
      .in("dispatch_id", dispatchIds)
    dispatchItemsData = di || []
  }

  const totalPaidByOrder: Record<string, number> = {}
  ;(payments || []).forEach((p: { order_id: string; amount: number }) => {
    const id = p.order_id
    totalPaidByOrder[id] = (totalPaidByOrder[id] || 0) + Number(p.amount || 0)
  })

  const dispatchById = new Map((dispatches || []).map((d) => [d.id, d]))
  const deliveredDispatchIds = new Set(
    (dispatches || []).filter((d) => d.dispatch_type !== "return" && d.shipment_status === "delivered").map((d) => d.id)
  )

  const producedByOrderItem: Record<string, number> = {}
  for (const item of orderItems || []) {
    producedByOrderItem[item.id] = 0
  }
  for (const rec of productionRecords || []) {
    const sq = (rec.selected_quantities as Record<string, number> | null) || null
    const orderItemsForOrder = (orderItems || []).filter((i) => i.order_id === rec.order_id)
    for (const item of orderItemsForOrder) {
      if (rec.production_type === "full") {
        producedByOrderItem[item.id] = (producedByOrderItem[item.id] || 0) + item.quantity
      } else if (sq && sq[item.id] != null) {
        producedByOrderItem[item.id] = (producedByOrderItem[item.id] || 0) + (Number(sq[item.id]) || 0)
      }
    }
  }

  const deliveredByOrderItem: Record<string, number> = {}
  for (const item of orderItems || []) {
    deliveredByOrderItem[item.id] = 0
  }
  for (const di of dispatchItemsData) {
    const disp = dispatchById.get(di.dispatch_id)
    if (disp && disp.dispatch_type !== "return" && disp.shipment_status === "delivered") {
      deliveredByOrderItem[di.order_item_id] = (deliveredByOrderItem[di.order_item_id] || 0) + (di.quantity || 0)
    }
  }

  const completedIds: string[] = []
  for (const order of orders) {
    const requested =
      order.requested_payment_amount != null ? Number(order.requested_payment_amount) : (order.total_price ?? 0)
    const totalPaid = totalPaidByOrder[order.id] || 0
    const amountDue = Math.max(0, requested - totalPaid)
    const fullPaid = amountDue === 0 && (requested > 0 || totalPaid > 0)

    const items = (orderItems || []).filter((i) => i.order_id === order.id)
    const allProduced = items.length === 0 || items.every((i) => (producedByOrderItem[i.id] || 0) >= i.quantity)
    const allDelivered = items.length === 0 || items.every((i) => (deliveredByOrderItem[i.id] || 0) >= i.quantity)

    if (allProduced && allDelivered && fullPaid) {
      completedIds.push(order.id)
    }
  }

  return { success: true, data: completedIds, error: null }
}

// Get order details with customer and items
export async function getOrderDetails(orderId: string) {
  const supabase = await createClient()

  // Get order with customer info
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(`
      *,
      customers:customer_id (
        id,
        name,
        email,
        phone,
        address,
        contact_person
      )
    `)
    .eq("id", orderId)
    .single()

  // Note: internal_order_number is included in the * selector

  if (orderError) {
    return { success: false, error: orderError.message, data: null }
  }

  // Get order items
  const { data: orderItems } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true })

  return {
    success: true,
    data: {
      ...order,
      items: orderItems || []
    },
    error: null
  }
}

export type OrdersExportRow = {
  orderId: string
  internal_order_number: string | null
  sales_order_number: string | null
  created_at: string
  dispatch_date: string
  customer_name: string
  invoice_number: string | null
  order_status: string
  item_details: string
  bill_to: string
  ship_to: string
  card_pic: string
  tracking_id: string | null
  courier_name: string
  expected_delivered: string
}

/** Returns one row per order for Excel export (batched). */
export async function getOrdersExportData(orderIds: string[]): Promise<{
  success: boolean
  data: OrdersExportRow[] | null
  error: string | null
}> {
  const supabase = await createClient()
  if (!orderIds || orderIds.length === 0) {
    return { success: true, data: [], error: null }
  }

  const emptyRow = (orderId: string): OrdersExportRow => ({
    orderId,
    internal_order_number: null,
    sales_order_number: null,
    created_at: "",
    dispatch_date: "",
    customer_name: "",
    invoice_number: null,
    order_status: "",
    item_details: "",
    bill_to: "",
    ship_to: "",
    card_pic: "",
    tracking_id: null,
    courier_name: "",
    expected_delivered: ""
  })

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(`
      id,
      internal_order_number,
      sales_order_number,
      created_at,
      invoice_number,
      order_status,
      customers:customer_id (
        name,
        address
      )
    `)
    .in("id", orderIds)

  if (ordersError) {
    return { success: false, error: ordersError.message, data: null }
  }

  const orderMap = new Map<string, OrdersExportRow>()
  for (const o of orders || []) {
    const order = o as {
      id: string
      internal_order_number: string | null
      sales_order_number: string | null
      created_at: string
      invoice_number: string | null
      order_status: string
      customers?: { name?: string; address?: string } | null
    }
    const customer = order.customers
    const createdAt = order.created_at
      ? new Date(order.created_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
      : ""
    orderMap.set(order.id, {
      orderId: order.id,
      internal_order_number: order.internal_order_number ?? null,
      sales_order_number: order.sales_order_number ?? null,
      created_at: createdAt,
      dispatch_date: "",
      customer_name: customer?.name ?? "",
      invoice_number: order.invoice_number ?? null,
      order_status: order.order_status ?? "",
      item_details: "",
      bill_to: "",
      ship_to: customer?.address ?? "",
      card_pic: "",
      tracking_id: null,
      courier_name: "",
      expected_delivered: ""
    })
  }

  const ids = [...orderMap.keys()]

  const { data: orderItems } = await supabase
    .from("order_items")
    .select("order_id, quantity, inventory_item_id, product_id")
    .in("order_id", ids)

  const inventoryIds = new Set<string>()
  for (const item of orderItems || []) {
    const row = item as { inventory_item_id?: string; product_id?: string }
    if (row.inventory_item_id) inventoryIds.add(row.inventory_item_id)
    if (row.product_id) inventoryIds.add(row.product_id)
  }

  let itemNameById: Record<string, string> = {}
  if (inventoryIds.size > 0) {
    const { data: invItems } = await supabase
      .from("inventory_items")
      .select("id, item_name")
      .in("id", [...inventoryIds])
    for (const inv of invItems || []) {
      const i = inv as { id: string; item_name: string }
      itemNameById[i.id] = i.item_name ?? ""
    }
  }

  const itemDetailsByOrder: Record<string, string[]> = {}
  for (const item of orderItems || []) {
    const row = item as { order_id: string; quantity: number; inventory_item_id?: string; product_id?: string }
    const name = itemNameById[row.inventory_item_id ?? ""] || itemNameById[row.product_id ?? ""] || "Item"
    const part = `${name} x ${row.quantity}`
    if (!itemDetailsByOrder[row.order_id]) itemDetailsByOrder[row.order_id] = []
    itemDetailsByOrder[row.order_id].push(part)
  }
  for (const orderId of ids) {
    const row = orderMap.get(orderId)
    if (row) row.item_details = (itemDetailsByOrder[orderId] || []).join(", ")
  }

  const { data: dispatches } = await supabase
    .from("dispatches")
    .select("order_id, dispatch_date, tracking_id, courier_company_id")
    .in("order_id", ids)
    .neq("dispatch_type", "return")
    .order("dispatch_date", { ascending: false })

  const courierIds = new Set<string>()
  for (const d of dispatches || []) {
    const row = d as { courier_company_id?: string }
    if (row.courier_company_id) courierIds.add(row.courier_company_id)
  }
  let courierNameById: Record<string, string> = {}
  if (courierIds.size > 0) {
    const { data: couriers } = await supabase
      .from("courier_companies")
      .select("id, name")
      .in("id", [...courierIds])
    for (const c of couriers || []) {
      const x = c as { id: string; name: string }
      courierNameById[x.id] = x.name ?? ""
    }
  }

  const firstDispatchByOrder: Record<string, { dispatch_date: string; tracking_id: string | null; courier_name: string }> = {}
  for (const d of dispatches || []) {
    const row = d as { order_id: string; dispatch_date?: string; tracking_id?: string | null; courier_company_id?: string }
    if (firstDispatchByOrder[row.order_id]) continue
    firstDispatchByOrder[row.order_id] = {
      dispatch_date: row.dispatch_date ? new Date(row.dispatch_date).toLocaleDateString() : "",
      tracking_id: row.tracking_id ?? null,
      courier_name: row.courier_company_id ? courierNameById[row.courier_company_id] ?? "" : ""
    }
  }
  for (const orderId of ids) {
    const row = orderMap.get(orderId)
    const disp = firstDispatchByOrder[orderId]
    if (row && disp) {
      row.dispatch_date = disp.dispatch_date
      row.tracking_id = disp.tracking_id
      row.courier_name = disp.courier_name
    }
  }

  const result = orderIds.map((id) => orderMap.get(id) ?? emptyRow(id))
  return { success: true, data: result, error: null }
}

// Get inventory items for order (parent items with sub-items)
export async function getInventoryItemsForOrder() {
  const supabase = await createClient()

  // Get all parent items (items without parent)
  const { data: items, error } = await supabase
    .from("inventory_items")
    .select("id, sr_no, item_name, date")
    .eq("is_active", true)
    .is("parent_item_id", null)
    .not("sr_no", "is", null)
    .order("sr_no", { ascending: true })

  if (error) {
    return { success: false, error: error.message, data: null }
  }

  // Get sub-items for each parent item
  if (items && items.length > 0) {
    const itemIds = items.map(item => item.id)
    const { data: subItems } = await supabase
      .from("inventory_items")
      .select("id, item_name, date, parent_item_id")
      .eq("is_active", true)
      .in("parent_item_id", itemIds)
      .order("created_at", { ascending: true })

    // Group sub-items by parent
    const itemsWithSubItems = items.map(item => ({
      ...item,
      sub_items: subItems?.filter(sub => sub.parent_item_id === item.id) || []
    }))

    return { success: true, data: itemsWithSubItems, error: null }
  }

  return { success: true, data: items || [], error: null }
}

// Add item to order
export async function addItemToOrder(orderId: string, inventoryItemId: string, quantity: number) {
  const supabase = await createClient()

  // Get inventory item details
  const { data: inventoryItem, error: itemError } = await supabase
    .from("inventory_items")
    .select("id, item_name")
    .eq("id", inventoryItemId)
    .single()

  if (itemError || !inventoryItem) {
    return { success: false, error: "Inventory item not found" }
  }

  // Check if item already exists in order (check both product_id and inventory_item_id)
  const { data: existingItem } = await supabase
    .from("order_items")
    .select("id, quantity")
    .eq("order_id", orderId)
    .or(`inventory_item_id.eq.${inventoryItemId},product_id.eq.${inventoryItemId}`)
    .maybeSingle()

  if (existingItem) {
    // Update quantity
    const newQuantity = existingItem.quantity + quantity
    const { error: updateError } = await supabase
      .from("order_items")
      .update({ quantity: newQuantity })
      .eq("id", existingItem.id)

    if (updateError) {
      return { success: false, error: updateError.message }
    }
  } else {
    // Insert new item using inventory_item_id
    const { error: insertError } = await supabase
      .from("order_items")
      .insert({
        order_id: orderId,
        inventory_item_id: inventoryItemId,
        product_id: null, // Using inventory_item_id instead
        quantity: quantity,
        unit_price: 0, // Will be updated later if needed
      })

    if (insertError) {
      return { success: false, error: insertError.message }
    }
  }

  // Order stays in "New Order" when items are added; moves to "In Progress" when first production record is created

  revalidatePath(`/dashboard/orders/${orderId}`)
  return { success: true }
}

// Update item quantity in order
export async function updateOrderItemQuantity(orderItemId: string, quantity: number) {
  const supabase = await createClient()

  if (quantity <= 0) {
    return { success: false, error: "Quantity must be greater than 0" }
  }

  // Check how much has already been dispatched - CRITICAL FIX
  const { data: dispatchItems, error: dispatchError } = await supabase
    .from("dispatch_items")
    .select("quantity")
    .eq("order_item_id", orderItemId)

  if (dispatchError) {
    return { success: false, error: `Failed to check dispatch status: ${dispatchError.message}` }
  }

  const dispatchedQty = dispatchItems?.reduce((sum, item) => sum + item.quantity, 0) || 0

  if (quantity < dispatchedQty) {
    return {
      success: false,
      error: `Cannot reduce quantity to ${quantity}. Already dispatched: ${dispatchedQty} units. New quantity must be at least ${dispatchedQty}.`
    }
  }

  const { error } = await supabase
    .from("order_items")
    .update({ quantity })
    .eq("id", orderItemId)

  if (error) {
    return { success: false, error: error.message }
  }

  // Get order_id to revalidate
  const { data: orderItem } = await supabase
    .from("order_items")
    .select("order_id")
    .eq("id", orderItemId)
    .single()

  if (orderItem) {
    revalidatePath(`/dashboard/orders/${orderItem.order_id}`)
  }

  return { success: true }
}

// Remove item from order
export async function removeItemFromOrder(orderItemId: string) {
  const supabase = await createClient()

  // Check dispatch history for this item (includes returns as negative quantities)
  const { data: dispatchItems, error: checkError } = await supabase
    .from("dispatch_items")
    .select("id, quantity")
    .eq("order_item_id", orderItemId)

  if (checkError) {
    return { success: false, error: `Failed to check dispatch status: ${checkError.message}` }
  }

  const outstandingDispatched = dispatchItems?.reduce((sum, item) => sum + item.quantity, 0) || 0

  // Block deletion only when there is still net quantity with customer
  if (outstandingDispatched > 0) {
    return {
      success: false,
      error: `Cannot delete this item - ${outstandingDispatched} units are still dispatched. To remove this item, first create a return dispatch for the remaining dispatched units, then try deleting again.`,
      canCreateReturn: true,
      dispatchedQuantity: outstandingDispatched
    }
  }

  // If dispatch and return history nets to zero, remove dispatch item rows to satisfy FK constraint
  if (dispatchItems && dispatchItems.length > 0) {
    const { error: cleanupError } = await supabase
      .from("dispatch_items")
      .delete()
      .eq("order_item_id", orderItemId)

    if (cleanupError) {
      return { success: false, error: `Failed to clear dispatch history for item deletion: ${cleanupError.message}` }
    }
  }

  // Get order_id before deleting
  const { data: orderItem } = await supabase
    .from("order_items")
    .select("order_id")
    .eq("id", orderItemId)
    .single()

  const { error } = await supabase
    .from("order_items")
    .delete()
    .eq("id", orderItemId)

  if (error) {
    return { success: false, error: error.message }
  }

  if (orderItem) {
    revalidatePath(`/dashboard/orders/${orderItem.order_id}`)
  }

  return { success: true }
}

// Create dispatch (partial or full)
export async function createDispatch(
  orderId: string,
  dispatchType: "partial" | "full",
  dispatchItems: Array<{ order_item_id: string; quantity: number }>,
  notes?: string,
  courierCompanyId?: string,
  trackingId?: string,
  productionRecordId?: string
) {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "User not authenticated" }
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return { success: false, error: "User profile not found" }
  }

  // Validate dispatch items
  if (!dispatchItems || dispatchItems.length === 0) {
    return { success: false, error: "No items to dispatch" }
  }

  // Get order details to validate
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_status")
    .eq("id", orderId)
    .single()

  if (orderError || !order) {
    return { success: false, error: "Order not found" }
  }

  // Get all order items to validate quantities
  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .select("id, quantity")
    .eq("order_id", orderId)

  if (itemsError) {
    return { success: false, error: itemsError.message }
  }

  // Validate dispatch quantities - FIX: Check cumulative quantities
  for (const dispatchItem of dispatchItems) {
    const orderItem = orderItems?.find(item => item.id === dispatchItem.order_item_id)
    if (!orderItem) {
      return { success: false, error: `Order item ${dispatchItem.order_item_id} not found` }
    }

    // Get previously dispatched quantity for this item
    const { data: previousDispatch, error: prevError } = await supabase
      .from("dispatch_items")
      .select("quantity")
      .eq("order_item_id", dispatchItem.order_item_id)

    if (prevError) {
      return { success: false, error: `Failed to check previous dispatches: ${prevError.message}` }
    }

    const previouslyDispatched = previousDispatch?.reduce((sum, item) => sum + item.quantity, 0) || 0
    const totalWillBeDispatched = previouslyDispatched + dispatchItem.quantity

    // Validate total dispatched doesn't exceed order quantity
    if (totalWillBeDispatched > orderItem.quantity) {
      return {
        success: false,
        error: `Cannot dispatch ${dispatchItem.quantity} units for this item. Already dispatched: ${previouslyDispatched}, Order quantity: ${orderItem.quantity}. Remaining available: ${orderItem.quantity - previouslyDispatched}`
      }
    }

    if (dispatchItem.quantity <= 0) {
      return { success: false, error: "Dispatch quantity must be greater than 0" }
    }
  }

  // Create dispatch
  const { data: dispatch, error: dispatchError } = await supabase
    .from("dispatches")
    .insert({
      order_id: orderId,
      dispatch_type: dispatchType,
      dispatch_date: new Date().toISOString().split('T')[0],
      notes: notes || null,
      courier_company_id: courierCompanyId || null,
      tracking_id: trackingId || null,
      production_record_id: productionRecordId || null,
      shipment_status: 'ready', // Default status
      created_by: profile.id,
    })
    .select()
    .single()

  if (dispatchError) {
    return { success: false, error: dispatchError.message }
  }

  // Create dispatch items
  // Get order items with inventory_item_id and product_id
  const { data: fullOrderItems } = await supabase
    .from("order_items")
    .select("id, inventory_item_id, product_id")
    .in("id", dispatchItems.map(di => di.order_item_id))

  // Update dispatch items with correct inventory_item_id or product_id
  const finalDispatchItems = dispatchItems.map(di => {
    const fullOrderItem = fullOrderItems?.find(item => item.id === di.order_item_id)
    return {
      dispatch_id: dispatch.id,
      order_item_id: di.order_item_id,
      inventory_item_id: fullOrderItem?.inventory_item_id || null,
      product_id: fullOrderItem?.product_id || null,
      quantity: di.quantity,
    }
  })

  const { error: dispatchItemsError } = await supabase
    .from("dispatch_items")
    .insert(finalDispatchItems)

  if (dispatchItemsError) {
    // Rollback dispatch creation
    await supabase.from("dispatches").delete().eq("id", dispatch.id)
    return { success: false, error: dispatchItemsError.message }
  }

  // Update order status: dispatch created -> Ready for Dispatch (In Transit is set when shipment is marked Picked Up)
  const newOrderStatus = "Ready for Dispatch"

  // Update order status
  const { error: updateError } = await supabase
    .from("orders")
    .update({ order_status: newOrderStatus })
    .eq("id", orderId)

  if (updateError) {
    // Attempt to rollback the created dispatch and dispatch_items to avoid partial state
    try {
      await supabase.from("dispatch_items").delete().eq("dispatch_id", dispatch.id)
      await supabase.from("dispatches").delete().eq("id", dispatch.id)
    } catch (rbErr) {
      console.error("Failed to rollback dispatch after order status update failure:", rbErr)
    }
    return { success: false, error: `Failed to update order status: ${updateError.message}` }
  }

  revalidatePath(`/dashboard/orders/${orderId}`)
  revalidatePath("/dashboard/orders")

  return { success: true, data: dispatch }
}

// Create a return dispatch (for handling returned items)
export async function createReturnDispatch(
  orderId: string,
  returnItems: Array<{ order_item_id: string; quantity: number; reason?: string }>,
  notes?: string
) {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "User not authenticated" }
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return { success: false, error: "User profile not found" }
  }

  // Validate return items
  if (!returnItems || returnItems.length === 0) {
    return { success: false, error: "No items to return" }
  }

  // Validate that items were actually dispatched
  for (const returnItem of returnItems) {
    if (returnItem.quantity <= 0) {
      return { success: false, error: "Return quantity must be greater than 0" }
    }

    const { data: dispatchedItems } = await supabase
      .from("dispatch_items")
      .select("quantity")
      .eq("order_item_id", returnItem.order_item_id)

    const outstandingDispatched = dispatchedItems?.reduce((sum, item) => sum + item.quantity, 0) || 0

    if (outstandingDispatched < returnItem.quantity) {
      return {
        success: false,
        error: `Cannot return ${returnItem.quantity} units. Only ${outstandingDispatched} units are currently dispatched.`
      }
    }
  }

  // Create return dispatch record
  const { data: returnDispatch, error: returnError } = await supabase
    .from("dispatches")
    .insert({
      order_id: orderId,
      dispatch_type: "return",
      dispatch_date: new Date().toISOString().split('T')[0],
      notes: notes || "Return dispatch",
      shipment_status: "returned",
      created_by: profile.id,
    })
    .select()
    .single()

  if (returnError) {
    return { success: false, error: returnError.message }
  }

  // Create return dispatch items
  const { data: fullOrderItems } = await supabase
    .from("order_items")
    .select("id, inventory_item_id, product_id")
    .in("id", returnItems.map(ri => ri.order_item_id))

  const returnDispatchItems = returnItems.map(ri => {
    const fullOrderItem = fullOrderItems?.find(item => item.id === ri.order_item_id)
    return {
      dispatch_id: returnDispatch.id,
      order_item_id: ri.order_item_id,
      inventory_item_id: fullOrderItem?.inventory_item_id || null,
      product_id: fullOrderItem?.product_id || null,
      quantity: -ri.quantity, // Negative quantity to indicate return
    }
  })

  const { error: returnItemsError } = await supabase
    .from("dispatch_items")
    .insert(returnDispatchItems)

  if (returnItemsError) {
    // Rollback
    await supabase.from("dispatches").delete().eq("id", returnDispatch.id)
    return { success: false, error: returnItemsError.message }
  }

  revalidatePath(`/dashboard/orders/${orderId}`)
  revalidatePath("/dashboard/orders")

  return { success: true, data: returnDispatch }
}

// Get dispatches for an order
export async function getOrderDispatches(orderId: string) {
  const supabase = await createClient()

  const { data: dispatches, error } = await supabase
    .from("dispatches")
    .select(`
      *,
      courier_companies (
        id,
        name,
        tracking_url
      ),
      production_records (
        id,
        production_number,
        production_type,
        status,
        pdf_file_url
      ),
      dispatch_items (
        id,
        quantity,
        order_items (
          id,
          quantity,
          inventory_item_id,
          product_id
        )
      ),
      production_pdfs (
        id,
        file_name,
        file_url,
        file_size,
        created_at
      )
    `)
    .eq("order_id", orderId)
    .order("dispatch_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    return { success: false, error: error.message, data: null }
  }

  return { success: true, data: dispatches || [], error: null }
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/** Recompute order_status from delivered quantities vs order lines (non-return dispatches only). */
async function syncOrderStatusAfterDispatchChange(
  supabase: SupabaseServerClient,
  orderId: string
) {
  const { data: orderRow } = await supabase
    .from("orders")
    .select("order_status")
    .eq("id", orderId)
    .single()

  if (!orderRow || orderRow.order_status === "Void") return

  const { data: orderItems } = await supabase
    .from("order_items")
    .select("id, quantity")
    .eq("order_id", orderId)

  const { data: dispatches } = await supabase
    .from("dispatches")
    .select("id, shipment_status, dispatch_type")
    .eq("order_id", orderId)

  const nonReturn = (dispatches || []).filter((d) => d.dispatch_type !== "return")
  const deliveredDispIds = nonReturn
    .filter((d) => d.shipment_status === "delivered")
    .map((d) => d.id)

  const { data: dispatchItems } =
    deliveredDispIds.length > 0
      ? await supabase
          .from("dispatch_items")
          .select("order_item_id, quantity")
          .in("dispatch_id", deliveredDispIds)
      : { data: [] as { order_item_id: string; quantity: number | null }[] }

  const deliveredByItem: Record<string, number> = {}
  for (const di of dispatchItems || []) {
    const oid = di.order_item_id
    if (!oid) continue
    deliveredByItem[oid] = (deliveredByItem[oid] || 0) + Number(di.quantity || 0)
  }

  const items = orderItems || []
  if (items.length === 0) return

  let fullyDelivered = true
  let someDelivered = false
  for (const item of items) {
    const d = deliveredByItem[item.id] || 0
    if (d > 0) someDelivered = true
    if (d < Number(item.quantity)) fullyDelivered = false
  }

  let nextStatus: string | null = null
  if (fullyDelivered) {
    nextStatus = "Delivered"
  } else if (someDelivered) {
    nextStatus = "Partial Delivered"
  } else if (nonReturn.some((d) => d.shipment_status === "picked_up")) {
    nextStatus = "In Transit"
  }

  if (nextStatus) {
    await supabase.from("orders").update({ order_status: nextStatus }).eq("id", orderId)
  }
}

// Update dispatch shipment status
export async function updateDispatchStatus(
  dispatchId: string,
  status: 'ready' | 'picked_up' | 'delivered'
) {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "User not authenticated" }
  }

  // Update dispatch status
  const { data: dispatch, error } = await supabase
    .from("dispatches")
    .update({ shipment_status: status })
    .eq("id", dispatchId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  if (dispatch?.order_id) {
    await syncOrderStatusAfterDispatchChange(supabase, dispatch.order_id)
  }

  revalidatePath(`/dashboard/orders/${dispatch.order_id}`)
  revalidatePath("/dashboard/orders")

  return { success: true, data: dispatch }
}

// Update order payment details
export async function updateOrderPayment(
  orderId: string,
  invoiceNumber?: string,
  zohoBillingDetails?: any,
  paymentStatus?: 'complete' | 'partial' | 'pending',
  paymentDate?: string,
  partialPaymentAmount?: number,
  remainingPaymentAmount?: number,
  requestedPaymentAmount?: number | null
) {
  const supabase = await createClient()

  // Validate payment status - CRITICAL FIX: Orders must be dispatched before marking paid
  if (paymentStatus === 'complete' || paymentStatus === 'partial') {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("order_status")
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      return { success: false, error: "Order not found" }
    }

    // Check that order is in a dispatched state before payment
    const dispatchedStates = ['Ready for Dispatch', 'In Transit', 'Delivered', 'Partial Delivered']
    if (!dispatchedStates.includes(order.order_status)) {
      return {
        success: false,
        error: `Cannot mark order as paid. Order must be dispatched first. Current status: "${order.order_status}"`
      }
    }
  }

  const updateData: any = {}
  if (invoiceNumber !== undefined) {
    updateData.invoice_number = invoiceNumber || null
  }
  if (zohoBillingDetails !== undefined) {
    updateData.zoho_billing_details = zohoBillingDetails || null
  }
  if (paymentStatus !== undefined) {
    if (paymentStatus === 'complete') {
      updateData.payment_status = 'Paid'
      updateData.partial_payment_amount = null
      updateData.remaining_payment_amount = null
    } else if (paymentStatus === 'partial') {
      updateData.payment_status = 'Partial'
      if (partialPaymentAmount !== undefined) {
        updateData.partial_payment_amount = partialPaymentAmount
      }
      if (remainingPaymentAmount !== undefined) {
        updateData.remaining_payment_amount = remainingPaymentAmount
      }
    } else {
      updateData.payment_status = 'Pending'
      updateData.partial_payment_amount = null
      updateData.remaining_payment_amount = null
    }
  }
  // Note: payment_date is not stored on orders; use order_payments for per-payment dates.
  if (requestedPaymentAmount !== undefined) {
    updateData.requested_payment_amount = requestedPaymentAmount === null || requestedPaymentAmount === undefined || Number.isNaN(requestedPaymentAmount) ? null : requestedPaymentAmount
  }

  // When invoice number is set and order is Ready for Dispatch, auto-set order status to Invoiced
  if (invoiceNumber !== undefined && invoiceNumber?.trim()) {
    const { data: orderRow } = await supabase
      .from("orders")
      .select("order_status")
      .eq("id", orderId)
      .single()
    if (orderRow?.order_status === "Ready for Dispatch") {
      updateData.order_status = "Invoiced"
    }
  }

  const { data, error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", orderId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/dashboard/orders/${orderId}`)
  return { success: true, data }
}

// Get payment followups for an order
export async function getOrderPaymentFollowups(orderId: string) {
  const supabase = await createClient()

  const { data: followups, error } = await supabase
    .from("payment_followups")
    .select("*")
    .eq("order_id", orderId)
    .order("followup_date", { ascending: true })

  if (error) {
    return { success: false, error: error.message, data: null }
  }

  return { success: true, data: followups || [], error: null }
}

// Get payment follow-ups for the Follow Up page: one per order (canonical = first dispatch + 14 days).
// Filters out duplicate rows so the page shows the same single follow-up per order as the order detail.
export async function getPaymentFollowupsForPage() {
  const supabase = await createClient()

  const { data: followups, error: followupsError } = await supabase
    .from("payment_followups")
    .select(`
      id,
      order_id,
      followup_date,
      payment_received,
      payment_date,
      notes,
      orders (
        internal_order_number,
        customers (name)
      )
    `)
    .order("followup_date", { ascending: false })

  if (followupsError) {
    return { success: false, error: followupsError.message, data: null }
  }

  const list = followups || []
  if (list.length === 0) {
    return { success: true, data: [], error: null }
  }

  const orderIds = [...new Set(list.map((f: { order_id: string }) => f.order_id))]

  const { data: dispatchRows, error: dispatchError } = await supabase
    .from("dispatches")
    .select("order_id, dispatch_date")
    .in("order_id", orderIds)

  if (dispatchError) {
    return { success: false, error: dispatchError.message, data: null }
  }

  const firstDispatchByOrder: Record<string, string> = {}
  for (const r of dispatchRows || []) {
    const oid = (r as { order_id: string }).order_id
    const d = (r as { dispatch_date?: string }).dispatch_date
    if (!d) continue
    if (!firstDispatchByOrder[oid] || d < firstDispatchByOrder[oid]) {
      firstDispatchByOrder[oid] = d
    }
  }

  const canonicalFollowupDateByOrder: Record<string, string> = {}
  for (const [orderId, firstStr] of Object.entries(firstDispatchByOrder)) {
    const d = new Date(firstStr)
    const plus14 = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    plus14.setDate(plus14.getDate() + 14)
    canonicalFollowupDateByOrder[orderId] = plus14.toISOString().split("T")[0]
  }

  const todayStr = new Date().toISOString().split("T")[0]

  const filtered = list.filter((f: { order_id: string; followup_date: string }) => {
    const canonical = canonicalFollowupDateByOrder[f.order_id]
    if (canonical == null || f.followup_date !== canonical) return false
    // Only show follow-ups that are due today or overdue (match order detail: show from follow-up date onward)
    return f.followup_date <= todayStr
  })

  return { success: true, data: filtered, error: null }
}

// Ensure a payment followup exists when payment is outstanding and 14+ days since first dispatch
export async function ensurePaymentFollowupForOrder(orderId: string) {
  const supabase = await createClient()

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("requested_payment_amount, total_price, created_at, updated_at")
    .eq("id", orderId)
    .single()

  if (orderError || !order) {
    return { success: false, error: "Order not found" }
  }

  const requested = order.requested_payment_amount != null
    ? Number(order.requested_payment_amount)
    : (Number(order.total_price) || 0)
  if (requested <= 0) return { success: true }

  const { data: payments } = await supabase
    .from("order_payments")
    .select("amount")
    .eq("order_id", orderId)
  const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const amountDue = Math.max(0, requested - totalPaid)
  if (amountDue <= 0) return { success: true }

  const { data: dispatches } = await supabase
    .from("dispatches")
    .select("dispatch_date")
    .eq("order_id", orderId)
  const dispatchDates = (dispatches || [])
    .map((d: { dispatch_date?: string | null }) => d.dispatch_date)
    .filter((d): d is string => !!d)
  const firstDispatchDateStr = dispatchDates.length > 0 ? dispatchDates.sort()[0] : null

  const referenceDate = firstDispatchDateStr
    ? new Date(firstDispatchDateStr)
    : new Date((order.updated_at || order.created_at) as string)
  const referenceDateOnly = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
  const overdueDate = new Date(referenceDateOnly)
  overdueDate.setDate(overdueDate.getDate() + 14)
  const today = new Date()
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (overdueDate > todayOnly) return { success: true }

  const followupDateStr = overdueDate.toISOString().split("T")[0]

  const { data: existing } = await supabase
    .from("payment_followups")
    .select("id")
    .eq("order_id", orderId)
    .eq("followup_date", followupDateStr)
    .maybeSingle()
  if (existing) return { success: true }

  const { error: insertError } = await supabase
    .from("payment_followups")
    .insert({
      order_id: orderId,
      followup_date: followupDateStr,
      payment_received: false,
    })

  if (insertError) {
    if (insertError.code === "23505") return { success: true }
    return { success: false, error: insertError.message }
  }

  revalidatePath(`/dashboard/orders/${orderId}`)
  revalidatePath("/dashboard/follow-up")
  return { success: true }
}

// Ensure payment follow-ups exist for all orders that have passed 14 days since first dispatch with amount due.
// Used when loading the Follow Up page so the list is complete without requiring each order to be opened first.
export async function ensureAllPaymentFollowups() {
  const supabase = await createClient()

  const { data: dispatchRows, error: dispatchError } = await supabase
    .from("dispatches")
    .select("order_id")

  if (dispatchError) {
    return { success: false, error: dispatchError.message }
  }

  const orderIds = [...new Set((dispatchRows || []).map((r: { order_id: string }) => r.order_id))]

  for (const orderId of orderIds) {
    await ensurePaymentFollowupForOrder(orderId)
  }

  revalidatePath("/dashboard/follow-up")
  return { success: true }
}

// Update payment followup
export async function updatePaymentFollowup(
  followupId: string,
  paymentReceived: boolean,
  paymentDate?: string,
  notes?: string
) {
  const supabase = await createClient()

  const updateData: any = {
    payment_received: paymentReceived,
  }

  if (paymentDate !== undefined) {
    updateData.payment_date = paymentDate || null
  }
  if (notes !== undefined) {
    updateData.notes = notes || null
  }

  const { data, error } = await supabase
    .from("payment_followups")
    .update(updateData)
    .eq("id", followupId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Get order_id to revalidate
  const { data: followup } = await supabase
    .from("payment_followups")
    .select("order_id")
    .eq("id", followupId)
    .single()

  if (followup) {
    revalidatePath(`/dashboard/orders/${followup.order_id}`)
    revalidatePath("/dashboard/follow-up")
  }

  return { success: true, data }
}

// Update order
export async function updateOrder(
  orderId: string,
  formData: {
    sales_order_number?: string
    customer_id?: string
    cash_discount?: boolean
    order_status?: string
  }
) {
  const supabase = await createClient()

  // Validate status transitions if status is being updated - CRITICAL FIX
  if (formData.order_status !== undefined) {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("order_status")
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      return { success: false, error: "Order not found" }
    }

    const currentStatus = order.order_status
    const newStatus = formData.order_status

    // Define valid state transitions (new order stages)
    const validTransitions: Record<string, string[]> = {
      'New Order': ['In Progress', 'Void'],
      'In Progress': ['Ready for Dispatch', 'Void'],
      'Ready for Dispatch': ['Invoiced', 'In Transit', 'Void'],
      'Invoiced': ['In Transit', 'Void'],
      'In Transit': ['Delivered', 'Partial Delivered', 'Void'],
      'Partial Delivered': ['Delivered', 'Void'],
      'Delivered': ['Void'],
      'Void': []
    }

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      return {
        success: false,
        error: `Invalid status transition: Cannot change from "${currentStatus}" to "${newStatus}". Valid next statuses: ${validTransitions[currentStatus]?.join(', ') || 'None'}`
      }
    }

    // Invoiced: require invoice_number to be set
    if (newStatus === 'Invoiced') {
      const { data: orderRow } = await supabase
        .from("orders")
        .select("invoice_number")
        .eq("id", orderId)
        .single()
      if (!orderRow?.invoice_number?.trim()) {
        return {
          success: false,
          error: "Please set Invoice Number before marking order as Invoiced."
        }
      }
    }
  }

  const updateData: any = {}
  if (formData.sales_order_number !== undefined) {
    updateData.sales_order_number = formData.sales_order_number || null
  }
  if (formData.customer_id !== undefined) {
    updateData.customer_id = formData.customer_id
  }
  if (formData.cash_discount !== undefined) {
    updateData.cash_discount = formData.cash_discount
  }
  if (formData.order_status !== undefined) {
    updateData.order_status = formData.order_status
  }

  const { data, error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", orderId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/dashboard/orders/${orderId}`)
  revalidatePath("/dashboard/orders")

  return { success: true, data }
}

// Delete order
export async function deleteOrder(orderId: string) {
  const supabase = await createClient()

  // Check if order exists
  const { data: order, error: checkError } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .single()

  if (checkError || !order) {
    return { success: false, error: "Order not found" }
  }

  // Check if there are dispatches and delete them first (in case cascade doesn't work)
  const { data: dispatches } = await supabase
    .from("dispatches")
    .select("id")
    .eq("order_id", orderId)

  // Delete dispatches first if they exist (cascade should handle this, but doing it manually as fallback)
  if (dispatches && dispatches.length > 0) {
    const { error: dispatchError } = await supabase
      .from("dispatches")
      .delete()
      .eq("order_id", orderId)

    if (dispatchError) {
      return {
        success: false,
        error: `Cannot delete order: Failed to delete associated dispatches. ${dispatchError.message}`
      }
    }
  }

  // Delete order (cascade should handle related records like order_items, payment_followups, etc.)
  const { error } = await supabase
    .from("orders")
    .delete()
    .eq("id", orderId)

  if (error) {
    // Provide a more user-friendly error message
    if (error.message.includes("foreign key")) {
      return {
        success: false,
        error: `Cannot delete order: ${error.message}. Please run the database migration to fix foreign key constraints.`
      }
    }
    return { success: false, error: error.message }
  }

  revalidatePath("/dashboard/orders")

  return { success: true }
}

// Upload production PDF (placeholder - will need file upload implementation)
export async function uploadProductionPDF(
  orderId: string,
  dispatchId: string | null,
  fileName: string,
  fileUrl: string,
  fileSize?: number
) {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "User not authenticated" }
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return { success: false, error: "User profile not found" }
  }

  const { data, error } = await supabase
    .from("production_pdfs")
    .insert({
      order_id: orderId,
      dispatch_id: dispatchId || null,
      file_name: fileName,
      file_url: fileUrl,
      file_size: fileSize || null,
      uploaded_by: profile.id,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/dashboard/orders/${orderId}`)

  return { success: true, data }
}

// Delete production PDF
export async function deleteProductionPDF(pdfId: string) {
  const supabase = await createClient()

  // Get order_id before deleting
  const { data: pdf } = await supabase
    .from("production_pdfs")
    .select("order_id")
    .eq("id", pdfId)
    .single()

  const { error } = await supabase
    .from("production_pdfs")
    .delete()
    .eq("id", pdfId)

  if (error) {
    return { success: false, error: error.message }
  }

  if (pdf) {
    revalidatePath(`/dashboard/orders/${pdf.order_id}`)
  }

  return { success: true }
}

// Create production list and upload PDF
export async function createProductionList(
  orderId: string,
  productionType: "full" | "partial",
  selectedQuantities?: Record<string, number>,
  pdfBlob?: Blob,
  fileName?: string
) {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "User not authenticated" }
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return { success: false, error: "User profile not found" }
  }

  // Get the next production number for this order
  const { data: existingLists, error: countError } = await supabase
    .from("production_lists")
    .select("production_number")
    .eq("order_id", orderId)
    .order("production_number", { ascending: false })
    .limit(1)

  if (countError) {
    return { success: false, error: countError.message }
  }

  const nextProductionNumber = existingLists && existingLists.length > 0
    ? existingLists[0].production_number + 1
    : 1

  // Upload PDF to storage if provided
  let pdfFileUrl: string | null = null
  let pdfFileName: string | null = null
  let pdfFileSize: number | null = null

  if (pdfBlob && fileName) {
    const filePath = `production-pdfs/${orderId}/${Date.now()}-${fileName}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("production-pdfs")
      .upload(filePath, pdfBlob, {
        contentType: "application/pdf",
        upsert: false
      })

    if (uploadError) {
      // If bucket doesn't exist, create it or use public URL
      // For now, we'll use a data URL approach or handle the error
      console.error("Storage upload error:", uploadError)
      // Fallback: we'll store the PDF data in the database or use a different approach
      return { success: false, error: `Failed to upload PDF: ${uploadError.message}` }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("production-pdfs")
      .getPublicUrl(filePath)

    pdfFileUrl = urlData.publicUrl
    pdfFileName = fileName
    pdfFileSize = pdfBlob.size
  }

  // Create production list record
  const { data: productionList, error: listError } = await supabase
    .from("production_lists")
    .insert({
      order_id: orderId,
      production_number: nextProductionNumber,
      production_type: productionType,
      selected_quantities: selectedQuantities || null,
      pdf_file_name: pdfFileName,
      pdf_file_url: pdfFileUrl,
      pdf_file_size: pdfFileSize,
      created_by: profile.id,
    })
    .select()
    .single()

  if (listError) {
    return { success: false, error: listError.message }
  }

  // Also create a production_pdfs record for backward compatibility
  if (pdfFileUrl && pdfFileName) {
    await supabase
      .from("production_pdfs")
      .insert({
        order_id: orderId,
        dispatch_id: null,
        production_list_id: productionList.id,
        file_name: pdfFileName,
        file_url: pdfFileUrl,
        file_size: pdfFileSize,
        uploaded_by: profile.id,
      })
  }

  revalidatePath(`/dashboard/orders/${orderId}`)

  return { success: true, data: productionList }
}

// Get production lists for an order
export async function getOrderProductionLists(orderId: string) {
  const supabase = await createClient()

  const { data: productionLists, error } = await supabase
    .from("production_lists")
    .select(`
      *,
      profiles (
        id,
        full_name,
        email
      )
    `)
    .eq("order_id", orderId)
    .order("production_number", { ascending: true })

  if (error) {
    return { success: false, error: error.message, data: null }
  }

  return { success: true, data: productionLists || [], error: null }
}

// Delete production list
export async function deleteProductionList(listId: string) {
  const supabase = await createClient()

  // Get order_id and file info before deleting
  const { data: productionList } = await supabase
    .from("production_lists")
    .select("order_id, pdf_file_url")
    .eq("id", listId)
    .single()

  // Delete PDF from storage if exists
  if (productionList?.pdf_file_url) {
    // Extract file path from URL
    const urlParts = productionList.pdf_file_url.split("/production-pdfs/")
    if (urlParts.length > 1) {
      const filePath = `production-pdfs/${urlParts[1]}`
      await supabase.storage
        .from("production-pdfs")
        .remove([filePath])
    }
  }

  // Delete production list (cascade will handle production_pdfs)
  const { error } = await supabase
    .from("production_lists")
    .delete()
    .eq("id", listId)

  if (error) {
    return { success: false, error: error.message }
  }

  if (productionList) {
    revalidatePath(`/dashboard/orders/${productionList.order_id}`)
  }

  return { success: true }
}

// ============================================
// Production Records Functions
// ============================================

// Generate production number (SK01A, SK01B, etc.)
function generateProductionNumber(
  orderNumber: string,
  existingRecords: any[],
  productionType: "full" | "partial"
): string {
  // For full production: use order number directly (SK01)
  if (productionType === "full") {
    return orderNumber
  }

  // For partial production: add suffix (SK01A, SK01B, etc.)
  const base = orderNumber.match(/^([A-Z]+\d+)/)?.[1] || orderNumber

  // Find highest suffix (A, B, C, etc.)
  const existingSuffixes = existingRecords
    .map((r: any) => r.production_number?.replace(base, '') || '')
    .filter((s: string) => /^[A-Z]$/.test(s))
    .map((s: string) => s.charCodeAt(0))

  const nextSuffix = existingSuffixes.length > 0
    ? String.fromCharCode(Math.max(...existingSuffixes) + 1)
    : 'A'

  return `${base}${nextSuffix}`
}

// Create production record
export async function createProductionRecord(
  orderId: string,
  productionType: "full" | "partial",
  selectedQuantities?: Record<string, number>,
  pdfBase64?: string, // Base64 encoded PDF data
  fileName?: string
) {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "User not authenticated" }
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return { success: false, error: "User profile not found" }
  }

  // Get order to get order number
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("internal_order_number")
    .eq("id", orderId)
    .single()

  if (orderError || !order) {
    return { success: false, error: "Order not found" }
  }

  const orderNumber = order.internal_order_number || `ORD-${orderId.substring(0, 8)}`

  // Get existing production records for this order
  const { data: existingRecords, error: countError } = await supabase
    .from("production_records")
    .select("production_number")
    .eq("order_id", orderId)

  if (countError) {
    return { success: false, error: countError.message }
  }

  // Generate production number
  const productionNumber = generateProductionNumber(orderNumber, existingRecords || [], productionType)

  // Upload PDF to storage if provided
  let pdfFileUrl: string | null = null
  let pdfFileName: string | null = null
  let pdfFileSize: number | null = null

  if (pdfBase64 && fileName) {
    // Convert base64 to Buffer for Supabase storage
    const buffer = Buffer.from(pdfBase64, 'base64')
    const filePath = `production-pdfs/${orderId}/${Date.now()}-${fileName}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("production-pdfs")
      .upload(filePath, buffer, {
        contentType: "application/pdf",
        upsert: false
      })

    if (uploadError) {
      console.error("Storage upload error:", uploadError)
      return { success: false, error: `Failed to upload PDF: ${uploadError.message}` }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("production-pdfs")
      .getPublicUrl(filePath)

    pdfFileUrl = urlData.publicUrl
    pdfFileName = fileName
    pdfFileSize = buffer.length
  }

  // Create production record
  const { data: productionRecord, error: recordError } = await supabase
    .from("production_records")
    .insert({
      order_id: orderId,
      production_number: productionNumber,
      production_type: productionType,
      selected_quantities: selectedQuantities || null,
      status: 'pending',
      pdf_file_name: pdfFileName,
      pdf_file_url: pdfFileUrl,
      pdf_file_size: pdfFileSize,
      created_by: profile.id,
    })
    .select()
    .single()

  if (recordError) {
    return { success: false, error: recordError.message }
  }

  // Also create a production_pdfs record for backward compatibility
  if (pdfFileUrl && pdfFileName) {
    await supabase
      .from("production_pdfs")
      .insert({
        order_id: orderId,
        dispatch_id: null,
        production_record_id: productionRecord.id,
        file_name: pdfFileName,
        file_url: pdfFileUrl,
        file_size: pdfFileSize,
        uploaded_by: profile.id,
      })
  }

  // First production record: move order from New Order to In Progress
  const { data: orderForStatus } = await supabase
    .from("orders")
    .select("order_status")
    .eq("id", orderId)
    .single()
  if (orderForStatus?.order_status === "New Order") {
    await supabase
      .from("orders")
      .update({ order_status: "In Progress" })
      .eq("id", orderId)
  }

  // Fire-and-forget: send WhatsApp notification with order and item details
  ;(async () => {
    try {
      const { data: orderRow } = await supabase
        .from("orders")
        .select("internal_order_number, customer_id")
        .eq("id", orderId)
        .single()

      if (!orderRow?.customer_id) return

      const { data: customer } = await supabase
        .from("customers")
        .select("name")
        .eq("id", orderRow.customer_id)
        .maybeSingle()

      const { data: orderItems } = await supabase
        .from("order_items")
        .select("id, inventory_item_id, product_id, quantity")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true })

      if (!orderItems?.length) return

      const allInvIds = [...new Set(
        orderItems.flatMap((oi: { inventory_item_id?: string; product_id?: string }) =>
          [oi.inventory_item_id, oi.product_id].filter(Boolean) as string[]
        )
      )]

      const { data: invRows } = await supabase
        .from("inventory_items")
        .select("id, item_name, parent_item_id")
        .in("id", allInvIds)

      const invMap = new Map<string, { item_name: string; parent_item_id: string | null }>()
      for (const row of invRows || []) {
        invMap.set(row.id, { item_name: row.item_name ?? "", parent_item_id: row.parent_item_id ?? null })
      }

      const items: { name: string; quantity: number }[] = orderItems.map(
        (oi: { inventory_item_id?: string; product_id?: string; quantity: number }, index: number) => {
          const invId = oi.inventory_item_id
          const prodId = oi.product_id
          const inv = invId ? invMap.get(invId) : undefined
          const prod = prodId ? invMap.get(prodId) : undefined

          let name: string
          if (inv?.parent_item_id) {
            const parent = invMap.get(inv.parent_item_id)
            name = parent ? `${parent.item_name} → ${inv.item_name}` : inv.item_name
          } else if (prod && prod.parent_item_id === invId && inv) {
            name = `${inv.item_name} → ${prod.item_name}`
          } else if (prod && prod.parent_item_id) {
            const parent = invMap.get(prod.parent_item_id)
            name = parent ? `${parent.item_name} → ${prod.item_name}` : prod.item_name
          } else {
            name = (inv?.item_name || prod?.item_name) || `Item ${index + 1}`
          }
          return { name, quantity: oi.quantity }
        }
      )

      await sendProductionRecordCreatedNotification({
        order_number: orderRow.internal_order_number ?? `ORD-${orderId.substring(0, 8)}`,
        customer_name: (customer as { name?: string } | null)?.name ?? "",
        items,
        order_id: orderId,
      })
    } catch (err) {
      console.error("[createProductionRecord] notification failed:", err)
    }
  })()

  // If this was the first partial production, order status was already updated above
  // Reload order details to reflect status change
  revalidatePath(`/dashboard/orders/${orderId}`)

  return { success: true, data: productionRecord }
}

// Get production records for an order
export async function getOrderProductionRecords(orderId: string) {
  const supabase = await createClient()

  const { data: productionRecords, error } = await supabase
    .from("production_records")
    .select(`
      *,
      profiles (
        id,
        full_name,
        email
      )
    `)
    .eq("order_id", orderId)
    .order("production_number", { ascending: true })

  if (error) {
    return { success: false, error: error.message, data: null }
  }

  return { success: true, data: productionRecords || [], error: null }
}

// Update production record status
export async function updateProductionRecordStatus(
  recordId: string,
  status: 'pending' | 'in_production' | 'completed'
) {
  const supabase = await createClient()

  // Get order_id before updating
  const { data: record } = await supabase
    .from("production_records")
    .select("order_id")
    .eq("id", recordId)
    .single()

  const { error } = await supabase
    .from("production_records")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", recordId)

  if (error) {
    return { success: false, error: error.message }
  }

  if (status === 'completed' && record?.order_id) {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("invoice_number, internal_order_number")
      .eq("id", record.order_id)
      .single()

    if (!orderError && order && !order.invoice_number) {
      const baseNumber = order.internal_order_number || record.order_id.substring(0, 8)
      const generatedInvoiceNumber = `INV-${baseNumber}`

      await supabase
        .from("orders")
        .update({ invoice_number: generatedInvoiceNumber })
        .eq("id", record.order_id)
    }
  }

  if (record) {
    revalidatePath(`/dashboard/orders/${record.order_id}`)
  }

  return { success: true }
}

// ============================================
// Invoice Attachments Functions
// ============================================

export async function getInvoiceAttachments(orderId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("invoice_attachments")
    .select(`
      *,
      profiles (
        id,
        full_name,
        email
      )
    `)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })

  if (error) {
    return { success: false, error: error.message, data: null }
  }

  return { success: true, data: data || [], error: null }
}

export async function uploadInvoiceAttachment(
  orderId: string,
  fileBase64: string,
  fileName: string,
  fileType: string,
  fileSize?: number
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "User not authenticated" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return { success: false, error: "User profile not found" }
  }

  const buffer = Buffer.from(fileBase64, 'base64')
  const storagePath = `invoice-attachments/${orderId}/${Date.now()}-${fileName}`

  const { error: uploadError } = await supabase.storage
    .from("invoice-attachments")
    .upload(storagePath, buffer, {
      contentType: fileType || "application/octet-stream",
      upsert: false,
    })

  if (uploadError) {
    return { success: false, error: `Failed to upload file: ${uploadError.message}` }
  }

  const { data: urlData } = supabase.storage
    .from("invoice-attachments")
    .getPublicUrl(storagePath)

  const { data, error } = await supabase
    .from("invoice_attachments")
    .insert({
      order_id: orderId,
      file_name: fileName,
      file_url: urlData.publicUrl,
      file_type: fileType || null,
      file_size: fileSize || buffer.length,
      storage_path: storagePath,
      uploaded_by: profile.id,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/dashboard/orders/${orderId}`)

  return { success: true, data }
}

export async function deleteInvoiceAttachment(attachmentId: string) {
  const supabase = await createClient()

  const { data: attachment, error: fetchError } = await supabase
    .from("invoice_attachments")
    .select("order_id, storage_path")
    .eq("id", attachmentId)
    .single()

  if (fetchError || !attachment) {
    return { success: false, error: fetchError?.message || "Attachment not found" }
  }

  if (attachment.storage_path) {
    await supabase.storage
      .from("invoice-attachments")
      .remove([attachment.storage_path])
  }

  const { error } = await supabase
    .from("invoice_attachments")
    .delete()
    .eq("id", attachmentId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/dashboard/orders/${attachment.order_id}`)

  return { success: true }
}

// ============================================
// Order Payment Records Functions
// ============================================

export async function getOrderPayments(orderId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("order_payments")
    .select(`
      *,
      profiles (
        id,
        full_name,
        email
      )
    `)
    .eq("order_id", orderId)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    return { success: false, error: error.message, data: null }
  }

  return { success: true, data: data || [], error: null }
}

export async function addOrderPayment(
  orderId: string,
  amount: number,
  paymentDate?: string,
  paymentMethod?: string,
  reference?: string,
  notes?: string
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "User not authenticated" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return { success: false, error: "User profile not found" }
  }

  if (!amount || isNaN(amount) || amount <= 0) {
    return { success: false, error: "Amount must be greater than 0" }
  }

  // Payment should only be recorded after dispatch - check order status OR presence of dispatch records
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("order_status")
    .eq("id", orderId)
    .single()

  if (orderError || !order) {
    return { success: false, error: "Order not found" }
  }

  const dispatchedStates = ['Ready for Dispatch', 'In Transit', 'Delivered', 'Partial Delivered']
  const hasDispatchedStatus = dispatchedStates.includes(order.order_status)

  // Also allow if order has dispatch records (handles cases where status wasn't updated)
  const { count: dispatchCount } = await supabase
    .from("dispatches")
    .select("*", { count: "exact", head: true })
    .eq("order_id", orderId)

  const hasDispatchRecords = (dispatchCount ?? 0) > 0

  if (!hasDispatchedStatus && !hasDispatchRecords) {
    return {
      success: false,
      error: `Cannot add payment record. Order must be dispatched first. Current status: "${order.order_status}"`
    }
  }

  // Fetch requested amount and total already paid to enforce amount <= remaining
  const { data: orderRow, error: orderFetchError } = await supabase
    .from("orders")
    .select("requested_payment_amount, total_price")
    .eq("id", orderId)
    .single()

  if (orderFetchError || !orderRow) {
    return { success: false, error: "Order not found" }
  }

  const requested = orderRow.requested_payment_amount != null
    ? Number(orderRow.requested_payment_amount)
    : (Number(orderRow.total_price) || 0)

  if (requested <= 0) {
    return {
      success: false,
      error: "Please set Requested Payment on the order before adding payment records."
    }
  }

  const { data: payments } = await supabase
    .from("order_payments")
    .select("amount")
    .eq("order_id", orderId)

  const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const remaining = Math.max(0, requested - totalPaid)

  if (amount > remaining) {
    return {
      success: false,
      error: `Amount cannot exceed remaining amount (₹${remaining.toLocaleString("en-IN", { minimumFractionDigits: 2 })}).`
    }
  }

  const { data, error } = await supabase
    .from("order_payments")
    .insert({
      order_id: orderId,
      amount,
      payment_date: paymentDate || new Date().toISOString().split('T')[0],
      payment_method: paymentMethod || null,
      reference: reference || null,
      notes: notes || null,
      created_by: profile.id,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/dashboard/orders/${orderId}`)
  return { success: true, data }
}

export async function deleteOrderPayment(paymentId: string) {
  const supabase = await createClient()

  // Get order_id before deleting
  const { data: payment, error: fetchError } = await supabase
    .from("order_payments")
    .select("order_id")
    .eq("id", paymentId)
    .single()

  if (fetchError || !payment) {
    return { success: false, error: fetchError?.message || "Payment record not found" }
  }

  const { error } = await supabase
    .from("order_payments")
    .delete()
    .eq("id", paymentId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/dashboard/orders/${payment.order_id}`)
  return { success: true }
}

// Delete production record
export async function deleteProductionRecord(recordId: string) {
  const supabase = await createClient()

  // Get order_id and file info before deleting
  const { data: productionRecord } = await supabase
    .from("production_records")
    .select("order_id, pdf_file_url")
    .eq("id", recordId)
    .single()

  // Delete PDF from storage if exists
  if (productionRecord?.pdf_file_url) {
    // Extract file path from URL
    const urlParts = productionRecord.pdf_file_url.split("/production-pdfs/")
    if (urlParts.length > 1) {
      const filePath = `production-pdfs/${urlParts[1]}`
      await supabase.storage
        .from("production-pdfs")
        .remove([filePath])
    }
  }

  // Delete production record (cascade will handle production_pdfs)
  const { error } = await supabase
    .from("production_records")
    .delete()
    .eq("id", recordId)

  if (error) {
    return { success: false, error: error.message }
  }

  if (productionRecord) {
    revalidatePath(`/dashboard/orders/${productionRecord.order_id}`)
  }

  return { success: true }
}

// Combined initial load for order detail page (one round-trip)
export async function getOrderDetailPageData(orderId: string) {
  const [
    orderRes,
    inventoryRes,
    dispatchesRes,
    courierRes,
    productionListsRes,
    productionRecordsRes,
    invoiceRes,
    paymentsRes,
    followupsRes,
  ] = await Promise.all([
    getOrderDetails(orderId),
    getInventoryItemsForOrder(),
    getOrderDispatches(orderId),
    getCourierCompanies(),
    getOrderProductionLists(orderId),
    getOrderProductionRecords(orderId),
    getInvoiceAttachments(orderId),
    getOrderPayments(orderId),
    getOrderPaymentFollowups(orderId),
  ])

  if (!orderRes.success || !orderRes.data) {
    return { success: false as const, error: orderRes.error ?? "Failed to load order", data: null }
  }

  return {
    success: true as const,
    data: {
      order: orderRes.data,
      inventoryItems: inventoryRes.success ? (inventoryRes.data ?? []) : [],
      dispatches: dispatchesRes.success ? (dispatchesRes.data ?? []) : [],
      courierCompanies: courierRes.success ? (courierRes.data ?? []) : [],
      productionLists: productionListsRes.success ? (productionListsRes.data ?? []) : [],
      productionRecords: productionRecordsRes.success ? (productionRecordsRes.data ?? []) : [],
      invoiceAttachments: invoiceRes.success ? (invoiceRes.data ?? []) : [],
      orderPayments: paymentsRes.success ? (paymentsRes.data ?? []) : [],
      paymentFollowups: followupsRes.success ? (followupsRes.data ?? []) : [],
    },
    error: null,
  }
}
