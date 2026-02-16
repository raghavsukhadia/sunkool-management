"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

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
      order_status: "Pending",
      payment_status: "Pending",
      total_price: 0, // Will be updated when items are added
      created_by: profile.id,
    })
    .select()
    .single()

  if (orderError) {
    return { success: false, error: orderError.message }
  }

  // If cash discount is enabled, create initial payment followup entries
  if (formData.cash_discount && order) {
    // Create followup entries for 14 days
    const followupDates = []
    const today = new Date()
    for (let i = 1; i <= 14; i++) {
      const followupDate = new Date(today)
      followupDate.setDate(today.getDate() + i)
      followupDates.push({
        order_id: order.id,
        followup_date: followupDate.toISOString().split('T')[0],
        payment_received: false,
      })
    }

    if (followupDates.length > 0) {
      const { error: followupError } = await supabase
        .from("payment_followups")
        .insert(followupDates)

      if (followupError) {
        // Log error but don't fail the order creation
        console.error("Failed to create payment followups:", followupError)
      }
    }
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

  // Get item counts for each order
  if (orders && orders.length > 0) {
    const orderIds = orders.map(o => o.id)
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("order_id")
      .in("order_id", orderIds)

    // Count items per order
    const itemCounts: Record<string, number> = {}
    orderItems?.forEach(item => {
      itemCounts[item.order_id] = (itemCounts[item.order_id] || 0) + 1
    })

    // Add item counts to orders
    const ordersWithCounts = orders.map(order => ({
      ...order,
      item_count: itemCounts[order.id] || 0
    }))

    return { success: true, data: ordersWithCounts, error: null }
  }

  return { success: true, data: orders || [], error: null }
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

  // Update order status workflow: If order is Pending and has items, move to Approved
  const { data: order } = await supabase
    .from("orders")
    .select("order_status")
    .eq("id", orderId)
    .single()

  if (order && order.order_status === "Pending") {
    // Check if order has items now
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("id")
      .eq("order_id", orderId)

    if (orderItems && orderItems.length > 0) {
      // Update status to Approved (ready for production)
      await supabase
        .from("orders")
        .update({ order_status: "Approved" })
        .eq("id", orderId)
    }
  }

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

  // Check if item has been dispatched - CRITICAL FIX
  const { data: dispatchItems, error: checkError } = await supabase
    .from("dispatch_items")
    .select("id")
    .eq("order_item_id", orderItemId)
    .limit(1)

  if (checkError) {
    return { success: false, error: `Failed to check dispatch status: ${checkError.message}` }
  }

  if (dispatchItems && dispatchItems.length > 0) {
    // Get dispatch quantity details
    const { data: detailedDispatch } = await supabase
      .from("dispatch_items")
      .select("quantity, dispatches!inner(dispatch_date, dispatch_type)")
      .eq("order_item_id", orderItemId)

    const totalDispatched = detailedDispatch?.reduce((sum, item) => sum + item.quantity, 0) || 0

    return {
      success: false,
      error: `Cannot delete this item - ${totalDispatched} units have already been dispatched. To remove this item, first create a return dispatch for the dispatched units, then try deleting again.`,
      canCreateReturn: true,
      dispatchedQuantity: totalDispatched
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

  // Update order status
  let newOrderStatus = order.order_status
  if (dispatchType === "full") {
    newOrderStatus = "Dispatched"
  } else {
    // Check if all items are fully dispatched
    const totalOrderQuantity = orderItems?.reduce((sum, item) => sum + item.quantity, 0) || 0
    const totalDispatchedQuantity = dispatchItems.reduce((sum, item) => sum + item.quantity, 0)

    // Get all previous dispatches for this order
    const { data: previousDispatches } = await supabase
      .from("dispatches")
      .select("id")
      .eq("order_id", orderId)
      .neq("id", dispatch.id)

    if (previousDispatches && previousDispatches.length > 0) {
      const { data: previousDispatchItems } = await supabase
        .from("dispatch_items")
        .select("quantity")
        .in("dispatch_id", previousDispatches.map(d => d.id))

      const previousTotal = previousDispatchItems?.reduce((sum, item) => sum + item.quantity, 0) || 0
      const newTotal = previousTotal + totalDispatchedQuantity

      if (newTotal >= totalOrderQuantity) {
        newOrderStatus = "Dispatched"
      } else {
        newOrderStatus = "Partial Dispatch"
      }
    } else {
      if (totalDispatchedQuantity >= totalOrderQuantity) {
        newOrderStatus = "Dispatched"
      } else {
        newOrderStatus = "Partial Dispatch"
      }
    }
  }

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
    const { data: dispatchedItems } = await supabase
      .from("dispatch_items")
      .select("quantity")
      .eq("order_item_id", returnItem.order_item_id)

    const totalDispatched = dispatchedItems?.reduce((sum, item) => sum + item.quantity, 0) || 0

    if (totalDispatched < returnItem.quantity) {
      return {
        success: false,
        error: `Cannot return ${returnItem.quantity} units. Only ${totalDispatched} units were dispatched.`
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

  // If status is 'delivered', update order status to 'Delivered'
  if (status === 'delivered') {
    const { data: dispatchData } = await supabase
      .from("dispatches")
      .select("order_id, dispatch_type")
      .eq("id", dispatchId)
      .single()

    if (dispatchData) {
      // Check if all dispatches for this order are delivered
      const { data: allDispatches } = await supabase
        .from("dispatches")
        .select("shipment_status")
        .eq("order_id", dispatchData.order_id)

      const allDelivered = allDispatches?.every(d => d.shipment_status === 'delivered') || false

      if (allDelivered) {
        await supabase
          .from("orders")
          .update({ order_status: "Delivered" })
          .eq("id", dispatchData.order_id)
      }
    }
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
  remainingPaymentAmount?: number
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
    const dispatchedStates = ['Partial Dispatch', 'Dispatched', 'Delivered']
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
  if (paymentDate !== undefined) {
    updateData.payment_date = paymentDate || null
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

    // Define valid state transitions
    const validTransitions: Record<string, string[]> = {
      'Pending': ['Approved', 'Cancelled'],
      'Approved': ['In Production', 'Pending', 'Cancelled'],
      'In Production': ['Partial Dispatch', 'Dispatched', 'Approved', 'Cancelled'],
      'Partial Dispatch': ['In Production', 'Dispatched', 'Cancelled'],
      'Dispatched': ['Delivered', 'Partial Dispatch', 'Cancelled'],
      'Delivered': ['Cancelled'],
      'Cancelled': []
    }

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      return {
        success: false,
        error: `Invalid status transition: Cannot change from "${currentStatus}" to "${newStatus}". Valid next statuses: ${validTransitions[currentStatus]?.join(', ') || 'None'}`
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

  const dispatchedStates = ['Partial Dispatch', 'Dispatched', 'Delivered']
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

