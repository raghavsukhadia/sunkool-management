"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AdvancedFilters } from "@/components/customers/types"

interface Props {
  value: AdvancedFilters
  onChange: (next: AdvancedFilters) => void
  onReset: () => void
}

export function AdvancedFiltersPanel({ value, onChange, onReset }: Props) {
  const patch = (partial: Partial<AdvancedFilters>) => onChange({ ...value, ...partial })

  return (
    <div className="rounded-xl border border-sk-border bg-sk-card-bg p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-sk-text-1">Advanced Filters</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          Reset
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs text-sk-text-3">Last order from</label>
          <Input
            type="date"
            value={value.lastOrderFrom}
            onChange={e => patch({ lastOrderFrom: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-sk-text-3">Last order to</label>
          <Input
            type="date"
            value={value.lastOrderTo}
            onChange={e => patch({ lastOrderTo: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-sk-text-3">Unpaid status</label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={value.unpaidMode}
            onChange={e => patch({ unpaidMode: e.target.value as AdvancedFilters["unpaidMode"] })}
          >
            <option value="all">All</option>
            <option value="has">Has unpaid</option>
            <option value="none">No unpaid</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-sk-text-3">Minimum orders</label>
          <Input
            type="number"
            min={0}
            placeholder="e.g. 5"
            value={value.minOrders}
            onChange={e => patch({ minOrders: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-sk-text-3">Min value (₹)</label>
          <Input
            type="number"
            min={0}
            placeholder="e.g. 100000"
            value={value.minValue}
            onChange={e => patch({ minValue: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-sk-text-3">Max value (₹)</label>
          <Input
            type="number"
            min={0}
            placeholder="e.g. 500000"
            value={value.maxValue}
            onChange={e => patch({ maxValue: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-sk-text-3">Phone prefix</label>
          <Input
            placeholder="e.g. 98"
            value={value.phonePrefix}
            onChange={e => patch({ phonePrefix: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-sk-text-3">Has email</label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={value.hasEmail}
            onChange={e => patch({ hasEmail: e.target.value as AdvancedFilters["hasEmail"] })}
          >
            <option value="all">All</option>
            <option value="yes">Has email</option>
            <option value="no">No email</option>
          </select>
        </div>
      </div>
    </div>
  )
}
