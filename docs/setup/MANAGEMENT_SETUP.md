# Management Section Setup Guide

## ✅ What's Been Created

### 1. Database Tables
- **`courier_companies`** - For managing shipping partners
- **`customers`** - For managing customer information
- **`products`** - Already exists (for product catalog)

### 2. Management Pages
- **Products Details** (`/dashboard/management/products`)
- **Courier Company** (`/dashboard/management/courier`)
- **Customer** (`/dashboard/management/customers`)

### 3. Forms with Validation
- All forms use `react-hook-form` with `zod` validation
- Server actions for form submissions
- Error handling and success messages

## 🚀 Setup Steps

### Step 1: Apply Database Migration

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open `database-updates.sql`
4. Copy the entire contents
5. Paste into SQL Editor
6. Click **Run**

This will create:
- `courier_companies` table
- `customers` table
- RLS policies for both tables
- Indexes for performance

### Step 2: Test the Forms

1. Navigate to **Management** in your dashboard
2. Click on any of the three sections:
   - **Products Details**
   - **Courier Company**
   - **Customer**
3. Fill out the form and submit

### Step 3: Verify Data

After submitting forms, you can verify the data in Supabase:
- Go to **Table Editor** in Supabase
- Check the `products`, `courier_companies`, and `customers` tables

## 📋 Form Fields

### Products Form
- **Name** (required)
- **SKU** (required, unique)
- **Price** (required, number)
- **Description** (optional)

### Courier Company Form
- **Company Name** (required)
- **Contact Person** (optional)
- **Email** (optional, validated)
- **Phone** (optional)
- **Address** (optional)
- **Tracking URL** (optional, validated)
- **Notes** (optional)

### Customer Form
- **Customer Name** (required)
- **Email** (optional, validated)
- **Phone** (optional)
- **Contact Person** (optional)
- **Address** (optional)
- **Notes** (optional)

## 🔄 Next Steps

The forms are ready to use! Later you can:
1. Add data tables to list all entries
2. Add edit/delete functionality
3. Add search and filtering
4. Add bulk operations

## 🐛 Troubleshooting

### "Table doesn't exist" error
- Make sure you ran the `database-updates.sql` migration
- Check that tables were created in Supabase Table Editor

### "Permission denied" error
- Verify RLS policies were created
- Check that your user has admin role in `profiles` table

### Form submission fails
- Check browser console for errors
- Verify Supabase credentials in `.env.local`
- Check Supabase logs for detailed error messages

