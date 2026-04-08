-- ============================================================
-- Migration: Shipment Command Center
-- Extends dispatches with tracking columns + notes table
-- ============================================================

-- ── 1. Add new columns to dispatches ─────────────────────────
ALTER TABLE dispatches
  ADD COLUMN IF NOT EXISTS estimated_delivery  DATE,
  ADD COLUMN IF NOT EXISTS current_location    TEXT,
  ADD COLUMN IF NOT EXISTS last_location_at    TIMESTAMPTZ;

-- ── 2. Expand shipment_status constraint ─────────────────────
-- Drop existing constraint first (name may vary, handle both)
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'dispatches'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%shipment_status%'
  LOOP
    EXECUTE format('ALTER TABLE dispatches DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE dispatches
  ADD CONSTRAINT dispatches_shipment_status_check
  CHECK (shipment_status IN (
    'pending',
    'ready',
    'picked_up',
    'in_transit',
    'out_for_delivery',
    'delivered',
    'failed_delivery',
    'rto_initiated',
    'returned',
    'cancelled'
  ));

-- ── 3. Shipment Notes ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipment_notes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id  UUID        NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  note         TEXT        NOT NULL CHECK (char_length(note) <= 1000),
  created_by   UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipment_notes_dispatch_id
  ON shipment_notes(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_shipment_notes_created_at
  ON shipment_notes(created_at DESC);

-- ── 4. RLS for shipment_notes ─────────────────────────────────
ALTER TABLE shipment_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage shipment_notes" ON shipment_notes;
CREATE POLICY "Admins manage shipment_notes"
  ON shipment_notes FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ── 5. Performance indexes on dispatches ─────────────────────
CREATE INDEX IF NOT EXISTS idx_dispatches_shipment_status
  ON dispatches(shipment_status);
CREATE INDEX IF NOT EXISTS idx_dispatches_estimated_delivery
  ON dispatches(estimated_delivery);
CREATE INDEX IF NOT EXISTS idx_dispatches_dispatch_date
  ON dispatches(dispatch_date DESC);
