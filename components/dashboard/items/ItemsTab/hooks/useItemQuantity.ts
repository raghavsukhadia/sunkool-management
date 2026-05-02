"use client"

import { useMemo } from "react"
import type { ItemSummary } from "@/app/actions/items"
import { getOrderQuantityDashboard } from "../utils/itemCalculations"

export function useItemQuantity(item: ItemSummary | null) {
  return useMemo(() => {
    if (!item) return null

    const orderQtyDashboard = getOrderQuantityDashboard(item.orders)

    return {
      orderQtyDashboard,
    }
  }, [item])
}
