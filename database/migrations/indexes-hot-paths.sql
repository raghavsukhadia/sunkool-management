-- Indexes for hot paths (orders list, order detail, production, follow-ups).
-- Run in Supabase SQL Editor. Safe to run multiple times (IF NOT EXISTS).

-- Orders: filter by status (dashboard, production, orders list)
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders (order_status);

-- Orders: filter by customer (order list, customer detail)
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders (customer_id);

-- Orders: created_at for recent orders / ordering
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);

-- Order items: by order (order detail, production)
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);

-- Dispatches: by order (order detail, shipment tab)
CREATE INDEX IF NOT EXISTS idx_dispatches_order_id ON dispatches (order_id);

-- Payment followups: by order (order detail, follow-up page)
CREATE INDEX IF NOT EXISTS idx_payment_followups_order_id ON payment_followups (order_id);

-- Production records: by order (order detail, production page)
CREATE INDEX IF NOT EXISTS idx_production_records_order_id ON production_records (order_id);

-- Order payments: by order (order detail, payment tab)
CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON order_payments (order_id);

-- Invoice attachments: by order (order detail)
CREATE INDEX IF NOT EXISTS idx_invoice_attachments_order_id ON invoice_attachments (order_id);
