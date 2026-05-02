import type { ItemOrderEntry } from "@/app/actions/items"
import type { TimelineEntry, TimelineEventType } from "@/app/actions/timeline-types"

const LINE_SCOPED_TYPES = new Set<TimelineEventType>(["item_added", "item_removed"])

function strMeta(m: Record<string, unknown>, key: string): string | null {
  const v = m[key]
  return typeof v === "string" && v.length > 0 ? v : null
}

/**
 * When showing an order timeline next to a single order line (item detail),
 * hide other lines' "Item Added" / "Item Removed" events. Order-wide events
 * (created, payment, production, dispatch, etc.) stay visible.
 */
export function filterTimelineForOrderLine(entries: TimelineEntry[], line: ItemOrderEntry): TimelineEntry[] {
  return entries.filter((e) => {
    if (!LINE_SCOPED_TYPES.has(e.event_type)) return true

    const m = e.metadata ?? {}
    const metaOrderItemId = strMeta(m, "order_item_id")
    if (metaOrderItemId && metaOrderItemId === line.order_item_id) return true

    if (e.event_type === "item_added") {
      if (line.product_id) {
        const pid = strMeta(m, "product_id")
        if (pid && pid === line.product_id) return true
      }
      if (line.inventory_item_id) {
        const iid = strMeta(m, "inventory_item_id")
        if (iid && iid === line.inventory_item_id) return true
      }
      return false
    }

    // item_removed — legacy rows often have no metadata; keep only when we can tie to this line
    if (metaOrderItemId) return metaOrderItemId === line.order_item_id
    return false
  })
}
