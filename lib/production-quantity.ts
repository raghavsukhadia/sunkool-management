/**
 * Shared production math for order lines — keep in sync with `getProductionQueue` in
 * `app/actions/production.ts` and order UI.
 */

export function normalizeProductionStatus(status: string | null | undefined): string {
  return (status ?? "").trim().toLowerCase().replace(/[_\s]+/g, " ")
}

/** Counts toward produced/remaining on a line (in progress or completed). */
export function recordCountsTowardTotals(status: string | null | undefined): boolean {
  const n = normalizeProductionStatus(status)
  return n === "in production" || n === "in progress" || n === "completed"
}

export type ProductionRecordForQty = {
  production_type?: string | null
  selected_quantities?: Record<string, number> | null
  status?: string | null
}

/**
 * Produced qty for one order line across records (partial selected_quantities; full batch
 * adds full line qty when no per-line qty for that record).
 */
export function producedQtyForLineItem(
  records: ProductionRecordForQty[],
  itemId: string,
  lineQuantity: number
): number {
  return records.reduce((sum, rec) => {
    if (!recordCountsTowardTotals(rec.status)) return sum
    if (rec.selected_quantities && rec.selected_quantities[itemId] != null) {
      return sum + (Number(rec.selected_quantities[itemId]) || 0)
    }
    if ((rec.production_type || "full").toLowerCase() === "full") {
      return sum + lineQuantity
    }
    return sum
  }, 0)
}

/** Produced qty counting only completed batches (excludes in-progress allocation). */
export function producedQtyForLineItemCompletedOnly(
  records: ProductionRecordForQty[],
  itemId: string,
  lineQuantity: number
): number {
  return records.reduce((sum, rec) => {
    if (normalizeProductionStatus(rec.status) !== "completed") return sum
    if (rec.selected_quantities && rec.selected_quantities[itemId] != null) {
      return sum + (Number(rec.selected_quantities[itemId]) || 0)
    }
    if ((rec.production_type || "full").toLowerCase() === "full") {
      return sum + lineQuantity
    }
    return sum
  }, 0)
}
