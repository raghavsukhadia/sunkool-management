"use client"

import { cn } from "@/lib/utils"
import type { OrderSummaryStatus } from "../utils/itemCalculations"

const KEYS: Array<{ key: OrderSummaryStatus; label: string }> = [
  { key: "all", label: "Total Orders" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "dispatched", label: "Dispatched" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled / Returned" },
]

export function OrderSummaryChips({
  summary,
  selected,
  onSelect,
}: {
  summary: Record<OrderSummaryStatus, number>
  selected: OrderSummaryStatus
  onSelect: (key: OrderSummaryStatus) => void
}) {
  return (
    <section className="rounded-xl border border-sk-border bg-white p-4">
      <h3 className="text-sm font-semibold text-sk-text-1">Order Summary</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {KEYS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              selected === item.key ? "border-sk-primary bg-sk-primary/10 text-sk-primary" : "border-sk-border text-sk-text-2"
            )}
          >
            {item.label}: {summary[item.key]}
          </button>
        ))}
      </div>
    </section>
  )
}
