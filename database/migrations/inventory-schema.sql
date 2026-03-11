-- ============================================
-- Inventory Management System - Database Schema
-- ============================================
-- Based on Google Sheets inventory structure
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. Inventory Items Table (Main Product/Item Table)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sr_no INTEGER,
  item_name TEXT NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. Master Rolls Table (Different Dimensions)
-- ============================================
CREATE TABLE IF NOT EXISTS master_rolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL, -- e.g., "36*600", "36*120", "30*60", "20*300", etc.
  quantity DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(inventory_item_id, dimension)
);

-- ============================================
-- 3. Convertable Stock Table
-- ============================================
CREATE TABLE IF NOT EXISTS convertable_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  front DECIMAL(10, 2) DEFAULT 0,
  five_str DECIMAL(10, 2) DEFAULT 0,
  seven_str DECIMAL(10, 2) DEFAULT 0,
  balance DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(inventory_item_id)
);

-- ============================================
-- 4. Ready for Dispatch Table
-- ============================================
CREATE TABLE IF NOT EXISTS ready_for_dispatch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  sr_no INTEGER,
  item TEXT NOT NULL,
  in_hand DECIMAL(10, 2) DEFAULT 0,
  rack_location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. Cut and Roll Table
-- ============================================
CREATE TABLE IF NOT EXISTS cut_and_roll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  in_hand DECIMAL(10, 2) DEFAULT 0,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. Add Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_inventory_items_sr_no ON inventory_items(sr_no);
CREATE INDEX IF NOT EXISTS idx_inventory_items_item_name ON inventory_items(item_name);
CREATE INDEX IF NOT EXISTS idx_inventory_items_is_active ON inventory_items(is_active);
CREATE INDEX IF NOT EXISTS idx_master_rolls_inventory_item_id ON master_rolls(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_convertable_stock_inventory_item_id ON convertable_stock(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_ready_for_dispatch_inventory_item_id ON ready_for_dispatch(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_cut_and_roll_inventory_item_id ON cut_and_roll(inventory_item_id);

-- ============================================
-- 7. Add Updated_at Triggers
-- ============================================
CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_master_rolls_updated_at
  BEFORE UPDATE ON master_rolls
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_convertable_stock_updated_at
  BEFORE UPDATE ON convertable_stock
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ready_for_dispatch_updated_at
  BEFORE UPDATE ON ready_for_dispatch
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cut_and_roll_updated_at
  BEFORE UPDATE ON cut_and_roll
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. Enable RLS and Create Policies
-- ============================================
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_rolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE convertable_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE ready_for_dispatch ENABLE ROW LEVEL SECURITY;
ALTER TABLE cut_and_roll ENABLE ROW LEVEL SECURITY;

-- Inventory Items Policies
CREATE POLICY "Admins can view all inventory items"
  ON inventory_items FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert inventory items"
  ON inventory_items FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update inventory items"
  ON inventory_items FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete inventory items"
  ON inventory_items FOR DELETE
  USING (is_admin());

-- Master Rolls Policies
CREATE POLICY "Admins can view all master rolls"
  ON master_rolls FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert master rolls"
  ON master_rolls FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update master rolls"
  ON master_rolls FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete master rolls"
  ON master_rolls FOR DELETE
  USING (is_admin());

-- Convertable Stock Policies
CREATE POLICY "Admins can view all convertable stock"
  ON convertable_stock FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert convertable stock"
  ON convertable_stock FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update convertable stock"
  ON convertable_stock FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete convertable stock"
  ON convertable_stock FOR DELETE
  USING (is_admin());

-- Ready for Dispatch Policies
CREATE POLICY "Admins can view all ready for dispatch"
  ON ready_for_dispatch FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert ready for dispatch"
  ON ready_for_dispatch FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update ready for dispatch"
  ON ready_for_dispatch FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete ready for dispatch"
  ON ready_for_dispatch FOR DELETE
  USING (is_admin());

-- Cut and Roll Policies
CREATE POLICY "Admins can view all cut and roll"
  ON cut_and_roll FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert cut and roll"
  ON cut_and_roll FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update cut and roll"
  ON cut_and_roll FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete cut and roll"
  ON cut_and_roll FOR DELETE
  USING (is_admin());

