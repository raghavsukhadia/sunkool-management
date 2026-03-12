-- ============================================
-- Migration Part 1: Add new order_status_enum values
-- ============================================
-- Run this file FIRST. Then run order-status-stages-part2-data.sql.
-- PostgreSQL requires new enum values to be committed before they can be used in UPDATE/other statements.

ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'New Order';
ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'In Progress';
ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'Ready for Dispatch';
ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'Invoiced';
ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'In Transit';
ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'Void';
