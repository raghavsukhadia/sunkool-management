-- ============================================
-- Migration: Order Invoices (multi-invoice per order)
-- ============================================
-- Adds:
-- - order_invoices: 1..N invoices per order (optionally linked to a dispatch)
-- - order_payments.invoice_id: allocate each payment to an invoice
-- - invoice_attachments.invoice_id (optional): associate attachments to a specific invoice
-- Backfills:
-- - Creates a single "legacy" invoice per order where needed and links existing payments/attachments.

-- ============================================
-- 1) Create order_invoices table
-- ============================================
CREATE TABLE IF NOT EXISTS order_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dispatch_id UUID REFERENCES dispatches(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  invoice_amount NUMERIC(12,2) NOT NULL CHECK (invoice_amount >= 0),
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes / constraints
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_invoices_order_invoice_number
  ON order_invoices(order_id, invoice_number);

-- Enforce: at most one invoice per dispatch (when linked)
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_invoices_dispatch_id_not_null
  ON order_invoices(dispatch_id)
  WHERE dispatch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_invoices_order_id ON order_invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_order_invoices_dispatch_id ON order_invoices(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_order_invoices_invoice_date ON order_invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_order_invoices_created_at ON order_invoices(created_at DESC);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_order_invoices_updated_at ON order_invoices;
CREATE TRIGGER update_order_invoices_updated_at
  BEFORE UPDATE ON order_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE order_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin only)
DROP POLICY IF EXISTS "Admins can view all order invoices" ON order_invoices;
CREATE POLICY "Admins can view all order invoices"
  ON order_invoices FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert order invoices" ON order_invoices;
CREATE POLICY "Admins can insert order invoices"
  ON order_invoices FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update order invoices" ON order_invoices;
CREATE POLICY "Admins can update order invoices"
  ON order_invoices FOR UPDATE
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can delete order invoices" ON order_invoices;
CREATE POLICY "Admins can delete order invoices"
  ON order_invoices FOR DELETE
  USING (is_admin());

-- ============================================
-- 2) Add invoice_id to order_payments (allocate payments to invoices)
-- ============================================
ALTER TABLE order_payments
ADD COLUMN IF NOT EXISTS invoice_id UUID;

CREATE INDEX IF NOT EXISTS idx_order_payments_invoice_id ON order_payments(invoice_id);

-- ============================================
-- 3) Add invoice_id to invoice_attachments (optional)
-- ============================================
ALTER TABLE invoice_attachments
ADD COLUMN IF NOT EXISTS invoice_id UUID;

CREATE INDEX IF NOT EXISTS idx_invoice_attachments_invoice_id ON invoice_attachments(invoice_id);

-- ============================================
-- 4) Backfill legacy invoices and link existing rows
-- ============================================
DO $$
DECLARE
  r RECORD;
  legacy_invoice_id UUID;
  base_number TEXT;
  inv_no TEXT;
  inv_amt NUMERIC(12,2);
BEGIN
  -- For any order that has payments OR attachments OR a legacy invoice_number/requested_payment_amount set,
  -- ensure there is at least one invoice to anchor historical data.
  FOR r IN
    SELECT
      o.id AS order_id,
      o.invoice_number AS legacy_invoice_number,
      o.internal_order_number AS internal_order_number,
      o.requested_payment_amount AS requested_payment_amount,
      o.total_price AS total_price,
      EXISTS (SELECT 1 FROM order_payments op WHERE op.order_id = o.id) AS has_payments,
      EXISTS (SELECT 1 FROM invoice_attachments ia WHERE ia.order_id = o.id) AS has_attachments
    FROM orders o
    WHERE
      EXISTS (SELECT 1 FROM order_payments op WHERE op.order_id = o.id)
      OR EXISTS (SELECT 1 FROM invoice_attachments ia WHERE ia.order_id = o.id)
      OR (o.invoice_number IS NOT NULL AND btrim(o.invoice_number) <> '')
      OR (o.requested_payment_amount IS NOT NULL)
  LOOP
    -- compute legacy invoice number
    base_number := NULLIF(btrim(r.internal_order_number), '');
    IF base_number IS NULL THEN
      base_number := substring(r.order_id::text from 1 for 8);
    END IF;

    inv_no := NULLIF(btrim(r.legacy_invoice_number), '');
    IF inv_no IS NULL THEN
      inv_no := 'INV-' || base_number;
    END IF;

    inv_amt := COALESCE(r.requested_payment_amount, r.total_price, 0);

    -- find or create the legacy invoice (dispatch_id is NULL)
    SELECT oi.id
      INTO legacy_invoice_id
    FROM order_invoices oi
    WHERE oi.order_id = r.order_id
      AND oi.dispatch_id IS NULL
    ORDER BY oi.created_at ASC
    LIMIT 1;

    IF legacy_invoice_id IS NULL THEN
      INSERT INTO order_invoices (order_id, dispatch_id, invoice_number, invoice_date, invoice_amount, notes)
      VALUES (r.order_id, NULL, inv_no, CURRENT_DATE, inv_amt, 'Legacy invoice (auto-created during migration)')
      RETURNING id INTO legacy_invoice_id;
    END IF;

    -- link existing payments to legacy invoice if not already linked
    UPDATE order_payments
      SET invoice_id = legacy_invoice_id
    WHERE order_id = r.order_id
      AND invoice_id IS NULL;

    -- link existing attachments to legacy invoice if not already linked
    UPDATE invoice_attachments
      SET invoice_id = legacy_invoice_id
    WHERE order_id = r.order_id
      AND invoice_id IS NULL;
  END LOOP;

  -- Add FK constraint after backfill (safe to run repeatedly)
  BEGIN
    ALTER TABLE order_payments
      ADD CONSTRAINT fk_order_payments_invoice_id
      FOREIGN KEY (invoice_id) REFERENCES order_invoices(id) ON DELETE RESTRICT;
  EXCEPTION WHEN duplicate_object THEN
    -- ignore if constraint already exists
  END;

  BEGIN
    ALTER TABLE invoice_attachments
      ADD CONSTRAINT fk_invoice_attachments_invoice_id
      FOREIGN KEY (invoice_id) REFERENCES order_invoices(id) ON DELETE SET NULL;
  EXCEPTION WHEN duplicate_object THEN
    -- ignore if constraint already exists
  END;

  -- Enforce NOT NULL for invoice_id only when all existing payments have been linked.
  -- If some payments exist for orders that didn't qualify above, this will still succeed due to the WHERE clause.
  IF EXISTS (SELECT 1 FROM order_payments WHERE invoice_id IS NULL) THEN
    RAISE NOTICE 'order_payments.invoice_id still has NULLs; leaving column nullable for now.';
  ELSE
    ALTER TABLE order_payments
      ALTER COLUMN invoice_id SET NOT NULL;
  END IF;
END $$;

