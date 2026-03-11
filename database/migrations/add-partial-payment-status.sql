-- ============================================
-- Migration: Add Partial Payment Status
-- ============================================
-- This migration adds "Partial" to the payment_status_enum
-- and adds fields to track partial payment amounts

-- Add "Partial" to the payment_status_enum
ALTER TYPE payment_status_enum ADD VALUE IF NOT EXISTS 'Partial';

-- Add partial payment tracking fields to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS partial_payment_amount DECIMAL(10, 2) CHECK (partial_payment_amount >= 0);

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS remaining_payment_amount DECIMAL(10, 2) CHECK (remaining_payment_amount >= 0);

-- Create indexes for partial payment fields
CREATE INDEX IF NOT EXISTS idx_orders_partial_payment_amount ON orders(partial_payment_amount) WHERE partial_payment_amount IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_remaining_payment_amount ON orders(remaining_payment_amount) WHERE remaining_payment_amount IS NOT NULL;

