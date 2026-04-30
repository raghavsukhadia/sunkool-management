"use client"

import { memo } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ItemSummary } from "@/app/actions/items"
import type { StockState } from "../utils/itemCalculations"

function stockPill(stock: StockState) {
  if (stock === "in_stock") return { label: "In stock", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" }
  if (stock === "low_stock") return { label: "Low stock", cls: "bg-amber-50 text-amber-700 border-amber-200" }
  return { label: "Out of stock", cls: "bg-red-50 text-red-700 border-red-200" }
}

export const ItemCard = memo(function ItemCard({
  item,
  pendingOrders,
  stock,
  selected,
  onClick,
}: {
  item: ItemSummary
  pendingOrders: number
  stock: StockState
  selected: boolean
  onClick: () => void
}) {
  const pill = stockPill(stock)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border bg-white p-3 text-left transition-colors hover:border-sk-primary/40",
        selected ? "border-sk-primary ring-1 ring-sk-primary/20" : "border-sk-border"
      )}
    >
      <p className="truncate text-sm font-semibold text-sk-text-1">{item.item_name}</p>
      {item.item_sku ? <p className="mt-0.5 text-xs text-sk-text-3">SKU: {item.item_sku}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {item.item_category ? <Badge variant="outline" className="text-[10px]">{item.item_category}</Badge> : null}
        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", pill.cls)}>{pill.label}</span>
      </div>
      <p className="mt-2 text-xs text-sk-text-3">{pendingOrders} pending orders</p>
    </button>
  )
})
