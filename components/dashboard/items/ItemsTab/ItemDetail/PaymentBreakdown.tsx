"use client"

export function PaymentBreakdown({
  breakdown,
}: {
  breakdown: { paid: number; partial: number; unpaid: number; refunded: number }
}) {
  const total = Math.max(1, breakdown.paid + breakdown.partial + breakdown.unpaid + breakdown.refunded)
  const parts = [
    { key: "paid", label: "Paid in Full", value: breakdown.paid, cls: "bg-emerald-500" },
    { key: "partial", label: "Partially Paid", value: breakdown.partial, cls: "bg-amber-500" },
    { key: "unpaid", label: "Unpaid", value: breakdown.unpaid, cls: "bg-gray-400" },
    { key: "refunded", label: "Refunded", value: breakdown.refunded, cls: "bg-rose-500" },
  ]

  return (
    <section className="rounded-xl border border-sk-border bg-white p-4">
      <h3 className="text-sm font-semibold text-sk-text-1">Payment Status Breakdown</h3>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-gray-100">
        {parts.map((part) => (
          <div key={part.key} className={part.cls} style={{ width: `${(part.value / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-sk-text-2">
        {parts.map((part) => (
          <span key={part.key}>{part.label}: {part.value}</span>
        ))}
      </div>
    </section>
  )
}
