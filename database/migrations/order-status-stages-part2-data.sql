-- ============================================
-- Migration Part 2: Migrate data and set default
-- ============================================
-- Run this AFTER order-status-stages-part1-enum.sql has been run (and committed).

-- Pending, Approved -> New Order
UPDATE orders SET order_status = 'New Order' WHERE order_status IN ('Pending', 'Approved');

-- In Production, Partial Order -> In Progress
UPDATE orders SET order_status = 'In Progress' WHERE order_status IN ('In Production', 'Partial Order');

-- Cancelled -> Void
UPDATE orders SET order_status = 'Void' WHERE order_status = 'Cancelled';

-- Partial Dispatch / Dispatched: first set all to Ready for Dispatch, then In Transit where any shipment is picked_up
UPDATE orders
SET order_status = 'Ready for Dispatch'
WHERE order_status IN ('Partial Dispatch', 'Dispatched');

UPDATE orders o
SET order_status = 'In Transit'
WHERE o.order_status = 'Ready for Dispatch'
  AND EXISTS (
    SELECT 1 FROM dispatches d
    WHERE d.order_id = o.id AND (d.dispatch_type IS NULL OR d.dispatch_type != 'return') AND d.shipment_status = 'picked_up'
  );

-- Set default for new orders
ALTER TABLE orders ALTER COLUMN order_status SET DEFAULT 'New Order';
