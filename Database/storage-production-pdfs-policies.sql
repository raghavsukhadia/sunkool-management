-- ============================================
-- Migration: Storage Bucket RLS Policies for Production PDFs
-- ============================================
-- This migration sets up Row-Level Security policies for the production-pdfs storage bucket
-- 
-- IMPORTANT: 
-- 1. First, create the storage bucket in Supabase Dashboard → Storage
--    - Bucket name: production-pdfs
--    - Public: Yes (or configure RLS as needed)
-- 2. Then run this SQL in Supabase SQL Editor

-- ============================================
-- Storage Bucket Policies for production-pdfs
-- ============================================
-- Note: Storage policies are applied to the storage.objects table

-- Policy: Authenticated admins can view/download files
DROP POLICY IF EXISTS "Admins can view production PDFs" ON storage.objects;
CREATE POLICY "Admins can view production PDFs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'production-pdfs' 
    AND (
      -- Allow if user is admin
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
  );

-- Policy: Authenticated admins can upload files
DROP POLICY IF EXISTS "Admins can upload production PDFs" ON storage.objects;
CREATE POLICY "Admins can upload production PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'production-pdfs' 
    AND (
      -- Allow if user is admin
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
  );

-- Policy: Authenticated admins can update files
DROP POLICY IF EXISTS "Admins can update production PDFs" ON storage.objects;
CREATE POLICY "Admins can update production PDFs"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'production-pdfs' 
    AND (
      -- Allow if user is admin
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
  );

-- Policy: Authenticated admins can delete files
DROP POLICY IF EXISTS "Admins can delete production PDFs" ON storage.objects;
CREATE POLICY "Admins can delete production PDFs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'production-pdfs' 
    AND (
      -- Allow if user is admin
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
  );

