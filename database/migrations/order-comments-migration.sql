-- ============================================
-- Migration: Order Comments & Attachments
-- ============================================
-- Creates order_comments and order_comment_attachments tables
-- for adding threaded comments with media attachments to orders.

-- ── order_comments ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_comments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  created_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_comments_order_id   ON order_comments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_comments_created_at ON order_comments(created_at DESC);

DROP TRIGGER IF EXISTS update_order_comments_updated_at ON order_comments;
CREATE TRIGGER update_order_comments_updated_at
  BEFORE UPDATE ON order_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── order_comment_attachments ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_comment_attachments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id   UUID        NOT NULL REFERENCES order_comments(id) ON DELETE CASCADE,
  order_id     UUID        NOT NULL REFERENCES orders(id)          ON DELETE CASCADE,
  file_name    TEXT        NOT NULL,
  file_url     TEXT        NOT NULL,
  file_type    TEXT        NOT NULL,
  file_size    BIGINT,
  storage_path TEXT,
  uploaded_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_comment_attachments_comment_id ON order_comment_attachments(comment_id);
CREATE INDEX IF NOT EXISTS idx_order_comment_attachments_order_id   ON order_comment_attachments(order_id);

-- ── RLS: order_comments ───────────────────────────────────────────
ALTER TABLE order_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view order comments"   ON order_comments;
CREATE POLICY "Admins can view order comments"
  ON order_comments FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert order comments" ON order_comments;
CREATE POLICY "Admins can insert order comments"
  ON order_comments FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can delete order comments" ON order_comments;
CREATE POLICY "Admins can delete order comments"
  ON order_comments FOR DELETE USING (is_admin());

-- ── RLS: order_comment_attachments ───────────────────────────────
ALTER TABLE order_comment_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view order comment attachments"   ON order_comment_attachments;
CREATE POLICY "Admins can view order comment attachments"
  ON order_comment_attachments FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert order comment attachments" ON order_comment_attachments;
CREATE POLICY "Admins can insert order comment attachments"
  ON order_comment_attachments FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can delete order comment attachments" ON order_comment_attachments;
CREATE POLICY "Admins can delete order comment attachments"
  ON order_comment_attachments FOR DELETE USING (is_admin());

-- ============================================
-- Storage Bucket: order-comment-attachments
-- ============================================
-- Create bucket if missing so deployment is fully self-contained.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'order-comment-attachments',
  'order-comment-attachments',
  true,
  52428800,
  ARRAY[
    'image/*',
    'video/*',
    'audio/*',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins can view order comment attachments storage"   ON storage.objects;
CREATE POLICY "Admins can view order comment attachments storage"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'order-comment-attachments'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can upload order comment attachments storage"  ON storage.objects;
CREATE POLICY "Admins can upload order comment attachments storage"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'order-comment-attachments'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete order comment attachments storage"  ON storage.objects;
CREATE POLICY "Admins can delete order comment attachments storage"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'order-comment-attachments'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
