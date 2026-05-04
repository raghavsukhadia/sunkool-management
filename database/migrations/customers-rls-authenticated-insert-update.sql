-- Customers: allow authenticated users to INSERT / UPDATE
-- -----------------------------------------------------------------------------
-- Context: database-updates.sql created admin-only INSERT/UPDATE policies.
-- multiuser-rls-fix.sql added SELECT for all authenticated users but did not
-- add INSERT/UPDATE for authenticated roles. Non-admin users then see:
--   "new row violates row-level security policy for table 'customers'"
-- when using Management > Customers (createCustomer / updateCustomer server actions).
--
-- Admin policies remain; RLS ORs permissive policies — admins still match their
-- policies; all signed-in users match the policies below.
-- DELETE stays admin-only unless you add a separate migration.

DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;
CREATE POLICY "Authenticated users can insert customers"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
CREATE POLICY "Authenticated users can update customers"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
