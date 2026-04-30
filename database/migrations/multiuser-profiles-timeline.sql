-- ============================================================================
-- Multi-User: Fix profiles table, timeline RLS, and auto-profile triggers
-- ============================================================================
-- Run this once in your Supabase SQL Editor.
-- Safe to re-run: all steps use IF EXISTS / ON CONFLICT guards.
-- ============================================================================

-- ── 1. Expand profiles.role to allow 'user' ──────────────────────────────────
--    The original schema had CHECK (role IN ('admin')), blocking new users.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'user'));

-- ── 2. Fix profiles RLS ───────────────────────────────────────────────────────
--    All authenticated users must be able to READ profiles so the
--    timeline join (profiles:actor_id) resolves names for everyone.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
CREATE POLICY "Authenticated users can read profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Service-role writes (from user management feature) bypass RLS entirely,
-- so no extra INSERT policy is needed for the admin API path.

-- ── 3. Fix order_timeline RLS ─────────────────────────────────────────────────
--    The original single policy (FOR ALL / is_admin()) silently dropped
--    every INSERT from non-admin users, so their actions never appeared
--    in the timeline.

DROP POLICY IF EXISTS "Admins can manage order_timeline" ON public.order_timeline;

-- All authenticated users may log events and read events.
DROP POLICY IF EXISTS "Authenticated users can insert timeline events" ON public.order_timeline;
CREATE POLICY "Authenticated users can insert timeline events"
  ON public.order_timeline FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view timeline events" ON public.order_timeline;
CREATE POLICY "Authenticated users can view timeline events"
  ON public.order_timeline FOR SELECT
  TO authenticated
  USING (true);

-- Only admins may delete timeline events.
DROP POLICY IF EXISTS "Admins can delete timeline events" ON public.order_timeline;
CREATE POLICY "Admins can delete timeline events"
  ON public.order_timeline FOR DELETE
  TO authenticated
  USING (is_admin());

-- ── 4. Trigger: auto-create profile when a new auth user is created ───────────
--    Fires whenever a user is created via the Admin API (createUser),
--    so every new application user automatically gets a profiles row.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    CASE
      WHEN lower(NEW.email) = 'raghav@sunkool.in' THEN 'admin'
      ELSE 'user'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- ── 5. Trigger: sync full_name when user metadata is updated ──────────────────
--    When admin edits a user's name via the Users management page,
--    the profiles.full_name is kept in sync automatically.

CREATE OR REPLACE FUNCTION public.sync_profile_from_auth_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    full_name  = COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), full_name),
    email      = NEW.email,
    updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (
    OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data
    OR OLD.email IS DISTINCT FROM NEW.email
  )
  EXECUTE FUNCTION public.sync_profile_from_auth_update();

-- ── 6. Backfill: create profiles for all existing auth users ──────────────────
--    Covers raghav@sunkool.in and any users created before this migration.

INSERT INTO public.profiles (id, email, full_name, role)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'name', ''),
  CASE
    WHEN lower(u.email) = 'raghav@sunkool.in' THEN 'admin'
    ELSE 'user'
  END
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Also update full_name for existing profiles where it is empty but
-- the auth user now has a name in metadata (e.g. after our user management edits).
UPDATE public.profiles p
SET full_name = u.raw_user_meta_data->>'name'
FROM auth.users u
WHERE p.id = u.id
  AND (p.full_name IS NULL OR p.full_name = '')
  AND (u.raw_user_meta_data->>'name') IS NOT NULL
  AND (u.raw_user_meta_data->>'name') <> '';

-- ── 7. Verify ─────────────────────────────────────────────────────────────────
SELECT id, email, full_name, role FROM public.profiles ORDER BY role, email;
