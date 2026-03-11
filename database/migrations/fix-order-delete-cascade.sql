-- ============================================
-- Migration: Fix Order Delete Cascade
-- ============================================
-- This migration changes the foreign key constraint on dispatches
-- to allow orders to be deleted (cascade will delete related dispatches)

-- First, find and drop the existing foreign key constraint
-- The constraint name might vary, so we'll find it dynamically
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name for dispatches.order_id -> orders.id
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'dispatches'::regclass
      AND confrelid = 'orders'::regclass
      AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'dispatches'::regclass AND attname = 'order_id')]
      AND contype = 'f';
    
    -- Drop the constraint if it exists
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE dispatches DROP CONSTRAINT %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No foreign key constraint found for dispatches.order_id';
    END IF;
END $$;

-- Recreate the foreign key with CASCADE
ALTER TABLE dispatches
ADD CONSTRAINT dispatches_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES orders(id) 
ON DELETE CASCADE;

-- Also ensure production_pdfs has CASCADE (if it exists)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Check if production_pdfs table exists and find its constraint
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'production_pdfs') THEN
        SELECT conname INTO constraint_name
        FROM pg_constraint
        WHERE conrelid = 'production_pdfs'::regclass
          AND confrelid = 'orders'::regclass
          AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'production_pdfs'::regclass AND attname = 'order_id')]
          AND contype = 'f';
        
        IF constraint_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE production_pdfs DROP CONSTRAINT %I', constraint_name);
            EXECUTE format('ALTER TABLE production_pdfs ADD CONSTRAINT production_pdfs_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE');
            RAISE NOTICE 'Updated production_pdfs constraint: %', constraint_name;
        END IF;
    END IF;
END $$;

