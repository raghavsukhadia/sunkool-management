-- ============================================
-- Migration: Add Courier Company and Tracking ID to Dispatches
-- ============================================
-- This migration adds courier company and tracking ID fields to dispatches table

-- Add courier_company_id column to dispatches table
ALTER TABLE dispatches
ADD COLUMN IF NOT EXISTS courier_company_id UUID REFERENCES courier_companies(id) ON DELETE SET NULL;

-- Add tracking_id column to dispatches table
ALTER TABLE dispatches
ADD COLUMN IF NOT EXISTS tracking_id TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_dispatches_courier_company_id ON dispatches(courier_company_id) WHERE courier_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dispatches_tracking_id ON dispatches(tracking_id) WHERE tracking_id IS NOT NULL;

