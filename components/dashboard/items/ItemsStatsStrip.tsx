"use client"

import { Package, BarChart3, Truck, Layers } from "lucide-react"
import type { ItemsStats } from "@/app/actions/items"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  accent: string
}) {
  return (
    <Card className="border border-sk-border bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">{label}</p>
            <p className="mt-1 text-2xl font-bold text-sk-text-1">{value}</p>
            {sub ? <p className="text-xs text-sk-text-3">{sub}</p> : null}
          </div>
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", accent)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ItemsStatsStrip({ stats }: { stats: ItemsStats }) {
  const fulfillmentRate =
    stats.total_quantity > 0 ? Math.round((stats.total_dispatched / stats.total_quantity) * 100) : 0
  const fulfillmentAccent =
    fulfillmentRate >= 80
      ? "bg-emerald-50 text-emerald-600"
      : fulfillmentRate >= 50
        ? "bg-amber-50 text-amber-600"
        : "bg-rose-50 text-rose-600"

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatCard
        label="Active Products"
        value={String(stats.unique_items)}
        sub={`${stats.total_orders} order lines`}
        icon={Package}
        accent="bg-sk-primary/10 text-sk-primary"
      />
      <StatCard
        label="Total Ordered"
        value={String(stats.total_quantity)}
        sub={`Units across ${stats.unique_items} products`}
        icon={Layers}
        accent="bg-violet-50 text-violet-600"
      />
      <StatCard
        label="Fulfillment Rate"
        value={stats.total_quantity > 0 ? `${fulfillmentRate}%` : "—"}
        sub={`${stats.total_dispatched} of ${stats.total_quantity} units shipped`}
        icon={BarChart3}
        accent={fulfillmentAccent}
      />
      <StatCard
        label="Units to Dispatch"
        value={String(stats.total_remaining)}
        sub={`${stats.pending_items} items with open demand`}
        icon={Truck}
        accent="bg-amber-50 text-amber-600"
      />
    </div>
  )
}
