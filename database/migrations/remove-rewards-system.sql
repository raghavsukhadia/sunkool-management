-- Remove Rewards system objects (full decommission)
-- Permanent delete: drops rewards policies/indexes/table if present.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'rewards'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all rewards" ON public.rewards';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can insert rewards" ON public.rewards';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can update rewards" ON public.rewards';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can delete rewards" ON public.rewards';
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_rewards_distributor_id;
DROP INDEX IF EXISTS public.idx_rewards_order_id;
DROP TABLE IF EXISTS public.rewards;
