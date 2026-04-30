"use client"

import { useMemo } from "react"
import type { ItemSummary } from "@/app/actions/items"
import {
  computeQuantityMetrics,
  getNetDispatched,
  getReservedQuantity,
  getStockState,
  getOrderSummaryStatus,
  getPaymentBucket,
  type OrderSummaryStatus,
} from "../utils/itemCalculations"

export function useItemQuantity(item: ItemSummary | null) {
  return useMemo(() => {
    if (!item) return null

    const qtyDispatched = getNetDispatched(item.orders)
    const qtyReserved = getReservedQuantity(item.orders)
    const metrics = computeQuantityMetrics({
      qtyTotal: item.total_quantity,
      qtyReserved,
      qtyDispatched,
      qtyDamaged: 0,
    })

    const orderSummary = {
      all: item.orders.length,
      pending: 0,
      confirmed: 0,
      dispatched: 0,
      delivered: 0,
      cancelled: 0,
    } as Record<OrderSummaryStatus, number>

    const paymentBreakdown = {
      paid: 0,
      partial: 0,
      unpaid: 0,
      refunded: 0,
    }

    for (const order of item.orders) {
      const key = getOrderSummaryStatus(order)
      orderSummary[key] += 1
      paymentBreakdown[getPaymentBucket(order.payment_status)] += 1
    }

    return {
      metrics,
      stockState: getStockState(metrics),
      orderSummary,
      paymentBreakdown,
    }
  }, [item])
}
