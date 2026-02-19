-- ============================================
-- FIX: Order Log RLS Violation
-- ============================================
-- This script fixes the "new row violates row-level security policy for table 'order_log'" error.
-- It makes the log_order_status_change function "SECURITY DEFINER", meaning it runs with
-- the privileges of the creator (Admin/Postgres) rather than the user triggering it.
-- This allows the trigger to insert into order_log even if the user doesn't have direct INSERT permissions.

BEGIN;

-- 1. Update the function to include SECURITY DEFINER
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.order_status IS DISTINCT FROM NEW.order_status OR 
     OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    INSERT INTO public.order_log (
      order_id,
      changed_by_user_id,
      old_status,
      new_status,
      old_payment_status,
      new_payment_status,
      notes
    ) VALUES (
      NEW.id,
      NEW.created_by, -- Using created_by as the user making the change
      OLD.order_status,
      NEW.order_status,
      OLD.payment_status,
      NEW.payment_status,
      'Status updated via application'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- <--- This is the key change

-- 2. Grant necessary permissions (just in case)
GRANT INSERT ON public.order_log TO authenticated;
-- Sequence grant removed as it does not exist (UUIDs used)

-- 3. Add an INSERT policy for order_log just to be double sure (optional if SECURITY DEFINER works, but good for backup)
-- This policy allows authenticated users to insert if it's done via the trigger (hard to restrict to trigger only via policy, so we rely on SECURITY DEFINER mostly)
-- But we can add a general insert policy for authenticated users if they are allowed to create logs (which they sort of are, via the trigger).
-- Actually, stick to SECURITY DEFINER as it's cleaner.

COMMIT;

-- Instructions:
-- Run this entire script in your Supabase SQL Editor.
