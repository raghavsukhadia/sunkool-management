-- ============================================
-- Add Parent Item Support for Sub-Items
-- ============================================
-- Run this in your Supabase SQL Editor to enable sub-items functionality

-- Add parent_item_id column to inventory_items table
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS parent_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE;

-- Create index for parent_item_id
CREATE INDEX IF NOT EXISTS idx_inventory_items_parent_item_id ON inventory_items(parent_item_id) WHERE parent_item_id IS NOT NULL;

