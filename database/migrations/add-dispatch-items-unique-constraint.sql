-- Add unique constraint to dispatch_items to prevent duplicate items in same dispatch
-- This prevents the same order_item from being listed multiple times in a single dispatch

ALTER TABLE dispatch_items 
ADD CONSTRAINT unique_dispatch_item UNIQUE(dispatch_id, order_item_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_dispatch_items_unique_check ON dispatch_items(dispatch_id, order_item_id);
