-- ============================================
-- Fix Sub-Items Serial Numbers
-- ============================================
-- This script removes serial numbers from sub-items
-- Run this in your Supabase SQL Editor

-- Remove serial numbers from all sub-items (items with parent_item_id)
UPDATE inventory_items
SET sr_no = NULL
WHERE parent_item_id IS NOT NULL
AND sr_no IS NOT NULL;

-- Verify the fix
SELECT 
  id,
  sr_no,
  item_name,
  parent_item_id,
  CASE 
    WHEN parent_item_id IS NULL THEN 'Parent Item'
    ELSE 'Sub-Item'
  END as item_type
FROM inventory_items
WHERE is_active = true
ORDER BY 
  CASE WHEN parent_item_id IS NULL THEN 0 ELSE 1 END,
  sr_no NULLS LAST,
  created_at DESC;

