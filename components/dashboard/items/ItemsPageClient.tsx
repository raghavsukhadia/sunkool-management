"use client"

import {
  type ItemsListQuery,
  type ItemsListResult,
  type ItemSummary,
} from "@/app/actions/items"
import { ItemsTab } from "./ItemsTab"
import { ItemsStatsStrip } from "./ItemsStatsStrip"

export function ItemsPageClient({
  initialQuery: _initialQuery,
  initialData,
  allItems,
}: {
  initialQuery: ItemsListQuery
  initialData: ItemsListResult
  allItems: ItemSummary[]
}) {
  return (
    <section className="space-y-6">
      <ItemsStatsStrip stats={initialData.stats} />
      <ItemsTab items={allItems} />
    </section>
  )
}
