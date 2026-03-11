"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Products Actions
export async function createProduct(formData: {
  name: string
  sku: string
  price: number
  description?: string
  category?: string
  parent_product_id?: string
  display_order?: number
}) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("products")
    .insert({
      name: formData.name,
      sku: formData.sku,
      price: formData.price,
      description: formData.description || null,
      category: formData.category || null,
      parent_product_id: formData.parent_product_id || null,
      display_order: formData.display_order || 0,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/dashboard/management/products")
  return { success: true, data }
}

export async function updateProduct(
  id: string,
  formData: {
    name: string
    sku: string
    price: number
    description?: string
    category?: string
    parent_product_id?: string
    display_order?: number
    is_active?: boolean
  }
) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("products")
    .update({
      name: formData.name,
      sku: formData.sku,
      price: formData.price,
      description: formData.description || null,
      category: formData.category || null,
      parent_product_id: formData.parent_product_id || null,
      display_order: formData.display_order || 0,
      is_active: formData.is_active ?? true,
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/dashboard/management/products")
  return { success: true, data }
}

// Courier Companies Actions
export async function createCourierCompany(formData: {
  name: string
  contact_person?: string
  email?: string
  phone?: string
  address?: string
  tracking_url?: string
  notes?: string
}) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("courier_companies")
    .insert({
      name: formData.name,
      contact_person: formData.contact_person || null,
      email: formData.email || null,
      phone: formData.phone || null,
      address: formData.address || null,
      tracking_url: formData.tracking_url || null,
      notes: formData.notes || null,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/dashboard/management/courier")
  return { success: true, data }
}

export async function updateCourierCompany(
  id: string,
  formData: {
    name: string
    contact_person?: string
    email?: string
    phone?: string
    address?: string
    tracking_url?: string
    notes?: string
    is_active?: boolean
  }
) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("courier_companies")
    .update({
      name: formData.name,
      contact_person: formData.contact_person || null,
      email: formData.email || null,
      phone: formData.phone || null,
      address: formData.address || null,
      tracking_url: formData.tracking_url || null,
      notes: formData.notes || null,
      is_active: formData.is_active ?? true,
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/dashboard/management/courier")
  return { success: true, data }
}

// Customers Actions
export async function createCustomer(formData: {
  name: string
  email?: string
  phone?: string
  address?: string
  contact_person?: string
  notes?: string
}) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("customers")
    .insert({
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone || null,
      address: formData.address || null,
      contact_person: formData.contact_person || null,
      notes: formData.notes || null,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/dashboard/management/customers")
  return { success: true, data }
}

export async function updateCustomer(
  id: string,
  formData: {
    name: string
    email?: string
    phone?: string
    address?: string
    contact_person?: string
    notes?: string
    is_active?: boolean
  }
) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("customers")
    .update({
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone || null,
      address: formData.address || null,
      contact_person: formData.contact_person || null,
      notes: formData.notes || null,
      is_active: formData.is_active ?? true,
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/dashboard/management/customers")
  return { success: true, data }
}

// Get all products
export async function getProducts(category?: string) {
  const supabase = await createClient()
  
  let query = supabase
    .from("products")
    .select("*")
    .eq("is_active", true)

  if (category) {
    query = query.eq("category", category)
  }

  const { data, error } = await query
    .order("category", { ascending: true, nullsFirst: true })
    .order("display_order", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    return { success: false, error: error.message, data: null }
  }

  return { success: true, data, error: null }
}

// Get product categories
export async function getProductCategories() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("products")
    .select("category")
    .eq("is_active", true)
    .not("category", "is", null)

  if (error) {
    return { success: false, error: error.message, data: null }
  }

  const categories = Array.from(new Set(data.map(p => p.category).filter(Boolean))).sort()
  return { success: true, data: categories, error: null }
}

// Get all courier companies
export async function getCourierCompanies() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("courier_companies")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (error) {
    return { success: false, error: error.message, data: null }
  }

  return { success: true, data, error: null }
}

// Get all customers
export async function getCustomers() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (error) {
    return { success: false, error: error.message, data: null }
  }

  return { success: true, data, error: null }
}

// Delete courier company
export async function deleteCourierCompany(id: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("courier_companies")
    .update({ is_active: false })
    .eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/dashboard/management/courier")
  return { success: true }
}

// Delete customer
export async function deleteCustomer(id: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("customers")
    .update({ is_active: false })
    .eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/dashboard/management/customers")
  return { success: true }
}

// Delete product
export async function deleteProduct(id: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("products")
    .update({ is_active: false })
    .eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/dashboard/management/products")
  return { success: true }
}

// ============================================
// Inventory Management Actions
// ============================================

export async function getInventoryItems() {
  const supabase = await createClient()
  
  // Get all parent items (items without parent)
  const { data: items, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("is_active", true)
    .is("parent_item_id", null)
    .order("sr_no", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (error) {
    return { success: false, error: error.message, data: null }
  }

  // Get sub-items for each parent item (sub-items don't have serial numbers)
  if (items && items.length > 0) {
    const itemIds = items.map(item => item.id)
    const { data: subItems } = await supabase
      .from("inventory_items")
      .select("id, item_name, date, created_at, parent_item_id")
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

export async function updateInventoryItem(
  id: string,
  formData: {
    item_name?: string
    date?: string
  }
) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("inventory_items")
    .update({
      item_name: formData.item_name,
      date: formData.date ? new Date(formData.date).toISOString().split('T')[0] : undefined,
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/dashboard/management/products")
  return { success: true, data }
}

export async function createInventoryItem(formData: {
  sr_no?: number
  item_name: string
  date?: string
  parent_item_id?: string
  master_rolls?: Array<{ dimension: string; quantity: number }>
  convertable_stock?: {
    front?: number
    five_str?: number
    seven_str?: number
    balance?: number
  }
  ready_for_dispatch?: Array<{
    sr_no?: number
    item: string
    in_hand?: number
    rack_location?: string
  }>
  cut_and_roll?: {
    in_hand?: number
    date?: string
  }
}) {
  const supabase = await createClient()
  
  try {
    // Auto-generate serial number only for parent items (not sub-items)
    let srNo: number | null = formData.sr_no || null
    
    // Only assign serial number if it's a parent item (no parent_item_id)
    if (!formData.parent_item_id) {
      if (!srNo) {
        // Get max serial number only from active parent items (no sub-items)
        const { data: maxItem } = await supabase
          .from("inventory_items")
          .select("sr_no")
          .eq("is_active", true)
          .is("parent_item_id", null)
          .not("sr_no", "is", null)
          .order("sr_no", { ascending: false })
          .limit(1)
          .maybeSingle()
        
        srNo = maxItem?.sr_no ? maxItem.sr_no + 1 : 1
      }
    } else {
      // Sub-items don't get serial numbers - explicitly set to null
      srNo = null
    }

    // Create inventory item
    const { data: item, error: itemError } = await supabase
      .from("inventory_items")
      .insert({
        sr_no: srNo,
        item_name: formData.item_name,
        date: formData.date ? new Date(formData.date).toISOString().split('T')[0] : null,
        parent_item_id: formData.parent_item_id || null,
      })
      .select()
      .single()

    if (itemError) {
      return { success: false, error: itemError.message }
    }

    // Create master rolls if provided
    if (formData.master_rolls && formData.master_rolls.length > 0) {
      const masterRollsData = formData.master_rolls.map(mr => ({
        inventory_item_id: item.id,
        dimension: mr.dimension,
        quantity: mr.quantity || 0,
      }))
      
      const { error: mrError } = await supabase
        .from("master_rolls")
        .insert(masterRollsData)

      if (mrError) {
        return { success: false, error: `Master rolls error: ${mrError.message}` }
      }
    }

    // Create convertable stock if provided
    if (formData.convertable_stock) {
      const { error: csError } = await supabase
        .from("convertable_stock")
        .insert({
          inventory_item_id: item.id,
          front: formData.convertable_stock.front || 0,
          five_str: formData.convertable_stock.five_str || 0,
          seven_str: formData.convertable_stock.seven_str || 0,
          balance: formData.convertable_stock.balance || 0,
        })

      if (csError) {
        return { success: false, error: `Convertable stock error: ${csError.message}` }
      }
    }

    // Create ready for dispatch if provided
    if (formData.ready_for_dispatch && formData.ready_for_dispatch.length > 0) {
      const rfdData = formData.ready_for_dispatch.map(rfd => ({
        inventory_item_id: item.id,
        sr_no: rfd.sr_no || null,
        item: rfd.item,
        in_hand: rfd.in_hand || 0,
        rack_location: rfd.rack_location || null,
      }))
      
      const { error: rfdError } = await supabase
        .from("ready_for_dispatch")
        .insert(rfdData)

      if (rfdError) {
        return { success: false, error: `Ready for dispatch error: ${rfdError.message}` }
      }
    }

    // Create cut and roll if provided
    if (formData.cut_and_roll) {
      const { error: carError } = await supabase
        .from("cut_and_roll")
        .insert({
          inventory_item_id: item.id,
          in_hand: formData.cut_and_roll.in_hand || 0,
          date: formData.cut_and_roll.date ? new Date(formData.cut_and_roll.date).toISOString().split('T')[0] : null,
        })

      if (carError) {
        return { success: false, error: `Cut and roll error: ${carError.message}` }
      }
    }

    revalidatePath("/dashboard/management/products")
    return { success: true, data: item }
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create inventory item" }
  }
}

export async function deleteInventoryItem(id: string) {
  const supabase = await createClient()
  
  // Get the item to check if it's a parent item with serial number
  const { data: item } = await supabase
    .from("inventory_items")
    .select("sr_no, parent_item_id")
    .eq("id", id)
    .single()

  if (!item) {
    return { success: false, error: "Item not found" }
  }

  // Hard delete: Delete sub-items first (cascade), then the parent item
  // First, delete all sub-items if this is a parent item
  if (!item.parent_item_id) {
    const { error: subItemsError } = await supabase
      .from("inventory_items")
      .delete()
      .eq("parent_item_id", id)

    if (subItemsError) {
      return { success: false, error: `Failed to delete sub-items: ${subItemsError.message}` }
    }
  }

  // Delete the item itself (hard delete)
  const { error } = await supabase
    .from("inventory_items")
    .delete()
    .eq("id", id)

  if (error) {
    return { success: false, error: error.message }
  }

  // If it was a parent item with a serial number, renumber remaining parent items
  if (!item.parent_item_id && item.sr_no) {
    // Get all active parent items (excluding sub-items) ordered by sr_no
    const { data: remainingItems } = await supabase
      .from("inventory_items")
      .select("id, sr_no")
      .eq("is_active", true)
      .is("parent_item_id", null)
      .not("sr_no", "is", null)
      .order("sr_no", { ascending: true })

    if (remainingItems && remainingItems.length > 0) {
      // Renumber sequentially starting from 1
      for (let i = 0; i < remainingItems.length; i++) {
        const newSrNo = i + 1
        if (remainingItems[i].sr_no !== newSrNo) {
          await supabase
            .from("inventory_items")
            .update({ sr_no: newSrNo })
            .eq("id", remainingItems[i].id)
        }
      }
    }
  }

  revalidatePath("/dashboard/management/products")
  return { success: true }
}

// Excel Import Action
export async function importInventoryFromExcel(base64Data: string) {
  const supabase = await createClient()
  
  try {
    // Convert base64 string back to ArrayBuffer using Buffer (Node.js)
    const buffer = Buffer.from(base64Data, 'base64')
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    
    // Dynamic import for xlsx (server-side only)
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0] // Get first sheet
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][]

    if (!data || data.length < 2) {
      return { success: false, error: "Excel file is empty or invalid" }
    }

    const errors: string[] = []
    const successCount = { count: 0 }

    // Process each row (skip header row)
    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      if (!row || row.length === 0) continue

      try {
        // Parse row data based on Excel structure
        // Assuming structure: Date, Sr No, Item Name, Master Rolls..., Convertable Stock..., Ready for Dispatch..., Cut & Roll...
        const date = row[0] ? String(row[0]) : null
        const srNo = row[1] ? Number(row[1]) : null
        const itemName = row[2] ? String(row[2]).trim() : null

        if (!itemName) continue

        // Create inventory item
        const result = await createInventoryItem({
          sr_no: srNo || undefined,
          item_name: itemName,
          date: date || undefined,
        })

        if (result.success) {
          successCount.count++
        } else {
          errors.push(`Row ${i + 1}: ${result.error}`)
        }
      } catch (err: any) {
        errors.push(`Row ${i + 1}: ${err.message}`)
      }
    }

    revalidatePath("/dashboard/management/products")
    
    return {
      success: true,
      imported: successCount.count,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to import Excel file" }
  }
}

