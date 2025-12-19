-- ============================================
-- Migration: Add "Partial Order" Status
-- ============================================
-- This migration adds "Partial Order" to the order_status_enum
-- This status is used when an order is marked for partial production

-- Add "Partial Order" to the enum
ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'Partial Order';

