# Order Management System (OMS)

A professional, single-user Order Management System built with Next.js 14, TypeScript, Supabase, and shadcn/ui.

## Features

- **Dashboard**: Overview of orders, production queue, payment follow-ups, and key metrics
- **Order Management**: Create, view, and manage orders with full status tracking
- **Production Queue**: Track items that need manufacturing
- **Payment Follow-ups**: Manage invoices requiring attention
- **Management**: Manage distributors and products
- **Rewards System**: Track distributor reward points
- **Audit Trail**: Complete order status change logging

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode)
- **Database & Auth**: Supabase (PostgreSQL, Supabase Auth)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Form Management**: react-hook-form with zod validation
- **Tables**: TanStack Table

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase project created
- Supabase database schema applied (see `supabase-schema.sql`)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   - Copy `.env.local.example` to `.env.local`
   - Fill in your Supabase credentials:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

3. **Apply database schema:**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Copy and paste the contents of `supabase-schema.sql`
   - Run the SQL to create all tables, enums, and policies

4. **Create your admin user:**
   - Go to Supabase Authentication
   - Create a new user (this will automatically create a profile with admin role)

5. **Run the development server:**
   ```bash
   npm run dev
   ```

6. **Open your browser:**
   - Navigate to [http://localhost:3000](http://localhost:3000)
   - You'll be redirected to `/login`
   - Sign in with your admin credentials

## Project Structure

```
├── app/
│   ├── dashboard/          # Protected dashboard routes
│   │   ├── layout.tsx     # Dashboard layout with navigation
│   │   ├── page.tsx       # Main dashboard page
│   │   ├── orders/        # Order management pages
│   │   ├── production/    # Production queue
│   │   ├── follow-up/     # Payment follow-ups
│   │   ├── management/    # Management pages (distributors, products)
│   │   └── rewards/       # Rewards management
│   ├── login/             # Login page (public)
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/
│   └── ui/                # shadcn/ui components
├── lib/
│   ├── supabase/          # Supabase client utilities
│   └── utils.ts           # Utility functions
├── middleware.ts          # Auth middleware
└── supabase-schema.sql    # Database schema
```

## Available Routes

- `/login` - Login page (public)
- `/dashboard` - Main dashboard
- `/dashboard/orders` - All orders list
- `/dashboard/orders/new` - Create new order
- `/dashboard/production` - Production queue
- `/dashboard/follow-up` - Payment follow-ups
- `/dashboard/management/distributors` - Manage distributors
- `/dashboard/management/products` - Manage products
- `/dashboard/rewards` - Rewards management

## Database Schema

The database includes:

- **Enums**: `order_status_enum`, `payment_status_enum`
- **Tables**: `profiles`, `distributors`, `products`, `orders`, `order_items`, `rewards`, `order_log`
- **Features**: Automatic status logging, order total calculation, RLS policies

See `supabase-schema.sql` for complete schema details.

## Security

- All routes except `/login` are protected by middleware
- Row Level Security (RLS) enabled on all tables
- Admin-only access policies
- Automatic session refresh via middleware

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Next Steps

The foundation is set up! Next, you'll want to:

1. Build the Management pages (Distributors & Products Data Tables)
2. Create the New Order form
3. Implement the Orders list with filtering and search
4. Add real data fetching to the Dashboard
5. Build the Production and Follow-up filtered views

## License

Private project - All rights reserved

