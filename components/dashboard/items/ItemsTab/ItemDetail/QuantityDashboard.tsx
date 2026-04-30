"use client"

import type { QuantityMetrics } from "../utils/itemCalculations"
import { cn } from "@/lib/utils"

export function QuantityDashboard({ metrics }: { metrics: QuantityMetrics }) {
  const total = Math.max(1, metrics.qty_total)
  const bars = [
    { key: "available", value: metrics.qty_available, cls: "bg-emerald-500" },
    { key: "reserved", value: metrics.qty_reserved, cls: "bg-amber-500" },
    { key: "dispatched", value: metrics.qty_dispatched, cls: "bg-blue-500" },
    { key: "damaged", value: metrics.qty_damaged, cls: "bg-rose-500" },
  ]

  return (
    <section className="rounded-xl border border-sk-border bg-white p-4">
      <h3 className="text-sm font-semibold text-sk-text-1">Quantity Dashboard</h3>
      <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
        <div className="rounded-lg bg-sk-page-bg p-3"><p className="text-[11px] text-sk-text-3">Total Stock</p><p className="text-lg font-bold">{metrics.qty_total}</p></div>
        <div className="rounded-lg bg-sk-page-bg p-3"><p className="text-[11px] text-sk-text-3">Available</p><p className={cn("text-lg font-bold", metrics.qty_available === 0 && "text-red-600")}>{metrics.qty_available}</p></div>
        <div className="rounded-lg bg-sk-page-bg p-3"><p className="text-[11px] text-sk-text-3">Reserved</p><p className="text-lg font-bold">{metrics.qty_reserved}</p></div>
        <div className="rounded-lg bg-sk-page-bg p-3"><p className="text-[11px] text-sk-text-3">Dispatched</p><p className="text-lg font-bold">{metrics.qty_dispatched}</p></div>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-gray-100">
        {bars.map((bar) => (
          <div key={bar.key} className={bar.cls} style={{ width: `${(bar.value / total) * 100}%` }} />
        ))}
      </div>
    </section>
  )
}
