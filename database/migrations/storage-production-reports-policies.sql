-- ============================================
-- Storage RLS for bucket: production-reports
-- ============================================
-- Create the bucket in Dashboard → Storage (name: production-reports, public read if you want shareable links).
-- Without policies (or without SUPABASE_SERVICE_ROLE_KEY on the server), uploads from the app will fail and
-- WhatsApp messages will omit the PDF link.

-- Authenticated admins: full access (matches production-pdfs pattern)
DROP POLICY IF EXISTS "Admins can view morning report PDFs" ON storage.objects;
CREATE POLICY "Admins can view morning report PDFs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'production-reports'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can upload morning report PDFs" ON storage.objects;
CREATE POLICY "Admins can upload morning report PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'production-reports'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update morning report PDFs" ON storage.objects;
CREATE POLICY "Admins can update morning report PDFs"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'production-reports'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete morning report PDFs" ON storage.objects;
CREATE POLICY "Admins can delete morning report PDFs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'production-reports'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Optional: allow anyone to read PDFs via public URL (only if bucket is public)
-- DROP POLICY IF EXISTS "Public read morning report PDFs" ON storage.objects;
-- CREATE POLICY "Public read morning report PDFs"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'production-reports');
