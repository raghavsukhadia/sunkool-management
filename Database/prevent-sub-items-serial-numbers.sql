-- ============================================
-- Prevent Sub-Items from Having Serial Numbers
-- ============================================
-- This adds a constraint to ensure sub-items never get serial numbers
-- Run this in your Supabase SQL Editor

-- First, clean up any existing sub-items with serial numbers
UPDATE inventory_items
SET sr_no = NULL
WHERE parent_item_id IS NOT NULL
AND sr_no IS NOT NULL;

-- Add a check constraint to prevent sub-items from having serial numbers
-- Note: PostgreSQL doesn't support CHECK constraints with subqueries easily,
-- so we'll use a trigger instead

-- Create function to check and nullify serial numbers for sub-items
CREATE OR REPLACE FUNCTION prevent_subitem_serial_numbers()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is a sub-item (has parent_item_id), ensure sr_no is NULL
  IF NEW.parent_item_id IS NOT NULL THEN
    NEW.sr_no := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce this rule
DROP TRIGGER IF EXISTS check_subitem_serial_numbers ON inventory_items;
CREATE TRIGGER check_subitem_serial_numbers
  BEFORE INSERT OR UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION prevent_subitem_serial_numbers();

-- Verify the trigger works
COMMENT ON FUNCTION prevent_subitem_serial_numbers() IS 'Ensures sub-items (items with parent_item_id) never have serial numbers';

