-- ============================================
-- Fix Admin Profile for Existing User
-- ============================================
-- Run this in your Supabase SQL Editor
-- This will check and create/update the profile for your user

-- Step 1: Check if profile exists for your user
-- Replace 'raghav@sunkool.in' with your actual email
SELECT 
  u.id as user_id,
  u.email,
  p.id as profile_id,
  p.role,
  p.full_name
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.email = 'raghav@sunkool.in';

-- Step 2: If profile doesn't exist or doesn't have admin role, run this:
-- (Replace the email and user_id with your actual values from Step 1)

-- Option A: If profile doesn't exist, create it:
INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', ''),
  'admin'
FROM auth.users
WHERE email = 'raghav@sunkool.in'
ON CONFLICT (id) DO NOTHING;

-- Option B: If profile exists but role is wrong, update it:
UPDATE public.profiles
SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'raghav@sunkool.in'
);

-- Step 3: Verify the profile was created/updated correctly:
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.created_at
FROM public.profiles p
WHERE p.email = 'raghav@sunkool.in';

-- ============================================
-- Alternative: One-command fix (run this if you prefer)
-- ============================================
-- This will create the profile if it doesn't exist, or update the role if it does
INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', ''),
  'admin'
FROM auth.users
WHERE email = 'raghav@sunkool.in'
ON CONFLICT (id) 
DO UPDATE SET 
  role = 'admin',
  email = EXCLUDED.email;

