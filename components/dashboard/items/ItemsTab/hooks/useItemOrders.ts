"use client"

import { useCallback, useEffect, useState } from "react"
import { getItemByKey, type ItemSummary } from "@/app/actions/items"

export function useItemOrders(itemKey: string | null) {
  const [item, setItem] = useState<ItemSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!itemKey) {
      setItem(null)
      return
    }
    setLoading(true)
    setError(null)
    const res = await getItemByKey(itemKey)
    if (!res.success || !res.data) {
      setItem(null)
      setError(res.error ?? "Failed to load item")
    } else {
      setItem(res.data)
    }
    setLoading(false)
  }, [itemKey])

  useEffect(() => {
    void reload()
  }, [reload])

  return { item, setItem, loading, error, reload }
}
