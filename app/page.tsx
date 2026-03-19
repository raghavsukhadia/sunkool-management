import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  DollarSign,
  Factory,
  Package,
  ShieldCheck,
  Truck,
  Users,
} from 'lucide-react'
import SunkoolLogo from '@/components/brand/SunkoolLogo'

const features = [
  {
    title: 'Orders',
    description: 'Create orders with automatic SK numbering, add items, and track status from New Order through In Progress, Ready for Dispatch, Invoiced, In Transit, and Delivered—or Void when needed.',
    icon: Package,
    accent: 'amber',
  },
  {
    title: 'Production',
    description: 'Production queue with item-wise visibility. Create production records, generate PDF checklists, and track completion by order and item.',
    icon: Factory,
    accent: 'blue',
  },
  {
    title: 'Shipment & dispatch',
    description: 'Full and partial dispatch with courier and tracking. Shipment status: Ready → Picked up → Delivered. Return dispatches supported.',
    icon: Truck,
    accent: 'slate',
  },
  {
    title: 'Payments',
    description: 'Record payments, set requested amount and invoice number. Payment follow-ups for cash discount orders so nothing slips.',
    icon: DollarSign,
    accent: 'blue',
  },
  {
    title: 'Notifications',
    description: 'WhatsApp alerts when a production record is created—order number, customer, items, and link to the order in the system.',
    icon: Bell,
    accent: 'amber',
  },
  {
    title: 'Management',
    description: 'Customers, inventory and products, courier companies. Rewards and distributor points for performance.',
    icon: Users,
    accent: 'slate',
  },
]

const workflowSteps = [
  ['1. New order', 'Create order, add customer and items. Status: New Order.'],
  ['2. Produce', 'Create production record; status moves to In Progress. WhatsApp can notify your team with order and item details.'],
  ['3. Dispatch', 'Create dispatch (Ready for Dispatch). Set shipment to Picked up (In Transit), then Delivered when confirmed.'],
  ['4. Invoice & collect', 'Set invoice number (Invoiced), record payments, and use follow-ups for outstanding amounts.'],
]

const benefits = [
  'Single source of truth for order status',
  'Production and dispatch linked so nothing slips',
  'Payment follow-ups and WhatsApp alerts keep the team in sync',
]

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_500px_at_70%_-20%,rgba(251,146,60,0.16),transparent),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 md:h-20 w-full max-w-7xl items-center gap-4 md:gap-6 px-4 md:px-8">
          <SunkoolLogo size="md" />

          <nav className="ml-auto hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <Link href="#features" className="hover:text-slate-900 transition-colors">
              Features
            </Link>
            <Link href="#workflow" className="hover:text-slate-900 transition-colors">
              How it works
            </Link>
            <Link href="#cta" className="hover:text-slate-900 transition-colors">
              Get started
            </Link>
          </nav>

          <Link href={user ? '/dashboard' : '/login'}>
            <Button className="min-h-[44px] rounded-full bg-slate-900 px-5 md:px-6 text-white hover:bg-slate-800 text-base">
              {user ? 'Open Dashboard' : 'Sign In'} <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-7xl gap-10 px-4 pb-16 pt-16 md:grid-cols-2 md:items-center md:px-8 md:pt-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
              <Package className="h-3.5 w-3.5" />
              Order Management System
            </div>

            <h1 className="mt-5 text-4xl font-black leading-tight text-slate-950 md:text-6xl">
              Order, produce, dispatch, and get paid — in one place.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 md:text-lg">
              Sunkool OMS gives you one system for the full cycle: SK order numbers, production records and PDF checklists,
              dispatch and shipment status (Ready, Picked up, Delivered), invoicing, payment tracking and follow-ups, and WhatsApp alerts when production starts.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={user ? '/dashboard/orders' : '/login'} className="w-full sm:w-auto">
                <Button size="lg" className="w-full min-h-[44px] rounded-xl bg-amber-500 px-7 text-slate-950 hover:bg-amber-400 sm:w-auto">
                  Start Managing Orders <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="#features" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full min-h-[44px] rounded-xl border-slate-300 bg-white sm:w-auto">
                  Explore features
                </Button>
              </Link>
            </div>

            <div id="benefits" className="mt-8 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
              {benefits.map((text) => (
                <div key={text} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-slate-700">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-amber-300/40 via-orange-300/20 to-transparent blur-2xl" />

            <div className="relative overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_25px_80px_rgba(15,23,42,0.12)]">
              <div className="border-b border-slate-100 pb-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">What you get</p>
                <p className="text-lg font-bold text-slate-950">At a glance</p>
              </div>

              <ul className="mt-5 space-y-4">
                {[
                  'Order status from New Order to Delivered (or Void)',
                  'Production queue and PDF checklists',
                  'Dispatch and shipment status: Ready → Picked up → Delivered',
                  'Payment follow-ups and WhatsApp alerts',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
                    <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-amber-500" />
                    <span className="text-sm text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-7xl px-4 py-16 md:px-8">
          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Core features</p>
              <h2 className="mt-2 text-3xl font-black text-slate-950 md:text-4xl">Everything you need to run orders and delivery</h2>
            </div>
            <div className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 md:block">
              One platform. Clear ownership.
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div
                  className={`inline-flex rounded-2xl p-3 ${
                    feature.accent === 'amber'
                      ? 'bg-amber-500 text-slate-950'
                      : feature.accent === 'blue'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-900 text-white'
                  }`}
                >
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-xl font-bold text-slate-950">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" className="border-y border-slate-200 bg-white/70">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 md:px-8">
            <h2 className="text-3xl font-black text-slate-950 md:text-4xl">How it works</h2>
            <p className="mt-2 text-slate-600">Order lifecycle from creation to delivery and payment.</p>
            <div className="mt-8 grid gap-4 md:grid-cols-4">
              {workflowSteps.map(([title, text]) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-bold text-slate-900">{title}</p>
                  <p className="mt-2 text-sm text-slate-600">{text}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-500">Void cancels an order at any time.</p>
          </div>
        </section>

        <section id="cta" className="mx-auto w-full max-w-7xl px-4 py-16 md:px-8">
          <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-8 text-white md:p-12">
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
              <div>
                <h2 className="text-3xl font-black leading-tight md:text-4xl">Run your order and delivery operations in one place</h2>
                <p className="mt-3 text-slate-300">
                  For teams that need clear order visibility, production checklists, and payment tracking—without spreadsheets or missed dispatches.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
                <Link href={user ? '/dashboard' : '/login'}>
                  <Button size="lg" className="w-full min-h-[44px] rounded-xl bg-amber-500 px-8 text-slate-950 hover:bg-amber-400 sm:w-auto">
                    {user ? 'Go To Dashboard' : 'Sign In To Continue'}
                  </Button>
                </Link>
                <Link href="/dashboard/orders">
                  <Button size="lg" variant="outline" className="w-full min-h-[44px] rounded-xl border-slate-600 bg-transparent text-white hover:bg-slate-900 sm:w-auto">
                    View Orders
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-slate-300">
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Secure role-based access</span>
              <span className="inline-flex items-center gap-2"><Factory className="h-4 w-4 text-amber-400" /> Production linked to dispatch</span>
              <span className="inline-flex items-center gap-2"><Truck className="h-4 w-4 text-blue-400" /> Shipment status: Ready → Picked up → Delivered</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
