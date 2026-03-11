-- ============================================
-- Migration: Production Records Management
-- ============================================
-- This migration creates a table for tracking production records
-- Each production record represents a production batch with unique numbering (SK01A, SK01B, etc.)

-- ============================================
-- Production Records Table
-- ============================================
CREATE TABLE IF NOT EXISTS production_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  production_number TEXT NOT NULL, -- Unique: SK01A, SK01B, etc.
  production_type TEXT NOT NULL CHECK (production_type IN ('full', 'partial')),
  selected_quantities JSONB, -- Stores { item_id: quantity } for partial production
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_production', 'completed')),
  pdf_file_name TEXT,
  pdf_file_url TEXT,
  pdf_file_size INTEGER,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, production_number) -- Ensure unique production numbers per order
);

-- Create indexes for production_records
CREATE INDEX IF NOT EXISTS idx_production_records_order_id ON production_records(order_id);
CREATE INDEX IF NOT EXISTS idx_production_records_production_number ON production_records(production_number);
CREATE INDEX IF NOT EXISTS idx_production_records_status ON production_records(status);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_production_records_updated_at ON production_records;
CREATE TRIGGER update_production_records_updated_at
  BEFORE UPDATE ON production_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on production_records
ALTER TABLE production_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for production_records
DROP POLICY IF EXISTS "Admins can view all production records" ON production_records;
CREATE POLICY "Admins can view all production records"
  ON production_records FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert production records" ON production_records;
CREATE POLICY "Admins can insert production records"
  ON production_records FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update production records" ON production_records;
CREATE POLICY "Admins can update production records"
  ON production_records FOR UPDATE
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can delete production records" ON production_records;
CREATE POLICY "Admins can delete production records"
  ON production_records FOR DELETE
  USING (is_admin());

-- ============================================
-- Update dispatches table to reference production records
-- ============================================
ALTER TABLE dispatches
ADD COLUMN IF NOT EXISTS production_record_id UUID REFERENCES production_records(id) ON DELETE SET NULL;

-- Create index for production_record_id
CREATE INDEX IF NOT EXISTS idx_dispatches_production_record_id ON dispatches(production_record_id) WHERE production_record_id IS NOT NULL;

-- ============================================
-- Update production_pdfs table to reference production records
-- ============================================
ALTER TABLE production_pdfs
ADD COLUMN IF NOT EXISTS production_record_id UUID REFERENCES production_records(id) ON DELETE SET NULL;

-- Create index for production_record_id
CREATE INDEX IF NOT EXISTS idx_production_pdfs_production_record_id ON production_pdfs(production_record_id) WHERE production_record_id IS NOT NULL;

