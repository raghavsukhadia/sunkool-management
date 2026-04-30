"use client"

import { useEffect, useMemo } from "react"
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
  const summaryValue = useMemo(
    () => initialData.rows.reduce((sum, row) => sum + row.total_value, 0),
    [initialData.rows]
  )

  useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7283/ingest/8aee2203-9b99-4ec2-b9d6-3286a96aa65d", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "ae1a3c" },
      body: JSON.stringify({
        sessionId: "ae1a3c",
        runId: "initial",
        hypothesisId: "H6",
        location: "components/dashboard/items/ItemsPageClient.tsx:useEffect",
        message: "Client page rendered",
        data: {
          totalRows: initialData.total_rows,
          allItemsCount: allItems.length,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
  }, [allItems.length, initialData.total_rows])

  return (
    <section className="space-y-6">
      <ItemsStatsStrip stats={initialData.stats} />
      <div className="rounded-2xl border border-sk-border bg-white p-3 text-xs text-sk-text-3">
        {initialData.total_rows > 0
          ? `${initialData.total_rows} items loaded · Rs ${Math.round(summaryValue)}`
          : "No items loaded yet. New orders with linked products or inventory items will appear here."}
      </div>
      <ItemsTab items={allItems} />
    </section>
  )
}
