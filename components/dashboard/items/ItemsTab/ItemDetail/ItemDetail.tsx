"use client"

import { useEffect, useMemo, useState } from "react"
import { ItemHeader } from "./ItemHeader"
import { QuantityDashboard } from "./QuantityDashboard"
import { OrdersTable } from "./OrdersTable"
import { useItemQuantity } from "../hooks/useItemQuantity"
import { orderMatchesQuantityDashboardFilter, type QuantityDashboardFilterKey } from "../utils/itemCalculations"
import type { ItemSummary } from "@/app/actions/items"

export function ItemDetail({
  item,
  setItem: _setItem,
  reload: _reload,
}: {
  item: ItemSummary | null
  setItem: (value: ItemSummary | null | ((prev: ItemSummary | null) => ItemSummary | null)) => void
  reload: () => Promise<void>
}) {
  const quantity = useItemQuantity(item)
  const [qtyFilter, setQtyFilter] = useState<QuantityDashboardFilterKey>("totalOrdered")

  useEffect(() => {
    setQtyFilter("totalOrdered")
  }, [item?.item_key])

  const visibleOrders = useMemo(() => {
    if (!item) return []
    return item.orders.filter((o) => orderMatchesQuantityDashboardFilter(o, qtyFilter))
  }, [item, qtyFilter])

  if (!item || !quantity) {
    return <div className="rounded-xl border border-dashed border-sk-border bg-white p-8 text-center text-sm text-sk-text-3">Select an item to view details</div>
  }

  return (
    <div className="space-y-4">
      <ItemHeader item={item} />
      <QuantityDashboard
        dashboard={quantity.orderQtyDashboard}
        activeFilter={qtyFilter}
        onFilterChange={setQtyFilter}
      />
      <OrdersTable orders={visibleOrders} />
    </div>
  )
}
