-- Add requested_payment_amount to orders (manual amount for payment flow)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS requested_payment_amount DECIMAL(10, 2) CHECK (requested_payment_amount >= 0);

COMMENT ON COLUMN orders.requested_payment_amount IS 'Manual requested payment amount for this order; used for payment tracking when set.';
