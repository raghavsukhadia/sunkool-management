-- ============================================
-- Migration: Production Lists Management
-- ============================================
-- This migration creates a table for tracking production lists
-- Each production list represents a generated production PDF with specific quantities

-- ============================================
-- Production Lists Table
-- ============================================
CREATE TABLE IF NOT EXISTS production_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  production_number INTEGER NOT NULL, -- 1, 2, 3, etc. (per order)
  production_type TEXT NOT NULL CHECK (production_type IN ('full', 'partial')),
  selected_quantities JSONB, -- Stores { item_id: quantity } for partial production
  pdf_file_name TEXT,
  pdf_file_url TEXT,
  pdf_file_size INTEGER,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, production_number) -- Ensure unique production numbers per order
);

-- Create indexes for production_lists
CREATE INDEX IF NOT EXISTS idx_production_lists_order_id ON production_lists(order_id);
CREATE INDEX IF NOT EXISTS idx_production_lists_production_number ON production_lists(order_id, production_number);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_production_lists_updated_at ON production_lists;
CREATE TRIGGER update_production_lists_updated_at
  BEFORE UPDATE ON production_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on production_lists
ALTER TABLE production_lists ENABLE ROW LEVEL SECURITY;

-- RLS Policies for production_lists
DROP POLICY IF EXISTS "Admins can view all production lists" ON production_lists;
CREATE POLICY "Admins can view all production lists"
  ON production_lists FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert production lists" ON production_lists;
CREATE POLICY "Admins can insert production lists"
  ON production_lists FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update production lists" ON production_lists;
CREATE POLICY "Admins can update production lists"
  ON production_lists FOR UPDATE
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can delete production lists" ON production_lists;
CREATE POLICY "Admins can delete production lists"
  ON production_lists FOR DELETE
  USING (is_admin());

-- ============================================
-- Update production_pdfs table to link to production_lists
-- ============================================
-- Add production_list_id column to production_pdfs (optional, can be null for backward compatibility)
ALTER TABLE production_pdfs
ADD COLUMN IF NOT EXISTS production_list_id UUID REFERENCES production_lists(id) ON DELETE SET NULL;

-- Create index for production_list_id
CREATE INDEX IF NOT EXISTS idx_production_pdfs_production_list_id ON production_pdfs(production_list_id) WHERE production_list_id IS NOT NULL;

