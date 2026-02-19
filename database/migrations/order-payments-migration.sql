-- ============================================
-- Migration: Order Payment Records
-- ============================================
-- Stores one or more payment entries for an order (partial/complete)

CREATE TABLE IF NOT EXISTS order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT (now()::date),
  payment_method TEXT,
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_payment_date ON order_payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_order_payments_created_at ON order_payments(created_at DESC);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_order_payments_updated_at ON order_payments;
CREATE TRIGGER update_order_payments_updated_at
  BEFORE UPDATE ON order_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin only)
DROP POLICY IF EXISTS "Admins can view all order payments" ON order_payments;
CREATE POLICY "Admins can view all order payments"
  ON order_payments FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert order payments" ON order_payments;
CREATE POLICY "Admins can insert order payments"
  ON order_payments FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update order payments" ON order_payments;
CREATE POLICY "Admins can update order payments"
  ON order_payments FOR UPDATE
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can delete order payments" ON order_payments;
CREATE POLICY "Admins can delete order payments"
  ON order_payments FOR DELETE
  USING (is_admin());
