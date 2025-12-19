-- ============================================
-- Order Management System (OMS) - Database Schema
-- ============================================
-- This file contains the complete database schema for the OMS application.
-- Run this in your Supabase SQL Editor.

-- ============================================
-- STEP 1: Create Custom Types (Enums)
-- ============================================

-- Order Status Enum
CREATE TYPE order_status_enum AS ENUM (
  'Pending',
  'Approved',
  'In Production',
  'Partial Dispatch',
  'Dispatched',
  'Delivered',
  'Cancelled'
);

-- Payment Status Enum
CREATE TYPE payment_status_enum AS ENUM (
  'Pending',
  'Paid',
  'Delivered Unpaid',
  'Refunded'
);

-- ============================================
-- STEP 2: Create Tables
-- ============================================

-- Profiles Table (extends auth.users)
-- This table stores admin user information
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Distributors Table
-- Stores partner/distributor information
CREATE TABLE distributors (
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

-- Products Table
-- Product catalog
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders Table
-- Main order table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id UUID NOT NULL REFERENCES distributors(id) ON DELETE RESTRICT,
  order_status order_status_enum NOT NULL DEFAULT 'Pending',
  payment_status payment_status_enum NOT NULL DEFAULT 'Pending',
  sales_order_number TEXT,
  total_price DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (total_price >= 0),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Items Table
-- Links products to orders with quantities
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal DECIMAL(10, 2) NOT NULL GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, product_id)
);

-- Rewards Table
-- Tracks distributor reward points
CREATE TABLE rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id UUID NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Log Table
-- Critical: Logs every status change for audit trail
CREATE TABLE order_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  changed_by_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  old_status order_status_enum,
  new_status order_status_enum NOT NULL,
  old_payment_status payment_status_enum,
  new_payment_status payment_status_enum,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 3: Create Indexes for Performance
-- ============================================

-- Orders indexes
CREATE INDEX idx_orders_distributor_id ON orders(distributor_id);
CREATE INDEX idx_orders_order_status ON orders(order_status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_sales_order_number ON orders(sales_order_number) WHERE sales_order_number IS NOT NULL;
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Order items indexes
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Rewards indexes
CREATE INDEX idx_rewards_distributor_id ON rewards(distributor_id);
CREATE INDEX idx_rewards_order_id ON rewards(order_id);

-- Order log indexes
CREATE INDEX idx_order_log_order_id ON order_log(order_id);
CREATE INDEX idx_order_log_created_at ON order_log(created_at DESC);

-- Products indexes
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_is_active ON products(is_active);

-- Distributors indexes
CREATE INDEX idx_distributors_is_active ON distributors(is_active);

-- ============================================
-- STEP 4: Create Functions for Auto-updating updated_at
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_distributors_updated_at
  BEFORE UPDATE ON distributors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_items_updated_at
  BEFORE UPDATE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 5: Create Function to Auto-log Order Status Changes
-- ============================================

-- Function to automatically log order status changes
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.order_status IS DISTINCT FROM NEW.order_status OR 
     OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    INSERT INTO order_log (
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
$$ LANGUAGE plpgsql;

-- Trigger to log order changes
CREATE TRIGGER log_order_changes
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_change();

-- ============================================
-- STEP 6: Create Function to Update Order Total
-- ============================================

-- Function to recalculate order total when items change
CREATE OR REPLACE FUNCTION update_order_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders
  SET total_price = (
    SELECT COALESCE(SUM(subtotal), 0)
    FROM order_items
    WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
  )
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers to update order total
CREATE TRIGGER update_order_total_on_insert
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_total();

CREATE TRIGGER update_order_total_on_update
  AFTER UPDATE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_total();

CREATE TRIGGER update_order_total_on_delete
  AFTER DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_total();

-- ============================================
-- STEP 7: Enable Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 8: Create RLS Policies (Admin Only)
-- ============================================

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles policies
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  USING (is_admin());

-- Distributors policies
CREATE POLICY "Admins can view all distributors"
  ON distributors FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert distributors"
  ON distributors FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update distributors"
  ON distributors FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete distributors"
  ON distributors FOR DELETE
  USING (is_admin());

-- Products policies
CREATE POLICY "Admins can view all products"
  ON products FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert products"
  ON products FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update products"
  ON products FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete products"
  ON products FOR DELETE
  USING (is_admin());

-- Orders policies
CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert orders"
  ON orders FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update orders"
  ON orders FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete orders"
  ON orders FOR DELETE
  USING (is_admin());

-- Order items policies
CREATE POLICY "Admins can view all order items"
  ON order_items FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert order items"
  ON order_items FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update order items"
  ON order_items FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete order items"
  ON order_items FOR DELETE
  USING (is_admin());

-- Rewards policies
CREATE POLICY "Admins can view all rewards"
  ON rewards FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert rewards"
  ON rewards FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update rewards"
  ON rewards FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete rewards"
  ON rewards FOR DELETE
  USING (is_admin());

-- Order log policies
CREATE POLICY "Admins can view all order logs"
  ON order_log FOR SELECT
  USING (is_admin());

-- Note: Order log is insert-only (via trigger), so we don't need INSERT/UPDATE/DELETE policies

-- ============================================
-- STEP 9: Create Function to Auto-create Profile on Signup
-- ============================================

-- Function to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'admin'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Schema Complete!
-- ============================================
-- Next steps:
-- 1. Run this SQL in your Supabase SQL Editor
-- 2. Set up your Next.js project
-- 3. Configure Supabase client
-- 4. Build the application

