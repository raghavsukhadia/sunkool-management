-- ============================================
-- Migration: Add customer_id and cash_discount to orders table
-- ============================================
-- This migration updates the orders table to:
-- 1. Add customer_id field (references customers table)
-- 2. Add cash_discount field (boolean)
-- 3. Make distributor_id nullable (to support both customers and distributors)

-- Add customer_id column
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT;

-- Add cash_discount column
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS cash_discount BOOLEAN DEFAULT FALSE;

-- Make distributor_id nullable (since we're using customer_id now)
ALTER TABLE orders
ALTER COLUMN distributor_id DROP NOT NULL;

-- Add constraint: either customer_id or distributor_id must be set
-- Drop constraint if it already exists
ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_customer_or_distributor_check;

ALTER TABLE orders
ADD CONSTRAINT orders_customer_or_distributor_check 
CHECK (
  (customer_id IS NOT NULL AND distributor_id IS NULL) OR 
  (customer_id IS NULL AND distributor_id IS NOT NULL)
);

-- Create index for customer_id
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- Create index for cash_discount
CREATE INDEX IF NOT EXISTS idx_orders_cash_discount ON orders(cash_discount);

-- ============================================
-- Payment Followup Table
-- ============================================
-- This table tracks payment followups for orders with cash discount
CREATE TABLE IF NOT EXISTS payment_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  followup_date DATE NOT NULL,
  payment_received BOOLEAN DEFAULT FALSE,
  payment_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, followup_date)
);

-- Create indexes for payment_followups
CREATE INDEX IF NOT EXISTS idx_payment_followups_order_id ON payment_followups(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_followups_followup_date ON payment_followups(followup_date);
CREATE INDEX IF NOT EXISTS idx_payment_followups_payment_received ON payment_followups(payment_received);

-- Add trigger for updated_at (drop if exists first)
DROP TRIGGER IF EXISTS update_payment_followups_updated_at ON payment_followups;
CREATE TRIGGER update_payment_followups_updated_at
  BEFORE UPDATE ON payment_followups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on payment_followups
ALTER TABLE payment_followups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_followups (drop if exists first)
DROP POLICY IF EXISTS "Admins can view all payment followups" ON payment_followups;
CREATE POLICY "Admins can view all payment followups"
  ON payment_followups FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert payment followups" ON payment_followups;
CREATE POLICY "Admins can insert payment followups"
  ON payment_followups FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update payment followups" ON payment_followups;
CREATE POLICY "Admins can update payment followups"
  ON payment_followups FOR UPDATE
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can delete payment followups" ON payment_followups;
CREATE POLICY "Admins can delete payment followups"
  ON payment_followups FOR DELETE
  USING (is_admin());

-- ============================================
-- Update order_items to support inventory_items
-- ============================================
-- Add inventory_item_id column to order_items
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE RESTRICT;

-- Create index for inventory_item_id
CREATE INDEX IF NOT EXISTS idx_order_items_inventory_item_id ON order_items(inventory_item_id);

-- Make product_id nullable (since we can use either products or inventory_items)
ALTER TABLE order_items
ALTER COLUMN product_id DROP NOT NULL;

-- Add constraint: either product_id or inventory_item_id must be set
ALTER TABLE order_items
DROP CONSTRAINT IF EXISTS order_items_product_or_inventory_check;

ALTER TABLE order_items
ADD CONSTRAINT order_items_product_or_inventory_check 
CHECK (
  (product_id IS NOT NULL AND inventory_item_id IS NULL) OR 
  (product_id IS NULL AND inventory_item_id IS NOT NULL)
);

-- Update unique constraint
ALTER TABLE order_items
DROP CONSTRAINT IF EXISTS order_items_order_id_product_id_key;

-- Create a new unique constraint that works with both product_id and inventory_item_id
-- We'll handle uniqueness at application level for now

