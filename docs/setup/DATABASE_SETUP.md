# Database Setup Guide

## Step 1: Database Schema ✅

The complete database schema has been created in `supabase-schema.sql`.

### What's Included:

1. **Custom Enums:**
   - `order_status_enum`: Pending, Approved, In Production, Partial Dispatch, Dispatched, Delivered, Cancelled
   - `payment_status_enum`: Pending, Paid, Delivered Unpaid, Refunded

2. **Core Tables:**
   - `profiles` - Admin user profiles (linked to `auth.users`)
   - `distributors` - Partner/distributor information
   - `products` - Product catalog
   - `orders` - Main order table
   - `order_items` - Order line items
   - `rewards` - Distributor reward points
   - `order_log` - Audit trail for all status changes

3. **Automatic Features:**
   - Auto-updating `updated_at` timestamps
   - Auto-logging of order status changes
   - Auto-calculation of order totals
   - Auto-creation of profile on user signup

4. **Security:**
   - Row Level Security (RLS) enabled on all tables
   - Admin-only policies (all CRUD operations for authenticated admin users)

### How to Apply:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the entire contents of `supabase-schema.sql`
4. Click **Run** to execute the schema

### Verification:

After running the SQL, verify the schema was created:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check if enums exist
SELECT typname 
FROM pg_type 
WHERE typtype = 'e';
```

### Next Steps:

Once the schema is applied, you're ready for:
- **Step 2:** Project setup (Next.js, shadcn/ui, Supabase client)
- **Step 3:** Authentication setup
- **Step 4:** Building the application pages

