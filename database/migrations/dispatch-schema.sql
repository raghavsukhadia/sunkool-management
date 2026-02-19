-- ============================================
-- Migration: Dispatch Management
-- ============================================
-- This migration creates tables for tracking order dispatches
-- Supports both partial and full dispatches

-- ============================================
-- Dispatch Table
-- ============================================
CREATE TABLE IF NOT EXISTS dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  dispatch_type TEXT NOT NULL CHECK (dispatch_type IN ('partial', 'full')),
  dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for dispatches
CREATE INDEX IF NOT EXISTS idx_dispatches_order_id ON dispatches(order_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_dispatch_date ON dispatches(dispatch_date);
CREATE INDEX IF NOT EXISTS idx_dispatches_dispatch_type ON dispatches(dispatch_type);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_dispatches_updated_at ON dispatches;
CREATE TRIGGER update_dispatches_updated_at
  BEFORE UPDATE ON dispatches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on dispatches
ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dispatches
DROP POLICY IF EXISTS "Admins can view all dispatches" ON dispatches;
CREATE POLICY "Admins can view all dispatches"
  ON dispatches FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert dispatches" ON dispatches;
CREATE POLICY "Admins can insert dispatches"
  ON dispatches FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update dispatches" ON dispatches;
CREATE POLICY "Admins can update dispatches"
  ON dispatches FOR UPDATE
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can delete dispatches" ON dispatches;
CREATE POLICY "Admins can delete dispatches"
  ON dispatches FOR DELETE
  USING (is_admin());

-- ============================================
-- Dispatch Items Table
-- ============================================
-- Tracks which items and quantities were dispatched
CREATE TABLE IF NOT EXISTS dispatch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for dispatch_items
CREATE INDEX IF NOT EXISTS idx_dispatch_items_dispatch_id ON dispatch_items(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_items_order_item_id ON dispatch_items(order_item_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_items_inventory_item_id ON dispatch_items(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_items_product_id ON dispatch_items(product_id);

-- Enable RLS on dispatch_items
ALTER TABLE dispatch_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dispatch_items
DROP POLICY IF EXISTS "Admins can view all dispatch items" ON dispatch_items;
CREATE POLICY "Admins can view all dispatch items"
  ON dispatch_items FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert dispatch items" ON dispatch_items;
CREATE POLICY "Admins can insert dispatch items"
  ON dispatch_items FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update dispatch items" ON dispatch_items;
CREATE POLICY "Admins can update dispatch items"
  ON dispatch_items FOR UPDATE
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can delete dispatch items" ON dispatch_items;
CREATE POLICY "Admins can delete dispatch items"
  ON dispatch_items FOR DELETE
  USING (is_admin());

