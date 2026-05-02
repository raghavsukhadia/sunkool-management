"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ItemSummary } from "@/app/actions/items"
import { ItemList } from "./ItemList/ItemList"
import { ItemDetail } from "./ItemDetail/ItemDetail"
import { useItemOrders } from "./hooks/useItemOrders"
import { cn } from "@/lib/utils"

export function ItemsTab({ items }: { items: ItemSummary[] }) {
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(items[0]?.item_key ?? null)
  const [itemsListExpanded, setItemsListExpanded] = useState(true)
  const prevSelectedKey = useRef<string | null>(null)
  const { item, setItem, loading, error, reload } = useItemOrders(selectedItemKey)

  const baseItems = useMemo(() => items, [items])

  const selectedItemName = useMemo(() => {
    const found = baseItems.find((i) => i.item_key === selectedItemKey)
    return found?.item_name ?? null
  }, [baseItems, selectedItemKey])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!window.matchMedia("(min-width: 1280px)").matches) return
    if (prevSelectedKey.current !== null && prevSelectedKey.current !== selectedItemKey && selectedItemKey !== null) {
      setItemsListExpanded(false)
    }
    prevSelectedKey.current = selectedItemKey
  }, [selectedItemKey])

  return (
    <section
      className={cn(
        "grid items-start grid-cols-1 gap-4 xl:gap-5",
        itemsListExpanded
          ? "xl:grid-cols-[minmax(0,36%)_minmax(0,1fr)]"
          : "xl:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]"
      )}
    >
      <ItemList
        items={baseItems}
        selectedItemKey={selectedItemKey}
        selectedItemName={selectedItemName}
        expanded={itemsListExpanded}
        onExpandedChange={setItemsListExpanded}
        onSelect={setSelectedItemKey}
      />
      <div className="min-w-0 space-y-4">
        {loading ? <div className="rounded-xl border border-sk-border bg-white p-8 text-sm text-sk-text-3">Loading item details...</div> : null}
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-sm text-red-700">{error}</div> : null}
        {!loading && !error ? <ItemDetail item={item} setItem={setItem} reload={reload} /> : null}
      </div>
    </section>
  )
}
