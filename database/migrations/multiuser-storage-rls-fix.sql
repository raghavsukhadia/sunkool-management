-- ============================================================================
-- Multi-User Storage RLS Fix
-- ============================================================================
-- Problem:
--   Storage bucket policies were admin-only, so non-admin authenticated users
--   hit RLS errors while running normal workflow actions (checklists/uploads).
--
-- Buckets covered:
--   - production-pdfs
--   - invoice-attachments
--   - order-comment-attachments
--
-- Safe to re-run: uses DROP POLICY IF EXISTS.
-- ============================================================================

-- ── production-pdfs ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view production PDFs"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload production PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update production PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete production PDFs" ON storage.objects;

CREATE POLICY "Authenticated users can view production PDFs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'production-pdfs');

CREATE POLICY "Authenticated users can upload production PDFs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'production-pdfs');

CREATE POLICY "Authenticated users can update production PDFs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'production-pdfs')
  WITH CHECK (bucket_id = 'production-pdfs');

CREATE POLICY "Authenticated users can delete production PDFs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'production-pdfs');

-- ── invoice-attachments ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view invoice attachments storage"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload invoice attachments storage" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update invoice attachments storage" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete invoice attachments storage" ON storage.objects;

CREATE POLICY "Authenticated users can view invoice attachments storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'invoice-attachments');

CREATE POLICY "Authenticated users can upload invoice attachments storage"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'invoice-attachments');

CREATE POLICY "Authenticated users can update invoice attachments storage"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'invoice-attachments')
  WITH CHECK (bucket_id = 'invoice-attachments');

CREATE POLICY "Authenticated users can delete invoice attachments storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'invoice-attachments');

-- ── order-comment-attachments ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view order comment attachments storage"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload order comment attachments storage" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update order comment attachments storage" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete order comment attachments storage" ON storage.objects;

CREATE POLICY "Authenticated users can view order comment attachments storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'order-comment-attachments');

CREATE POLICY "Authenticated users can upload order comment attachments storage"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'order-comment-attachments');

CREATE POLICY "Authenticated users can update order comment attachments storage"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'order-comment-attachments')
  WITH CHECK (bucket_id = 'order-comment-attachments');

CREATE POLICY "Authenticated users can delete order comment attachments storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'order-comment-attachments');

-- ── Verify ───────────────────────────────────────────────────────────────────
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (
    policyname ILIKE '%production PDFs%'
    OR policyname ILIKE '%invoice attachments%'
    OR policyname ILIKE '%order comment attachments%'
  )
ORDER BY policyname, cmd;
