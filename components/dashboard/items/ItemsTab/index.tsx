"use client"

import { useMemo, useState } from "react"
import type { ItemSummary } from "@/app/actions/items"
import { ItemList } from "./ItemList/ItemList"
import { ItemDetail } from "./ItemDetail/ItemDetail"
import { useItemOrders } from "./hooks/useItemOrders"
import type { OrderFilter, SortBy, StockFilter } from "./ItemList/ItemFilters"

export function ItemsTab({ items }: { items: ItemSummary[] }) {
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(items[0]?.item_key ?? null)
  const [search, setSearch] = useState("")
  const [stockFilter, setStockFilter] = useState<StockFilter>("all")
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all")
  const [sortBy, setSortBy] = useState<SortBy>("name")
  const { item, setItem, loading, error, reload } = useItemOrders(selectedItemKey)

  const baseItems = useMemo(() => items, [items])

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-[58%_42%]">
      <ItemList
        items={baseItems}
        selectedItemKey={selectedItemKey}
        search={search}
        stockFilter={stockFilter}
        orderFilter={orderFilter}
        sortBy={sortBy}
        onSearchChange={setSearch}
        onStockFilterChange={setStockFilter}
        onOrderFilterChange={setOrderFilter}
        onSortByChange={setSortBy}
        onSelect={setSelectedItemKey}
      />
      <div className="space-y-3">
        {loading ? <div className="rounded-xl border border-sk-border bg-white p-8 text-sm text-sk-text-3">Loading item details...</div> : null}
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-sm text-red-700">{error}</div> : null}
        {!loading && !error ? <ItemDetail item={item} setItem={setItem} reload={reload} /> : null}
      </div>
    </section>
  )
}
