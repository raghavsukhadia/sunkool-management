-- ETA Delivery Reminder Log
-- Tracks every time the daily tracking reminder was sent (or skipped/failed).
-- This allows the cron to skip re-sending on the same day and the UI to show history.

CREATE TABLE IF NOT EXISTS tracking_reminder_log (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  sent_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  reminder_date   DATE        NOT NULL,              -- IST date the reminder covered
  shipment_count  INTEGER     NOT NULL DEFAULT 0,    -- shipments found with this ETA
  sent_count      INTEGER     NOT NULL DEFAULT 0,    -- messages successfully sent
  phones_notified TEXT[]      NOT NULL DEFAULT '{}', -- which phones were notified
  dispatch_ids    TEXT[]      NOT NULL DEFAULT '{}', -- which dispatch IDs were included
  status          TEXT        NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','skipped')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE tracking_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage tracking reminder logs"
  ON tracking_reminder_log FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Index for fast daily duplicate-check
CREATE INDEX IF NOT EXISTS idx_tracking_reminder_log_date
  ON tracking_reminder_log (reminder_date, status);
