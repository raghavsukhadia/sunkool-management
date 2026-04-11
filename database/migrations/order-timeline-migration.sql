-- Order Timeline System Migration
-- Creates the order_timeline table to log every lifecycle event for an order.
-- Run after: supabase-schema.sql (needs orders + profiles tables)

-- ─── Table ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_timeline (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- What happened
  event_type  text        NOT NULL,   -- e.g. 'order_created', 'shipment_status_changed'
  title       text        NOT NULL,   -- Short label: "Order Created"
  description text,                   -- Optional detail: "SK042 placed for Acme Corp"

  -- When it happened
  timestamp   timestamptz NOT NULL DEFAULT now(),

  -- Who caused it
  actor       text        NOT NULL DEFAULT 'system', -- 'system' | 'admin' | 'courier' | 'user'
  actor_id    uuid        REFERENCES profiles(id) ON DELETE SET NULL,

  -- Flexible extra data (courier name, tracking ID, amounts, etc.)
  metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,

  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- Primary access pattern: fetch all events for an order, newest first
CREATE INDEX IF NOT EXISTS idx_order_timeline_order_ts
  ON order_timeline (order_id, timestamp DESC);

-- Secondary: filter by event type across all orders (analytics / cron)
CREATE INDEX IF NOT EXISTS idx_order_timeline_event_type
  ON order_timeline (event_type);

-- ─── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;

-- Drop any stale policy first (idempotent re-run safety)
DROP POLICY IF EXISTS "Admins can manage order_timeline" ON order_timeline;

CREATE POLICY "Admins can manage order_timeline"
  ON order_timeline
  FOR ALL
  TO authenticated
  USING    (is_admin())
  WITH CHECK (is_admin());
