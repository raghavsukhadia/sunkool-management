-- ============================================
-- Migration: Add Return Dispatch Support
-- ============================================
-- Enables explicit return dispatch records:
-- 1) dispatches.dispatch_type includes 'return'
-- 2) dispatches.shipment_status includes 'returned'
-- 3) dispatch_items.quantity allows negative values for returns

-- Ensure shipment_status column exists before altering checks
ALTER TABLE dispatches
ADD COLUMN IF NOT EXISTS shipment_status TEXT DEFAULT 'ready';

-- Replace dispatch_type check to support return dispatches
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'dispatches'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%dispatch_type%'
  LOOP
    EXECUTE format('ALTER TABLE dispatches DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE dispatches
DROP CONSTRAINT IF EXISTS dispatches_dispatch_type_check;

ALTER TABLE dispatches
ADD CONSTRAINT dispatches_dispatch_type_check
CHECK (dispatch_type IN ('partial', 'full', 'return'));

-- Replace shipment_status check to support returned shipments
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'dispatches'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%shipment_status%'
  LOOP
    EXECUTE format('ALTER TABLE dispatches DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE dispatches
DROP CONSTRAINT IF EXISTS dispatches_shipment_status_check;

ALTER TABLE dispatches
ADD CONSTRAINT dispatches_shipment_status_check
CHECK (shipment_status IN ('ready', 'picked_up', 'delivered', 'returned'));

-- Replace dispatch_items quantity check to allow negative values for returns
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'dispatch_items'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%quantity%'
  LOOP
    EXECUTE format('ALTER TABLE dispatch_items DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE dispatch_items
DROP CONSTRAINT IF EXISTS dispatch_items_quantity_check;

ALTER TABLE dispatch_items
ADD CONSTRAINT dispatch_items_quantity_check
CHECK (quantity <> 0);
