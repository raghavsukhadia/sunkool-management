"use client"

import { Package, ShoppingCart, Clock3, TrendingUp } from "lucide-react"
import type { ItemsStats } from "@/app/actions/items"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { formatCurrency } from "./items-utils"

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
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatCard
        label="Unique Items"
        value={String(stats.unique_items)}
        sub={`${stats.total_orders} total line items`}
        icon={Package}
        accent="bg-sk-primary/10 text-sk-primary"
      />
      <StatCard
        label="Total Quantity"
        value={String(stats.total_quantity)}
        sub="Units across filtered results"
        icon={ShoppingCart}
        accent="bg-violet-50 text-violet-600"
      />
      <StatCard
        label="Pending Dispatch"
        value={String(stats.pending_items)}
        sub={`${stats.fully_dispatched_items} fully dispatched`}
        icon={Clock3}
        accent="bg-amber-50 text-amber-600"
      />
      <StatCard
        label="Total Value"
        value={formatCurrency(stats.total_value)}
        sub="Across filtered results"
        icon={TrendingUp}
        accent="bg-emerald-50 text-emerald-600"
      />
    </div>
  )
}
