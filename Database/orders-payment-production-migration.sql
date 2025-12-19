-- ============================================
-- Migration: Add Payment and Production Fields to Orders
-- ============================================
-- This migration adds fields for:
-- 1. Invoice number and ZOHO billing details
-- 2. Production PDF storage

-- Add payment fields to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS invoice_number TEXT;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS zoho_billing_details JSONB;

-- Create index for invoice_number
CREATE INDEX IF NOT EXISTS idx_orders_invoice_number ON orders(invoice_number) WHERE invoice_number IS NOT NULL;

-- ============================================
-- Production PDF Table
-- ============================================
-- Stores production PDFs for orders
CREATE TABLE IF NOT EXISTS production_pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dispatch_id UUID REFERENCES dispatches(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for production_pdfs
CREATE INDEX IF NOT EXISTS idx_production_pdfs_order_id ON production_pdfs(order_id);
CREATE INDEX IF NOT EXISTS idx_production_pdfs_dispatch_id ON production_pdfs(dispatch_id);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_production_pdfs_updated_at ON production_pdfs;
CREATE TRIGGER update_production_pdfs_updated_at
  BEFORE UPDATE ON production_pdfs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on production_pdfs
ALTER TABLE production_pdfs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for production_pdfs
DROP POLICY IF EXISTS "Admins can view all production pdfs" ON production_pdfs;
CREATE POLICY "Admins can view all production pdfs"
  ON production_pdfs FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert production pdfs" ON production_pdfs;
CREATE POLICY "Admins can insert production pdfs"
  ON production_pdfs FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update production pdfs" ON production_pdfs;
CREATE POLICY "Admins can update production pdfs"
  ON production_pdfs FOR UPDATE
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can delete production pdfs" ON production_pdfs;
CREATE POLICY "Admins can delete production pdfs"
  ON production_pdfs FOR DELETE
  USING (is_admin());

