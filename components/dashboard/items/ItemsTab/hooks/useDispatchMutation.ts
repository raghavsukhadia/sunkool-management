"use client"

import { useState } from "react"
import { markItemOrderDispatched } from "@/app/actions/items"

export function useDispatchMutation(onSuccess: () => Promise<void>, onRollback: () => void) {
  const [loadingOrderItemId, setLoadingOrderItemId] = useState<string | null>(null)

  async function dispatchItem(input: {
    orderId: string
    orderItemId: string
    itemId: string
    qtyDispatched: number
  }) {
    setLoadingOrderItemId(input.orderItemId)
    const res = await markItemOrderDispatched({
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      itemId: input.itemId,
      qtyDispatched: input.qtyDispatched,
    })
    if (!res.success) {
      onRollback()
      setLoadingOrderItemId(null)
      return { success: false, error: res.error ?? "Dispatch failed" }
    }
    await onSuccess()
    setLoadingOrderItemId(null)
    return { success: true as const }
  }

  return { dispatchItem, loadingOrderItemId }
}
