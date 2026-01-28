-- ============================================
-- Migration: Fix Order Delete Cascade (Simple Version)
-- ============================================
-- This is a simpler version that tries common constraint names

-- Try to drop the constraint with common names
ALTER TABLE dispatches
DROP CONSTRAINT IF EXISTS dispatches_order_id_fkey;

ALTER TABLE dispatches
DROP CONSTRAINT IF EXISTS dispatches_order_id_fkey1;

-- Find the actual constraint name and drop it
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'dispatches'::regclass 
          AND contype = 'f'
          AND confrelid = 'orders'::regclass
    LOOP
        EXECUTE format('ALTER TABLE dispatches DROP CONSTRAINT %I', r.conname);
        RAISE NOTICE 'Dropped constraint: %', r.conname;
    END LOOP;
END $$;

-- Recreate with CASCADE
ALTER TABLE dispatches
ADD CONSTRAINT dispatches_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES orders(id) 
ON DELETE CASCADE;

