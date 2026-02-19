# Setup Guide - Order Management System

## ✅ What's Been Completed

### Step 1: Database Schema ✅
- Complete SQL schema with all tables, enums, triggers, and RLS policies
- File: `supabase-schema.sql`

### Step 2 & 3: Project Setup & Auth ✅
- Next.js 14+ project with TypeScript
- Tailwind CSS configured
- shadcn/ui components installed (Button, Card, Input, Label, Form)
- Supabase client utilities (client & server)
- Authentication middleware
- Login page
- Dashboard layout with navigation
- All route placeholders created

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**To find these values:**
1. Go to your Supabase project dashboard
2. Click on "Settings" → "API"
3. Copy the "Project URL" and "anon public" key

### 3. Apply Database Schema
1. Go to Supabase Dashboard → SQL Editor
2. Open `supabase-schema.sql`
3. Copy the entire contents
4. Paste into SQL Editor
5. Click "Run"

### 4. Create Your Admin User
1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user" → "Create new user"
3. Enter your email and password
4. The profile will be automatically created with admin role

### 5. Run the Development Server
```bash
npm run dev
```

### 6. Access the Application
- Open [http://localhost:3000](http://localhost:3000)
- You'll be redirected to `/login`
- Sign in with your admin credentials
- You'll be redirected to `/dashboard`

## 📁 Project Structure

```
sunkool-mangment/
├── app/
│   ├── dashboard/              # Protected dashboard routes
│   │   ├── layout.tsx          # Dashboard layout with nav
│   │   ├── page.tsx            # Main dashboard (with stats)
│   │   ├── orders/
│   │   │   ├── page.tsx        # All orders list (placeholder)
│   │   │   └── new/
│   │   │       └── page.tsx    # New order form (placeholder)
│   │   ├── production/
│   │   │   └── page.tsx        # Production queue (placeholder)
│   │   ├── follow-up/
│   │   │   └── page.tsx        # Payment follow-ups (placeholder)
│   │   ├── management/
│   │   │   ├── page.tsx       # Management hub
│   │   │   ├── distributors/
│   │   │   │   └── page.tsx   # Distributors table (placeholder)
│   │   │   └── products/
│   │   │       └── page.tsx   # Products table (placeholder)
│   │   └── rewards/
│   │       └── page.tsx        # Rewards (placeholder)
│   ├── login/
│   │   └── page.tsx            # Login page ✅
│   ├── layout.tsx              # Root layout
│   └── globals.css             # Global styles
├── components/
│   └── ui/                     # shadcn/ui components
│       ├── button.tsx          ✅
│       ├── card.tsx            ✅
│       ├── input.tsx           ✅
│       ├── label.tsx           ✅
│       └── form.tsx            ✅
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser client ✅
│   │   └── server.ts            # Server client ✅
│   └── utils.ts                # Utility functions ✅
├── middleware.ts               # Auth middleware ✅
├── supabase-schema.sql         # Database schema ✅
└── package.json                # Dependencies ✅
```

## 🎯 Next Steps (Step 4: Build Core App)

Now that the foundation is set, you can build the core functionality:

### Priority 1: Management Pages
1. **Distributors Data Table** (`/dashboard/management/distributors`)
   - Use TanStack Table (shadcn/ui Data Table)
   - CRUD operations (Create, Read, Update, Delete)
   - Search and filter

2. **Products Data Table** (`/dashboard/management/products`)
   - Use TanStack Table
   - CRUD operations
   - Search and filter

### Priority 2: New Order Form
3. **New Order Form** (`/dashboard/orders/new`)
   - Use `react-hook-form` with `zod` validation
   - Select distributor
   - Add multiple products with quantities
   - Calculate totals
   - Save to database

### Priority 3: Dashboard Data
4. **Dashboard Stats** (`/dashboard`)
   - Fetch real data from Supabase
   - Production Queue count
   - Payment Follow-ups count
   - Order Pipeline stats
   - Payment Overview stats
   - Recent Orders table

### Priority 4: Orders List
5. **Orders List** (`/dashboard/orders`)
   - Full Data Table with TanStack Table
   - Search, filter, sort
   - Status badges
   - View/edit order details

### Priority 5: Filtered Views
6. **Production Queue** (`/dashboard/production`)
   - Pre-filtered orders with status "In Production"

7. **Payment Follow-ups** (`/dashboard/follow-up`)
   - Pre-filtered orders needing payment attention

## 🔧 Available Components

You have these shadcn/ui components ready to use:
- `Button` - Various variants and sizes
- `Card` - For content containers
- `Input` - Form inputs
- `Label` - Form labels
- `Form` - Complete form system with react-hook-form

## 📝 Database Types Reference

### Order Status Enum
```typescript
type OrderStatus = 
  | 'Pending'
  | 'Approved'
  | 'In Production'
  | 'Partial Dispatch'
  | 'Dispatched'
  | 'Delivered'
  | 'Cancelled'
```

### Payment Status Enum
```typescript
type PaymentStatus = 
  | 'Pending'
  | 'Paid'
  | 'Delivered Unpaid'
  | 'Refunded'
```

## 🐛 Troubleshooting

### "Cannot find module" errors
- Run `npm install` again
- Make sure all dependencies in `package.json` are installed

### Authentication not working
- Check `.env.local` has correct Supabase credentials
- Verify middleware is running (check `middleware.ts`)
- Check browser console for errors

### Database errors
- Verify schema was applied correctly in Supabase
- Check RLS policies are active
- Verify your user has admin role in `profiles` table

### Styling issues
- Make sure Tailwind is configured correctly
- Check `tailwind.config.ts` and `postcss.config.js`
- Verify `globals.css` is imported in root layout

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [TanStack Table](https://tanstack.com/table)
- [react-hook-form](https://react-hook-form.com)

---

**You're all set!** The foundation is complete. Start building the Management pages first, then move on to the Order form and Dashboard data fetching.

