-- ============================================
-- Migration: Add "Partial Delivered" to order_status_enum (step 1 of 2)
-- ============================================
-- PostgreSQL requires this statement to be committed before the new enum
-- value can appear in UPDATE/INSERT. Run this file first, then run:
--   add-partial-delivered-order-status-backfill.sql

ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'Partial Delivered';
