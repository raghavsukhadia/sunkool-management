-- ============================================
-- Migration: Add Shipment Status to Dispatches
-- ============================================
-- This migration adds shipment_status field to dispatches table
-- Status values: 'ready', 'picked_up', 'delivered'

-- Add shipment_status column to dispatches table
ALTER TABLE dispatches
ADD COLUMN IF NOT EXISTS shipment_status TEXT DEFAULT 'ready' CHECK (shipment_status IN ('ready', 'picked_up', 'delivered'));

-- Create index for shipment_status
CREATE INDEX IF NOT EXISTS idx_dispatches_shipment_status ON dispatches(shipment_status) WHERE shipment_status IS NOT NULL;

