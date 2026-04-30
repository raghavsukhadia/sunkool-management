import test from "node:test"
import assert from "node:assert/strict"
import { computeQuantityMetrics, applyDispatchOptimisticUpdate } from "./itemCalculations"
import type { ItemOrderEntry } from "@/app/actions/items"

test("computeQuantityMetrics uses derived available formula", () => {
  const metrics = computeQuantityMetrics({
    qtyTotal: 100,
    qtyReserved: 20,
    qtyDispatched: 50,
    qtyDamaged: 5,
  })
  assert.equal(metrics.qty_available, 25)
})

test("computeQuantityMetrics clamps available to zero", () => {
  const metrics = computeQuantityMetrics({
    qtyTotal: 10,
    qtyReserved: 6,
    qtyDispatched: 5,
    qtyDamaged: 2,
  })
  assert.equal(metrics.qty_available, 0)
})

test("applyDispatchOptimisticUpdate updates dispatched and remaining", () => {
  const order = {
    order_item_id: "oi1",
    order_id: "o1",
    internal_order_number: "SK1",
    sales_order_number: null,
    order_status: "Ready for Dispatch",
    payment_status: "Paid",
    order_created_at: new Date().toISOString(),
    customer_id: null,
    customer_name: "Customer",
    customer_phone: null,
    quantity: 10,
    unit_price: 1,
    subtotal: 10,
    qty_net_dispatched: 4,
    qty_returned: 0,
    qty_remaining: 6,
    dispatch_status: "partial",
    latest_dispatch_date: null,
    latest_tracking_number: null,
    latest_courier_name: null,
  } satisfies ItemOrderEntry

  const [next] = applyDispatchOptimisticUpdate([order], { orderItemId: "oi1", qtyDispatched: 6 })
  assert.equal(next.qty_net_dispatched, 10)
  assert.equal(next.qty_remaining, 0)
  assert.equal(next.dispatch_status, "fully_dispatched")
})
