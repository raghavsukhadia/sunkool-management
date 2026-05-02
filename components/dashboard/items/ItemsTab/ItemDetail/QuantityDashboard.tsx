"use client"

import type { OrderQuantityDashboard, QuantityDashboardFilterKey } from "../utils/itemCalculations"
import { cn } from "@/lib/utils"

const TILES: Array<{
  key: QuantityDashboardFilterKey
  label: string
  hint: string
  emphasize?: "amber" | "emerald" | "rose" | "slate"
}> = [
  { key: "totalOrdered", label: "Total ordered", hint: "All line qty to date", emphasize: "slate" },
  { key: "notDelivered", label: "Not delivered", hint: "Open / in‑transit orders", emphasize: "amber" },
  { key: "delivered", label: "Delivered", hint: "Marked delivered", emphasize: "emerald" },
  { key: "cancelled", label: "Cancelled / void", hint: "Voided lines", emphasize: "rose" },
]

const emphasis: Record<NonNullable<(typeof TILES)[number]["emphasize"]>, string> = {
  slate: "ring-slate-200/80",
  amber: "ring-amber-200/80",
  emerald: "ring-emerald-200/80",
  rose: "ring-rose-200/80",
}

const activeTile: Record<NonNullable<(typeof TILES)[number]["emphasize"]>, string> = {
  slate: "ring-2 ring-slate-400 ring-offset-2 ring-offset-white",
  amber: "ring-2 ring-amber-400 ring-offset-2 ring-offset-white",
  emerald: "ring-2 ring-emerald-500 ring-offset-2 ring-offset-white",
  rose: "ring-2 ring-rose-400 ring-offset-2 ring-offset-white",
}

export function QuantityDashboard({
  dashboard,
  activeFilter,
  onFilterChange,
}: {
  dashboard: OrderQuantityDashboard
  activeFilter: QuantityDashboardFilterKey
  onFilterChange: (key: QuantityDashboardFilterKey) => void
}) {
  const total = Math.max(1, dashboard.totalOrdered)
  const bars: Array<{ key: Exclude<QuantityDashboardFilterKey, "totalOrdered">; value: number; cls: string }> = [
    { key: "notDelivered", value: dashboard.notDelivered, cls: "bg-amber-500" },
    { key: "delivered", value: dashboard.delivered, cls: "bg-emerald-500" },
    { key: "cancelled", value: dashboard.cancelled, cls: "bg-rose-500" },
  ]

  return (
    <section className="rounded-xl border border-sk-border bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-sk-text-1 xl:text-lg">Quantity Dashboard</h3>
      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {TILES.map((tile) => {
          const value = dashboard[tile.key]
          const ring = tile.emphasize ? emphasis[tile.emphasize] : ""
          const isActive = activeFilter === tile.key
          const activeRing = tile.emphasize && isActive ? activeTile[tile.emphasize] : ""
          return (
            <button
              key={tile.key}
              type="button"
              onClick={() => onFilterChange(tile.key)}
              className={cn(
                "rounded-lg bg-sk-page-bg p-4 text-left ring-1 ring-inset transition-shadow hover:brightness-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-sk-primary focus-visible:ring-offset-2",
                ring,
                isActive ? cn("bg-white shadow-sm", activeRing) : ""
              )}
              aria-pressed={isActive}
            >
              <p className="text-xs font-medium text-sk-text-3">{tile.label}</p>
              <p className="mt-1 text-[11px] leading-snug text-slate-500">{tile.hint}</p>
              <p
                className={cn(
                  "mt-2 text-2xl font-bold tabular-nums xl:text-3xl",
                  value > 0 ? "text-sk-text-1" : "text-sk-text-3"
                )}
              >
                {value}
              </p>
            </button>
          )
        })}
      </div>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-gray-100 ring-1 ring-inset ring-slate-200/60">
        {bars.map((bar) => {
          const n = bar.value
          if (n <= 0) return null
          const pct = (n / total) * 100
          const isActive = activeFilter === bar.key
          return (
            <button
              key={bar.key}
              type="button"
              title={`Filter: ${bar.key}`}
              onClick={() => onFilterChange(bar.key)}
              className={cn(
                "h-full shrink-0 border-0 p-0 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-sk-primary focus-visible:ring-offset-2",
                bar.cls,
                isActive ? "ring-2 ring-inset ring-white/90" : ""
              )}
              style={{ width: `${pct}%`, minWidth: pct > 0 && pct < 5 ? 6 : undefined }}
              aria-pressed={isActive}
            />
          )
        })}
      </div>
    </section>
  )
}
