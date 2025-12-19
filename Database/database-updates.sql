-- ============================================
-- Database Updates for Management Section
-- ============================================
-- Run this in your Supabase SQL Editor to add the new tables

-- ============================================
-- 1. Create Courier Companies Table
-- ============================================
CREATE TABLE IF NOT EXISTS courier_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  tracking_url TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. Rename Distributors to Customers (Optional - keeping both for now)
-- ============================================
-- Note: We'll keep 'distributors' table as is, but you can use it as 'customers'
-- If you want to rename, uncomment below:
-- ALTER TABLE distributors RENAME TO customers;

-- OR create a new customers table if you want to keep both separate:
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  contact_person TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. Add Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_courier_companies_is_active ON courier_companies(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- ============================================
-- 4. Add Updated_at Triggers
-- ============================================
CREATE TRIGGER update_courier_companies_updated_at
  BEFORE UPDATE ON courier_companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. Enable RLS and Create Policies
-- ============================================
ALTER TABLE courier_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Courier Companies Policies
CREATE POLICY "Admins can view all courier companies"
  ON courier_companies FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert courier companies"
  ON courier_companies FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update courier companies"
  ON courier_companies FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete courier companies"
  ON courier_companies FOR DELETE
  USING (is_admin());

-- Customers Policies
CREATE POLICY "Admins can view all customers"
  ON customers FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert customers"
  ON customers FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update customers"
  ON customers FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete customers"
  ON customers FOR DELETE
  USING (is_admin());

