-- ─────────────────────────────────────────────────────────────────────────────
-- Order Timeline — Backfill Migration
--
-- Synthesises timeline events from existing data for orders that have no
-- timeline entries yet. Safe to re-run: every INSERT uses a NOT EXISTS guard
-- keyed on (order_id, event_type, metadata ->> 'source_id') so duplicate rows
-- are never created.
--
-- Run AFTER: order-timeline-migration.sql
-- Run order: each section is independent; order within the file is intentional
--            (order_created first gives every order its anchor event).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. order_created — one event per order ───────────────────────────────────
INSERT INTO order_timeline
  (order_id, event_type, title, description, actor, metadata, timestamp)
SELECT
  o.id,
  'order_created',
  'Order Created',
  COALESCE(
    'Order ' || o.internal_order_number || ' was created.',
    'Order was created.'
  ),
  'system',
  jsonb_build_object(
    'order_number',       o.internal_order_number,
    'sales_order_number', o.sales_order_number,
    'source_id',          o.id,
    'backfilled',         true
  ),
  o.created_at
FROM orders o
WHERE NOT EXISTS (
  SELECT 1
  FROM   order_timeline ot
  WHERE  ot.order_id   = o.id
  AND    ot.event_type = 'order_created'
  AND   (ot.metadata ->> 'source_id') = o.id::text
);

-- ── 2. production_record_created — one event per production record ────────────
INSERT INTO order_timeline
  (order_id, event_type, title, description, actor, metadata, timestamp)
SELECT
  pr.order_id,
  'production_record_created',
  CASE pr.production_type
    WHEN 'full'    THEN 'Production Started (Full)'
    WHEN 'partial' THEN 'Production Started (Partial)'
    ELSE                'Production Started'
  END,
  'Production record ' || COALESCE(pr.production_number, pr.id::text) || ' created.',
  'system',
  jsonb_build_object(
    'production_record_id', pr.id,
    'production_number',    pr.production_number,
    'production_type',      pr.production_type,
    'source_id',            pr.id,
    'backfilled',           true
  ),
  pr.created_at
FROM production_records pr
WHERE NOT EXISTS (
  SELECT 1
  FROM   order_timeline ot
  WHERE  ot.order_id   = pr.order_id
  AND    ot.event_type = 'production_record_created'
  AND   (ot.metadata ->> 'source_id') = pr.id::text
);

-- ── 3. production_completed — for records already marked completed ────────────
INSERT INTO order_timeline
  (order_id, event_type, title, description, actor, metadata, timestamp)
SELECT
  pr.order_id,
  'production_completed',
  'Production Completed',
  'Production record ' || COALESCE(pr.production_number, pr.id::text) || ' completed.',
  'system',
  jsonb_build_object(
    'production_record_id', pr.id,
    'production_number',    pr.production_number,
    'source_id',            pr.id || ':completed',
    'backfilled',           true
  ),
  COALESCE(pr.updated_at, pr.created_at)
FROM production_records pr
WHERE pr.status = 'completed'
AND NOT EXISTS (
  SELECT 1
  FROM   order_timeline ot
  WHERE  ot.order_id   = pr.order_id
  AND    ot.event_type = 'production_completed'
  AND   (ot.metadata ->> 'source_id') = (pr.id || ':completed')
);

-- ── 4. dispatch_created — one event per non-return dispatch ──────────────────
INSERT INTO order_timeline
  (order_id, event_type, title, description, actor, metadata, timestamp)
SELECT
  d.order_id,
  'dispatch_created',
  CASE d.dispatch_type
    WHEN 'full'    THEN 'Dispatch Created (Full)'
    WHEN 'partial' THEN 'Dispatch Created (Partial)'
    ELSE                'Dispatch Created'
  END,
  NULL,
  'system',
  jsonb_build_object(
    'dispatch_id',   d.id,
    'dispatch_type', d.dispatch_type,
    'tracking_id',   d.tracking_id,
    'source_id',     d.id,
    'backfilled',    true
  ),
  COALESCE(d.created_at, (d.dispatch_date::text || 'T00:00:00Z')::timestamptz)
FROM dispatches d
WHERE d.dispatch_type <> 'return'
AND NOT EXISTS (
  SELECT 1
  FROM   order_timeline ot
  WHERE  ot.order_id   = d.order_id
  AND    ot.event_type = 'dispatch_created'
  AND   (ot.metadata ->> 'source_id') = d.id::text
);

-- ── 5. return_dispatch_created — one event per return dispatch ───────────────
INSERT INTO order_timeline
  (order_id, event_type, title, description, actor, metadata, timestamp)
SELECT
  d.order_id,
  'return_dispatch_created',
  'Return Initiated',
  NULL,
  'system',
  jsonb_build_object(
    'dispatch_id', d.id,
    'source_id',   d.id,
    'backfilled',  true
  ),
  COALESCE(d.created_at, (d.dispatch_date::text || 'T00:00:00Z')::timestamptz)
FROM dispatches d
WHERE d.dispatch_type = 'return'
AND NOT EXISTS (
  SELECT 1
  FROM   order_timeline ot
  WHERE  ot.order_id   = d.order_id
  AND    ot.event_type = 'return_dispatch_created'
  AND   (ot.metadata ->> 'source_id') = d.id::text
);

-- ── 6. shipment_status_changed — final non-trivial status of each dispatch ───
--    We record only statuses that represent real movement (skip pending/ready).
INSERT INTO order_timeline
  (order_id, event_type, title, description, actor, metadata, timestamp)
SELECT
  d.order_id,
  'shipment_status_changed',
  CASE d.shipment_status
    WHEN 'picked_up'        THEN 'Shipment Picked Up'
    WHEN 'in_transit'       THEN 'In Transit'
    WHEN 'out_for_delivery' THEN 'Out for Delivery'
    WHEN 'delivered'        THEN 'Order Delivered'
    WHEN 'failed_delivery'  THEN 'Delivery Failed'
    WHEN 'rto_initiated'    THEN 'RTO Initiated'
    WHEN 'returned'         THEN 'Shipment Returned'
    WHEN 'cancelled'        THEN 'Shipment Cancelled'
    ELSE                         'Shipment Status Updated'
  END,
  NULL,
  'system',
  jsonb_build_object(
    'new_status',  d.shipment_status,
    'dispatch_id', d.id,
    'source_id',   d.id || ':' || d.shipment_status,
    'backfilled',  true
  ),
  COALESCE(d.updated_at, d.created_at)
FROM dispatches d
WHERE d.dispatch_type <> 'return'
AND   d.shipment_status NOT IN ('pending', 'ready')
AND NOT EXISTS (
  SELECT 1
  FROM   order_timeline ot
  WHERE  ot.order_id   = d.order_id
  AND    ot.event_type = 'shipment_status_changed'
  AND   (ot.metadata ->> 'source_id') = (d.id || ':' || d.shipment_status)
);

-- ── 7. invoice_created — one event per invoice ───────────────────────────────
INSERT INTO order_timeline
  (order_id, event_type, title, description, actor, metadata, timestamp)
SELECT
  inv.order_id,
  'invoice_created',
  'Invoice Created: ' || inv.invoice_number,
  'Invoice ' || inv.invoice_number || ' raised.',
  'system',
  jsonb_build_object(
    'invoice_id',     inv.id,
    'invoice_number', inv.invoice_number,
    'invoice_amount', inv.invoice_amount,
    'source_id',      inv.id,
    'backfilled',     true
  ),
  inv.created_at
FROM order_invoices inv
WHERE NOT EXISTS (
  SELECT 1
  FROM   order_timeline ot
  WHERE  ot.order_id   = inv.order_id
  AND    ot.event_type = 'invoice_created'
  AND   (ot.metadata ->> 'source_id') = inv.id::text
);

-- ── 8. payment_received — one event per payment record ───────────────────────
INSERT INTO order_timeline
  (order_id, event_type, title, description, actor, metadata, timestamp)
SELECT
  p.order_id,
  'payment_received',
  'Payment Received',
  '₹' || p.amount::text
    || COALESCE(' via ' || p.payment_method, '')
    || ' received.',
  'system',
  jsonb_build_object(
    'amount',         p.amount,
    'payment_method', p.payment_method,
    'invoice_id',     p.invoice_id,
    'source_id',      p.id,
    'backfilled',     true
  ),
  p.created_at
FROM order_payments p
WHERE NOT EXISTS (
  SELECT 1
  FROM   order_timeline ot
  WHERE  ot.order_id   = p.order_id
  AND    ot.event_type = 'payment_received'
  AND   (ot.metadata ->> 'source_id') = p.id::text
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification queries (run manually to check counts after migration)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- SELECT event_type, count(*) FROM order_timeline GROUP BY event_type ORDER BY count DESC;
--
-- SELECT o.internal_order_number, count(ot.id) AS timeline_events
-- FROM orders o
-- LEFT JOIN order_timeline ot ON ot.order_id = o.id
-- GROUP BY o.internal_order_number
-- ORDER BY timeline_events ASC
-- LIMIT 20;
