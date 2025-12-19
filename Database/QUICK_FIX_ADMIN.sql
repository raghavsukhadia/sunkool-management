-- ============================================
-- QUICK FIX: Create/Update Admin Profile
-- ============================================
-- Copy and paste this ENTIRE block into Supabase SQL Editor and run it
-- Replace 'raghav@sunkool.in' with your email if different

-- This will create the profile if it doesn't exist, or ensure it has admin role
INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', 'Admin User'),
  'admin'
FROM auth.users
WHERE email = 'raghav@sunkool.in'
ON CONFLICT (id) 
DO UPDATE SET 
  role = 'admin',
  email = EXCLUDED.email;

-- Verify it worked:
SELECT id, email, role, full_name FROM public.profiles WHERE email = 'raghav@sunkool.in';

