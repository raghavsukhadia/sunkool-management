-- ============================================
-- Migration: Add Internal Order Number Field
-- ============================================
-- This migration adds an internal_order_number field to the orders table
-- This will store auto-generated order numbers in format SK01, SK02, SK03, etc.
-- The sales_order_number field remains for manual entry from other platforms

-- Add internal_order_number column
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS internal_order_number TEXT;

-- Create unique index for internal_order_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_internal_order_number 
ON orders(internal_order_number) 
WHERE internal_order_number IS NOT NULL;

-- Create regular index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_internal_order_number_lookup 
ON orders(internal_order_number);

