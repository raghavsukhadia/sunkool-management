"use client"

import { useMemo } from "react"
import type { ItemSummary } from "@/app/actions/items"
import { getOrderSummaryStatus, computeQuantityMetrics, getNetDispatched, getReservedQuantity, getStockState } from "../utils/itemCalculations"
import { ItemFilters, type OrderFilter, type SortBy, type StockFilter } from "./ItemFilters"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function getPendingOrders(item: ItemSummary) {
  return item.orders.filter((order) => {
    const state = getOrderSummaryStatus(order)
    return state === "pending" || state === "confirmed"
  }).length
}

function getRowState(item: ItemSummary) {
  const metrics = computeQuantityMetrics({
    qtyTotal: item.total_quantity,
    qtyReserved: getReservedQuantity(item.orders),
    qtyDispatched: getNetDispatched(item.orders),
    qtyDamaged: 0,
  })
  return {
    pendingOrders: getPendingOrders(item),
    stock: getStockState(metrics),
  }
}

export function ItemList({
  items,
  selectedItemKey,
  search,
  stockFilter,
  orderFilter,
  sortBy,
  onSearchChange,
  onStockFilterChange,
  onOrderFilterChange,
  onSortByChange,
  onSelect,
}: {
  items: ItemSummary[]
  selectedItemKey: string | null
  search: string
  stockFilter: StockFilter
  orderFilter: OrderFilter
  sortBy: SortBy
  onSearchChange: (value: string) => void
  onStockFilterChange: (value: StockFilter) => void
  onOrderFilterChange: (value: OrderFilter) => void
  onSortByChange: (value: SortBy) => void
  onSelect: (itemKey: string) => void
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = [...items]
    if (q) {
      list = list.filter((item) => item.item_name.toLowerCase().includes(q) || (item.item_sku ?? "").toLowerCase().includes(q))
    }

    list = list.filter((item) => {
      const { pendingOrders, stock } = getRowState(item)

      if (stockFilter !== "all" && stock !== stockFilter) return false
      if (orderFilter === "has_pending_orders" && pendingOrders === 0) return false
      if (orderFilter === "fully_dispatched" && item.total_remaining > 0) return false
      return true
    })

    list.sort((a, b) => {
      if (sortBy === "name") return a.item_name.localeCompare(b.item_name)
      if (sortBy === "pending_orders") {
        const pa = getPendingOrders(a)
        const pb = getPendingOrders(b)
        return pb - pa
      }
      const sa = computeQuantityMetrics({
        qtyTotal: a.total_quantity,
        qtyReserved: getReservedQuantity(a.orders),
        qtyDispatched: getNetDispatched(a.orders),
        qtyDamaged: 0,
      }).qty_available
      const sb = computeQuantityMetrics({
        qtyTotal: b.total_quantity,
        qtyReserved: getReservedQuantity(b.orders),
        qtyDispatched: getNetDispatched(b.orders),
        qtyDamaged: 0,
      }).qty_available
      return sa - sb
    })

    return list
  }, [items, orderFilter, search, sortBy, stockFilter])

  function resetFilters() {
    onSearchChange("")
    onStockFilterChange("all")
    onOrderFilterChange("all")
    onSortByChange("name")
  }

  return (
    <aside className="rounded-2xl border border-sk-border bg-white p-3">
      <ItemFilters
        search={search}
        stockFilter={stockFilter}
        orderFilter={orderFilter}
        sortBy={sortBy}
        onSearchChange={onSearchChange}
        onStockFilterChange={onStockFilterChange}
        onOrderFilterChange={onOrderFilterChange}
        onSortByChange={onSortByChange}
      />
      <div className="mt-3 overflow-hidden rounded-xl border border-sk-border">
        <div className="grid grid-cols-[minmax(180px,2fr)_minmax(90px,1fr)_70px_70px_90px_100px] gap-2 border-b border-sk-border bg-sk-bg-1 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">
          <span>Item</span>
          <span>SKU</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Pending</span>
          <span className="text-right">Dispatch</span>
          <span className="text-right">Value</span>
        </div>
        <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
          {filtered.map((item) => {
            const row = getRowState(item)
            return (
              <button
                key={item.item_key}
                type="button"
                onClick={() => onSelect(item.item_key)}
                className={cn(
                  "grid w-full grid-cols-[minmax(180px,2fr)_minmax(90px,1fr)_70px_70px_90px_100px] gap-2 border-b border-sk-border px-3 py-2 text-left text-xs transition-colors hover:bg-sk-bg-1/60",
                  selectedItemKey === item.item_key ? "bg-sk-primary/5" : "bg-white"
                )}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-sk-text-1">{item.item_name}</p>
                  <p className="truncate text-[11px] text-sk-text-3">{item.item_category ?? "Uncategorized"}</p>
                </div>
                <span className="truncate text-sk-text-2">{item.item_sku ?? "—"}</span>
                <span className="text-right font-medium text-sk-text-1">{item.total_quantity}</span>
                <span className="text-right text-sk-text-2">{row.pendingOrders}</span>
                <span className="text-right text-sk-text-2">{item.total_dispatched}/{item.total_quantity}</span>
                <span className="text-right font-medium text-sk-text-1">Rs {Math.round(item.total_value)}</span>
              </button>
            )
          })}
          {filtered.length === 0 ? (
            <div className="space-y-2 px-4 py-8 text-center">
              {items.length === 0 ? (
                <>
                  <p className="text-sm font-medium text-sk-text-1">No item data available yet</p>
                  <p className="text-xs text-sk-text-3">Items appear here once orders are created with product or inventory links.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-sk-text-1">No items match current filters</p>
                  <p className="text-xs text-sk-text-3">Try resetting search and filters to view all items.</p>
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={resetFilters}>
                    Reset filters
                  </Button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
