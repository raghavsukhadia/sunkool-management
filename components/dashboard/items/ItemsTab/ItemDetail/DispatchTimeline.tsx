"use client"

import type { TimelineEntry } from "@/app/actions/timeline-types"

export function DispatchTimeline({
  orderNumber,
  entries,
  loading,
}: {
  orderNumber: string | null
  entries: TimelineEntry[]
  loading: boolean
}) {
  return (
    <section className="rounded-xl border border-sk-border bg-white p-4">
      <h3 className="text-sm font-semibold text-sk-text-1">Dispatch & Shipping Timeline</h3>
      <p className="mt-1 text-xs text-sk-text-3">{orderNumber ? `Selected order: ${orderNumber}` : "Select an order row to view timeline"}</p>
      <div className="mt-3 space-y-2">
        {loading ? <p className="text-xs text-sk-text-3">Loading timeline...</p> : null}
        {!loading && entries.length === 0 ? <p className="text-xs text-sk-text-3">No timeline events yet.</p> : null}
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-lg border border-sk-border p-2">
            <p className="text-xs font-semibold text-sk-text-1">{entry.title}</p>
            <p className="text-[11px] text-sk-text-3">{new Date(entry.timestamp).toLocaleString("en-IN")}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
