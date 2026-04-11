// Shared types and constants for shipment tracking.
// NOT a server action file — safe to import from client components.

export type ShipmentStatus =
  | "pending"
  | "ready"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "failed_delivery"
  | "rto_initiated"
  | "returned"
  | "cancelled"

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  pending:          "Pending",
  ready:            "Ready for Pickup",
  picked_up:        "Picked Up",
  in_transit:       "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered:        "Delivered",
  failed_delivery:  "Failed Delivery",
  rto_initiated:    "RTO Initiated",
  returned:         "Returned",
  cancelled:        "Cancelled",
}

export type ShipmentRow = {
  dispatch_id:          string
  order_id:             string
  order_number:         string
  sales_order_number:   string | null
  customer_name:        string
  customer_phone:       string | null
  courier_name:         string
  courier_id:           string | null
  tracking_id:          string | null
  tracking_url:         string | null
  shipment_status:      string
  dispatch_date:        string | null
  dispatch_type:        string
  estimated_delivery:   string | null
  current_location:     string | null
  is_delayed:           boolean
  is_stuck:             boolean
  item_details:         string   // comma-separated "Name x Qty" list
}

export type ShipmentSummary = {
  total_active:  number
  in_transit:    number
  delivery_due:  number   // overdue or stuck (ETA past + not delivered)
  delivered:     number
}

export type ShipmentNote = {
  id:         string
  note:       string
  created_at: string
  created_by: string | null
}

export type ShipmentFilters = {
  courier_id?: string
  status?:     string
  date_from?:  string
  date_to?:    string
  search?:     string
}
