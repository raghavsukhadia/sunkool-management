// Shared types and constants for the Order Timeline System.
// NOT a server action file — safe to import from client components.

// ─── Core Types ──────────────────────────────────────────────────────────────

export type TimelineEventType =
  // Order lifecycle
  | "order_created"
  | "order_updated"
  | "order_cancelled"
  | "order_status_changed"
  // Items
  | "item_added"
  | "item_removed"
  // Payment
  | "payment_received"
  | "payment_status_changed"
  | "invoice_created"
  | "invoice_updated"
  // Production
  | "production_record_created"
  | "production_in_progress"
  | "production_completed"
  // Dispatch & Shipment
  | "dispatch_created"
  | "return_dispatch_created"
  | "shipment_status_changed"
  | "shipment_note_added"
  // Misc
  | "admin_note"

export type TimelineActor = "system" | "admin" | "courier" | "user"

export interface TimelineEntry {
  id:          string
  order_id:    string
  event_type:  TimelineEventType
  title:       string
  description: string | null
  timestamp:   string                    // ISO 8601
  actor:       TimelineActor
  actor_name:  string | null             // resolved from profiles join
  metadata:    Record<string, unknown>
}

// ─── Filtering ───────────────────────────────────────────────────────────────

export type TimelineCategory = "all" | "order" | "payment" | "shipment" | "production"

export const TIMELINE_CATEGORY_LABELS: Record<TimelineCategory, string> = {
  all:        "All Events",
  order:      "Order",
  payment:    "Payment",
  shipment:   "Shipment",
  production: "Production",
}

/** Which filter-category does each event type belong to? */
export const EVENT_CATEGORY: Record<TimelineEventType, TimelineCategory> = {
  order_created:             "order",
  order_updated:             "order",
  order_cancelled:           "order",
  order_status_changed:      "order",
  item_added:                "order",
  item_removed:              "order",
  payment_received:          "payment",
  payment_status_changed:    "payment",
  invoice_created:           "payment",
  invoice_updated:           "payment",
  production_record_created: "production",
  production_in_progress:    "production",
  production_completed:      "production",
  dispatch_created:          "shipment",
  return_dispatch_created:   "shipment",
  shipment_status_changed:   "shipment",
  shipment_note_added:       "shipment",
  admin_note:                "order",
}

// ─── Display Metadata ────────────────────────────────────────────────────────

export type EventSeverity = "success" | "info" | "warning" | "error" | "neutral"

/** Visual severity used to choose dot color & icon tint in the timeline UI. */
export const EVENT_SEVERITY: Record<TimelineEventType, EventSeverity> = {
  order_created:             "success",
  order_updated:             "info",
  order_cancelled:           "error",
  order_status_changed:      "info",
  item_added:                "info",
  item_removed:              "neutral",
  payment_received:          "success",
  payment_status_changed:    "warning",
  invoice_created:           "info",
  invoice_updated:           "neutral",
  production_record_created: "info",
  production_in_progress:    "info",
  production_completed:      "success",
  dispatch_created:          "info",
  return_dispatch_created:   "warning",
  shipment_status_changed:   "info",   // overridden at render time based on status value
  shipment_note_added:       "neutral",
  admin_note:                "neutral",
}

/** Readable label for each event type used in fallback / tooltips. */
export const EVENT_TYPE_LABELS: Record<TimelineEventType, string> = {
  order_created:             "Order Created",
  order_updated:             "Order Updated",
  order_cancelled:           "Order Cancelled",
  order_status_changed:      "Status Changed",
  item_added:                "Item Added",
  item_removed:              "Item Removed",
  payment_received:          "Payment Received",
  payment_status_changed:    "Payment Status Changed",
  invoice_created:           "Invoice Created",
  invoice_updated:           "Invoice Updated",
  production_record_created: "Production Record Created",
  production_in_progress:    "Production In Progress",
  production_completed:      "Production Completed",
  dispatch_created:          "Dispatch Created",
  return_dispatch_created:   "Return Dispatch Created",
  shipment_status_changed:   "Shipment Status Updated",
  shipment_note_added:       "Note Added",
  admin_note:                "Admin Note",
}
