-- ============================================
-- Product Categories Schema Update
-- ============================================
-- Add category support to products for better organization
-- Run this in your Supabase SQL Editor

-- Add category column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS parent_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Create index for category filtering
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_parent_product_id ON products(parent_product_id) WHERE parent_product_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN products.category IS 'Product category/group (e.g., PPF, Window Film, Accessories)';
COMMENT ON COLUMN products.parent_product_id IS 'Reference to parent product for hierarchical structure';
COMMENT ON COLUMN products.display_order IS 'Order for displaying products within category';

