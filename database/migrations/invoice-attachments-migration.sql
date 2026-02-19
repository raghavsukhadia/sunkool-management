-- ============================================
-- Migration: Invoice Attachments
-- ============================================
-- This migration creates the invoice_attachments table used for storing
-- invoice-related PDFs, JPGs, and other file uploads.

-- Create table
CREATE TABLE IF NOT EXISTS invoice_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  storage_path TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoice_attachments_order_id ON invoice_attachments(order_id);
CREATE INDEX IF NOT EXISTS idx_invoice_attachments_created_at ON invoice_attachments(created_at DESC);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_invoice_attachments_updated_at ON invoice_attachments;
CREATE TRIGGER update_invoice_attachments_updated_at
  BEFORE UPDATE ON invoice_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE invoice_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Admins can view all invoice attachments" ON invoice_attachments;
CREATE POLICY "Admins can view all invoice attachments"
  ON invoice_attachments FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert invoice attachments" ON invoice_attachments;
CREATE POLICY "Admins can insert invoice attachments"
  ON invoice_attachments FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update invoice attachments" ON invoice_attachments;
CREATE POLICY "Admins can update invoice attachments"
  ON invoice_attachments FOR UPDATE
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can delete invoice attachments" ON invoice_attachments;
CREATE POLICY "Admins can delete invoice attachments"
  ON invoice_attachments FOR DELETE
  USING (is_admin());

-- ============================================
-- Storage Bucket Policies (invoice-attachments)
-- ============================================
-- NOTE: Create a bucket named "invoice-attachments" in Supabase Storage first.

DROP POLICY IF EXISTS "Admins can view invoice attachments" ON storage.objects;
CREATE POLICY "Admins can view invoice attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'invoice-attachments'
    AND (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "Admins can upload invoice attachments" ON storage.objects;
CREATE POLICY "Admins can upload invoice attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'invoice-attachments'
    AND (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "Admins can update invoice attachments" ON storage.objects;
CREATE POLICY "Admins can update invoice attachments"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'invoice-attachments'
    AND (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "Admins can delete invoice attachments" ON storage.objects;
CREATE POLICY "Admins can delete invoice attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'invoice-attachments'
    AND (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
  );