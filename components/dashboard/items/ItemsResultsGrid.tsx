"use client"

import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, SearchX } from "lucide-react"
import type { ItemsListRow, ItemsListSortKey } from "@/app/actions/items"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  formatCurrency,
  formatDate,
  formatRelativeDate,
  getDispatchTag,
  getMatchReasonLabel,
} from "./items-utils"

const COLUMNS: Array<{ key: ItemsListSortKey; label: string }> = [
  { key: "item_name", label: "Item" },
  { key: "total_orders", label: "Orders" },
  { key: "total_quantity", label: "Qty" },
  { key: "total_value", label: "Value" },
  { key: "total_remaining", label: "Remaining" },
  { key: "last_ordered_at", label: "Last Ordered" },
]

function SortIcon({
  active,
  direction,
}: {
  active: boolean
  direction: "asc" | "desc"
}) {
  if (!active) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
  return direction === "asc" ? <ArrowUp className="h-3.5 w-3.5 text-sk-primary" /> : <ArrowDown className="h-3.5 w-3.5 text-sk-primary" />
}

export function ItemsResultsGrid({
  rows,
  sortKey,
  sortDir,
  isLoading,
  onSort,
  onView,
}: {
  rows: ItemsListRow[]
  sortKey: ItemsListSortKey
  sortDir: "asc" | "desc"
  isLoading: boolean
  onSort: (key: ItemsListSortKey) => void
  onView: (itemKey: string) => void
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-sk-border bg-white px-4 py-20 text-center">
        <SearchX className="mb-3 h-9 w-9 text-sk-text-3" />
        <p className="text-sm font-medium text-sk-text-1">No items match this view</p>
        <p className="mt-1 text-xs text-sk-text-3">Try clearing filters or using a different search query.</p>
      </div>
    )
  }

  return (
    <>
      <div className="hidden lg:block">
        <div className="overflow-hidden rounded-2xl border border-sk-border bg-white shadow-sm">
          <Table className="min-w-[1080px]">
            <TableHeader className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur">
              <TableRow className="hover:bg-transparent">
                {COLUMNS.map((column) => (
                  <TableHead key={column.key} className="h-12 px-5 text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-sk-text-1"
                    >
                      {column.label}
                      <SortIcon active={sortKey === column.key} direction={sortDir} />
                    </button>
                  </TableHead>
                ))}
                <TableHead className="h-12 px-5 text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">Customers</TableHead>
                <TableHead className="h-12 px-5 text-right text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((row) => {
                const dispatchTag = getDispatchTag(row.total_dispatched, row.total_remaining)
                const matchReasons = row.match_reasons.map(getMatchReasonLabel)
                return (
                  <TableRow key={row.item_key} className={cn("group", isLoading && "opacity-70")}>
                    <TableCell className="px-5 py-3.5">
                      <p className="max-w-[280px] truncate text-sm font-semibold text-sk-text-1">{row.item_name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-sk-text-3">
                        {row.item_sku ? <span>SKU: {row.item_sku}</span> : null}
                        {row.item_category ? <span className="rounded bg-gray-100 px-1.5 py-0.5">{row.item_category}</span> : null}
                      </div>
                      {matchReasons.length > 0 ? (
                        <p className="mt-1 text-xs text-sk-primary">
                          Matched on {matchReasons.join(", ")}
                        </p>
                      ) : null}
                    </TableCell>

                    <TableCell className="px-5 py-3.5 text-sm font-semibold text-sk-primary">{row.total_orders}</TableCell>
                    <TableCell className="px-5 py-3.5 text-sm font-semibold text-sk-text-1">
                      {row.total_dispatched}/{row.total_quantity}
                    </TableCell>
                    <TableCell className="px-5 py-3.5 text-sm font-semibold text-sk-text-1">{formatCurrency(row.total_value)}</TableCell>
                    <TableCell className="px-5 py-3.5">
                      <span className={cn("inline-flex rounded-md border px-2 py-1 text-xs font-semibold", dispatchTag.className)}>
                        {dispatchTag.label}
                      </span>
                    </TableCell>
                    <TableCell className="px-5 py-3.5">
                      <p className="text-sm text-sk-text-2">{formatRelativeDate(row.last_ordered_at)}</p>
                      <p className="text-xs text-sk-text-3">{formatDate(row.last_ordered_at)}</p>
                    </TableCell>
                    <TableCell className="px-5 py-3.5">
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        {row.customers.slice(0, 2).map((name) => (
                          <span key={name} className="rounded-full border border-sk-border bg-gray-50 px-2 py-0.5 text-[11px] text-sk-text-2">
                            {name}
                          </span>
                        ))}
                        {row.customers.length > 2 ? (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-sk-text-3">+{row.customers.length - 2}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-3.5 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 border-sk-primary/30 text-xs font-semibold text-sk-primary hover:bg-sk-primary/10"
                        onClick={() => onView(row.item_key)}
                      >
                        View details
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {rows.map((row) => {
          const dispatchTag = getDispatchTag(row.total_dispatched, row.total_remaining)
          return (
            <article key={row.item_key} className={cn("rounded-xl border border-sk-border bg-white p-4 shadow-sm", isLoading && "opacity-70")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-sk-text-1">{row.item_name}</h3>
                  <p className="mt-1 text-xs text-sk-text-3">
                    {[row.item_sku ? `SKU ${row.item_sku}` : null, row.item_category].filter(Boolean).join(" · ") || "No SKU / category"}
                  </p>
                </div>
                <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", dispatchTag.className)}>{dispatchTag.label}</span>
              </div>

              {row.match_reasons.length > 0 ? (
                <p className="mt-2 text-xs text-sk-primary">
                  Matched on {row.match_reasons.map(getMatchReasonLabel).join(", ")}
                </p>
              ) : null}

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-sk-page-bg p-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-sk-text-3">Orders</p>
                  <p className="text-sm font-bold text-sk-primary">{row.total_orders}</p>
                </div>
                <div className="rounded-lg bg-sk-page-bg p-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-sk-text-3">Qty</p>
                  <p className="text-sm font-bold text-sk-text-1">{row.total_dispatched}/{row.total_quantity}</p>
                </div>
                <div className="rounded-lg bg-sk-page-bg p-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-sk-text-3">Value</p>
                  <p className="text-sm font-bold text-sk-text-1">{formatCurrency(row.total_value)}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-sk-text-3">Last ordered {formatRelativeDate(row.last_ordered_at)}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 border-sk-primary/30 text-xs font-semibold text-sk-primary hover:bg-sk-primary/10"
                  onClick={() => onView(row.item_key)}
                >
                  View
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
