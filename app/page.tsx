import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Car,
  ClipboardCheck,
  Factory,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import SunkoolLogo from '@/components/brand/SunkoolLogo'

const modules = [
  {
    title: 'Sales To Build',
    description: 'Capture dealer orders, validate quantities, and push approved jobs to production in one flow.',
    icon: ClipboardCheck,
  },
  {
    title: 'Product Catalog',
    description: 'Manage car-care SKUs, packaging variants, and active inventory relationships.',
    icon: Boxes,
  },
  {
    title: 'Production Control',
    description: 'Generate production records, monitor completion, and keep dispatch readiness visible.',
    icon: Factory,
  },
  {
    title: 'Dispatch Tracking',
    description: 'Handle partial/full dispatches with courier assignment, shipment status, and references.',
    icon: Truck,
  },
]

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_500px_at_70%_-20%,rgba(251,146,60,0.16),transparent),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center gap-6 px-4 md:px-8">
          <SunkoolLogo size="md" />

          <nav className="ml-auto hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <Link href="#modules" className="hover:text-slate-900 transition-colors">
              Modules
            </Link>
            <Link href="#workflow" className="hover:text-slate-900 transition-colors">
              Workflow
            </Link>
            <Link href="#insights" className="hover:text-slate-900 transition-colors">
              Insights
            </Link>
          </nav>

          <Link href={user ? '/dashboard' : '/login'}>
            <Button className="rounded-full bg-slate-900 px-6 text-white hover:bg-slate-800">
              {user ? 'Open Dashboard' : 'Sign In'} <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-7xl gap-10 px-4 pb-16 pt-16 md:grid-cols-2 md:items-center md:px-8 md:pt-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
              <Car className="h-3.5 w-3.5" />
              Automotive OMS Platform
            </div>

            <h1 className="mt-5 text-4xl font-black leading-tight text-slate-950 md:text-6xl">
              Run Your Car Product Operations Without The Chaos.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 md:text-lg">
              Sunkool OMS connects order intake, production, dispatch, and payment tracking for your auto-product business.
              Your team gets one shared operating view instead of scattered sheets and calls.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={user ? '/dashboard/orders' : '/login'}>
                <Button size="lg" className="w-full rounded-xl bg-amber-500 px-7 text-slate-950 hover:bg-amber-400 sm:w-auto">
                  Start Managing Orders <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="#modules">
                <Button size="lg" variant="outline" className="w-full rounded-xl border-slate-300 bg-white sm:w-auto">
                  Explore Modules
                </Button>
              </Link>
            </div>

            <div id="insights" className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Orders</p>
                <p className="mt-1 text-2xl font-bold">24/7</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Dispatch View</p>
                <p className="mt-1 text-2xl font-bold">Live</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Audit Trail</p>
                <p className="mt-1 text-2xl font-bold">100%</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-amber-300/40 via-orange-300/20 to-transparent blur-2xl" />

            <div className="relative overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_25px_80px_rgba(15,23,42,0.12)]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Operations Board</p>
                  <p className="text-lg font-bold">Today&apos;s Flow</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Stable</span>
              </div>

              <div className="mt-5 space-y-4">
                {[
                  ['Orders Approved', '42', 'bg-blue-500'],
                  ['In Production', '17', 'bg-amber-500'],
                  ['Ready To Dispatch', '11', 'bg-emerald-500'],
                ].map(([label, value, color]) => (
                  <div key={label} className="rounded-xl border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-700">{label}</p>
                      <p className="text-sm font-bold text-slate-900">{value}</p>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className={`h-2 rounded-full ${color}`} style={{ width: label === 'Orders Approved' ? '82%' : label === 'In Production' ? '55%' : '43%' }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <BarChart3 className="h-4 w-4 text-amber-600" />
                  Dispatch Performance
                </div>
                <p className="mt-1 text-xs text-slate-600">On-time delivery improved by 18% after workflow standardization.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="modules" className="mx-auto w-full max-w-7xl px-4 py-16 md:px-8">
          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Core Modules</p>
              <h2 className="mt-2 text-3xl font-black text-slate-950 md:text-4xl">Built for Automotive Product Teams</h2>
            </div>
            <div className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 md:block">
              One platform. Clear ownership.
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {modules.map((module) => (
              <article
                key={module.title}
                className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="inline-flex rounded-2xl bg-slate-900 p-3 text-white">
                  <module.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-xl font-bold text-slate-950">{module.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{module.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" className="border-y border-slate-200 bg-white/70">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 md:px-8">
            <h2 className="text-3xl font-black text-slate-950 md:text-4xl">How Your Team Moves Work</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-4">
              {[
                ['1. Intake', 'Capture order + assign customer + validate item list.'],
                ['2. Produce', 'Generate production records and track completion.'],
                ['3. Dispatch', 'Create partial or full dispatch with courier details.'],
                ['4. Collect', 'Record payments and close the order trail.'],
              ].map(([title, text]) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-bold text-slate-900">{title}</p>
                  <p className="mt-2 text-sm text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-16 md:px-8">
          <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-8 text-white md:p-12">
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
              <div>
                <h2 className="text-3xl font-black leading-tight md:text-4xl">Give your OMS a serious front door.</h2>
                <p className="mt-3 text-slate-300">
                  Designed for car-product operations where every missed dispatch or untracked payment costs real money.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
                <Link href={user ? '/dashboard' : '/login'}>
                  <Button size="lg" className="w-full rounded-xl bg-amber-500 px-8 text-slate-950 hover:bg-amber-400 sm:w-auto">
                    {user ? 'Go To Dashboard' : 'Sign In To Continue'}
                  </Button>
                </Link>
                <Link href="/dashboard/orders">
                  <Button size="lg" variant="outline" className="w-full rounded-xl border-slate-600 bg-transparent text-white hover:bg-slate-900 sm:w-auto">
                    View Orders
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-slate-300">
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Secure role-based access</span>
              <span className="inline-flex items-center gap-2"><Factory className="h-4 w-4 text-amber-400" /> Production linked to dispatch</span>
              <span className="inline-flex items-center gap-2"><Truck className="h-4 w-4 text-blue-400" /> Real shipment status tracking</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
