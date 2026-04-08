"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type {
  ShipmentStatus,
  ShipmentRow,
  ShipmentSummary,
  ShipmentNote,
  ShipmentFilters,
} from "@/app/actions/tracking-types"
import { SHIPMENT_STATUS_LABELS } from "@/app/actions/tracking-types"
import { syncOrderStatusFromTracking } from "@/app/actions/orders"

// Statuses that mean the shipment is still active (not terminal)
const ACTIVE_STATUSES: ShipmentStatus[] = [
  "pending", "ready", "picked_up", "in_transit", "out_for_delivery",
]

// Statuses that require attention
const ATTENTION_STATUSES: ShipmentStatus[] = [
  "failed_delivery", "rto_initiated",
]

// ── Helpers ────────────────────────────────────────────────────────────────

function buildTrackingUrl(template: string | null, trackingId: string | null): string | null {
  if (!template || !trackingId) return null
  const tid = encodeURIComponent(trackingId.trim())
  return template
    .replaceAll("{tracking_number}", tid)
    .replaceAll("{tracking_id}", tid)
    .replaceAll("%s", tid)
}

function computeFlags(row: { shipment_status: string; dispatch_date: string | null; estimated_delivery: string | null }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const isTerminal = ["delivered", "returned", "cancelled"].includes(row.shipment_status)

  const isDelayed =
    !isTerminal &&
    row.estimated_delivery != null &&
    new Date(row.estimated_delivery) < today

  // Stuck: active shipment dispatched more than 7 days ago with no ETA set
  const isStuck =
    !isTerminal &&
    row.estimated_delivery == null &&
    ACTIVE_STATUSES.includes(row.shipment_status as ShipmentStatus) &&
    row.dispatch_date != null &&
    (today.getTime() - new Date(row.dispatch_date).getTime()) > 7 * 24 * 60 * 60 * 1000

  return { is_delayed: isDelayed, is_stuck: isStuck }
}

// ── Actions ────────────────────────────────────────────────────────────────

export async function getShipmentsDashboard(filters: ShipmentFilters = {}): Promise<{
  success: boolean
  data: ShipmentRow[] | null
  error: string | null
}> {
  const supabase = await createClient()

  let query = supabase
    .from("dispatches")
    .select(`
      id,
      order_id,
      dispatch_type,
      dispatch_date,
      shipment_status,
      tracking_id,
      estimated_delivery,
      current_location,
      courier_company_id,
      orders (
        internal_order_number,
        sales_order_number,
        customers:customer_id ( name, phone )
      ),
      courier_companies (
        id,
        name,
        tracking_url
      )
    `)
    .neq("dispatch_type", "return")
    .order("dispatch_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200)

  // Apply filters
  if (filters.courier_id) {
    query = query.eq("courier_company_id", filters.courier_id)
  }
  if (filters.status) {
    query = query.eq("shipment_status", filters.status)
  }
  if (filters.date_from) {
    query = query.gte("dispatch_date", filters.date_from)
  }
  if (filters.date_to) {
    query = query.lte("dispatch_date", filters.date_to)
  }

  const { data, error } = await query

  if (error) {
    return { success: false, data: null, error: error.message }
  }

  let rows: ShipmentRow[] = (data || []).map((row: any) => {
    const order   = Array.isArray(row.orders)           ? row.orders[0]           : row.orders
    const cust    = Array.isArray(order?.customers)     ? order.customers[0]      : order?.customers
    const courier = Array.isArray(row.courier_companies)? row.courier_companies[0]: row.courier_companies

    const trackingId = row.tracking_id ? String(row.tracking_id).trim() : null

    const flags = computeFlags({
      shipment_status:   row.shipment_status,
      dispatch_date:     row.dispatch_date,
      estimated_delivery: row.estimated_delivery,
    })

    return {
      dispatch_id:          row.id,
      order_id:             row.order_id,
      order_number:         order?.internal_order_number || order?.sales_order_number || row.order_id.slice(0, 8),
      sales_order_number:   order?.sales_order_number ?? null,
      customer_name:        cust?.name   ?? "—",
      customer_phone:       cust?.phone  ?? null,
      courier_name:         courier?.name ?? "—",
      courier_id:           courier?.id   ?? null,
      tracking_id:          trackingId,
      tracking_url:         buildTrackingUrl(courier?.tracking_url ?? null, trackingId),
      shipment_status:      row.shipment_status ?? "pending",
      dispatch_date:        row.dispatch_date   ?? null,
      dispatch_type:        row.dispatch_type,
      estimated_delivery:   row.estimated_delivery ?? null,
      current_location:     row.current_location  ?? null,
      ...flags,
    }
  })

  // Client-side search (order number, tracking ID, phone)
  if (filters.search) {
    const q = filters.search.toLowerCase()
    rows = rows.filter(
      (r) =>
        r.order_number.toLowerCase().includes(q) ||
        (r.tracking_id && r.tracking_id.toLowerCase().includes(q)) ||
        (r.customer_phone && r.customer_phone.includes(q)) ||
        r.customer_name.toLowerCase().includes(q),
    )
  }

  return { success: true, data: rows, error: null }
}

export async function getShipmentSummary(): Promise<{
  success: boolean
  data: ShipmentSummary | null
  error: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("dispatches")
    .select("shipment_status, estimated_delivery, dispatch_date")
    .neq("dispatch_type", "return")

  if (error) {
    return { success: false, data: null, error: error.message }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let total_active  = 0
  let in_transit    = 0
  let delivered     = 0
  let delivery_due  = 0

  for (const row of data || []) {
    const s = row.shipment_status as ShipmentStatus

    if (s === "delivered") delivered++
    if (["picked_up", "in_transit", "out_for_delivery"].includes(s)) in_transit++
    if (ACTIVE_STATUSES.includes(s)) total_active++

    const flags = computeFlags({
      shipment_status:    s,
      dispatch_date:      row.dispatch_date,
      estimated_delivery: row.estimated_delivery,
    })
    if (flags.is_delayed || flags.is_stuck) delivery_due++
  }

  return {
    success: true,
    data: { total_active, in_transit, delivery_due, delivered },
    error: null,
  }
}

export async function getShipmentNotes(dispatchId: string): Promise<{
  success: boolean
  data: ShipmentNote[] | null
  error: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("shipment_notes")
    .select("id, note, created_at, profiles:created_by ( full_name )")
    .eq("dispatch_id", dispatchId)
    .order("created_at", { ascending: false })

  if (error) {
    return { success: false, data: null, error: error.message }
  }

  const notes: ShipmentNote[] = (data || []).map((n: any) => {
    const profile = Array.isArray(n.profiles) ? n.profiles[0] : n.profiles
    return {
      id:         n.id,
      note:       n.note,
      created_at: n.created_at,
      created_by: profile?.full_name ?? null,
    }
  })

  return { success: true, data: notes, error: null }
}

export async function addShipmentNote(dispatchId: string, note: string): Promise<{
  success: boolean
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Unauthorized" }

  const trimmed = note.trim()
  if (!trimmed) return { success: false, error: "Note cannot be empty." }
  if (trimmed.length > 1000) return { success: false, error: "Note too long (max 1000 chars)." }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single()

  const { error } = await supabase
    .from("shipment_notes")
    .insert({
      dispatch_id: dispatchId,
      note:        trimmed,
      created_by:  profile?.id ?? null,
    })

  if (error) return { success: false, error: error.message }

  revalidatePath("/dashboard/tracking")
  return { success: true, error: null }
}

export async function updateShipmentTracking(
  dispatchId: string,
  fields: {
    shipment_status: ShipmentStatus
  }
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Unauthorized" }

  const { data: dispatch, error } = await supabase
    .from("dispatches")
    .update({ shipment_status: fields.shipment_status })
    .eq("id", dispatchId)
    .select("order_id")
    .single()

  if (error) return { success: false, error: error.message }

  // Sync order_status to reflect the new shipment status
  if (dispatch?.order_id) {
    await syncOrderStatusFromTracking(dispatch.order_id)
  }

  revalidatePath("/dashboard/tracking")
  return { success: true, error: null }
}
