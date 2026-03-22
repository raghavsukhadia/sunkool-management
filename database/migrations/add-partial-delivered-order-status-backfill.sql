-- ============================================
-- Migration: Backfill "Partial Delivered" (step 2 of 2)
-- ============================================
-- Run ONLY after add-partial-delivered-order-status.sql has been executed
-- and committed successfully. Using the new enum in the same transaction as
-- ADD VALUE causes: ERROR 55P04 (unsafe use of new value).

-- Backfill: orders marked Delivered but line quantities not fully covered by delivered (non-return) dispatches
UPDATE orders o
SET order_status = 'Partial Delivered'
WHERE o.order_status = 'Delivered'
  AND EXISTS (
    SELECT 1
    FROM order_items oi
    WHERE oi.order_id = o.id
      AND COALESCE(
        (
          SELECT SUM(di.quantity)::numeric
          FROM dispatch_items di
          INNER JOIN dispatches d ON d.id = di.dispatch_id
          WHERE di.order_item_id = oi.id
            AND (d.dispatch_type IS NULL OR d.dispatch_type <> 'return')
            AND d.shipment_status = 'delivered'
        ),
        0
      ) < oi.quantity
  );
