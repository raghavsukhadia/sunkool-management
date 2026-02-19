import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ArrowRight, BarChart3, ShieldCheck, Zap, ArrowUpRight } from 'lucide-react'
import SunkoolLogo from '@/components/brand/SunkoolLogo'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex flex-col min-h-screen bg-background selection:bg-primary/10">
      {/* Navigation */}
      <header className="px-4 lg:px-8 h-20 flex items-center border-b bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <SunkoolLogo size="md" />
        </div>
        <nav className="ml-auto flex items-center gap-4 sm:gap-8">
          <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
            Features
          </Link>
          {user ? (
            <Link href="/dashboard">
              <Button className="rounded-full px-6 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95">
                Dashboard
              </Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button className="rounded-full px-6 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95">
                Sign In <ArrowUpRight className="ml-2 size-4" />
              </Button>
            </Link>
          )}
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative w-full py-20 md:py-32 lg:py-48 overflow-hidden bg-zinc-950 text-white">
          {/* Background Mesh Gradients */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse delay-700"></div>
          </div>

          <div className="container relative z-10 px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center space-y-8 text-center max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm font-medium backdrop-blur-sm animate-in fade-in slide-in-from-bottom-3 duration-1000">
                <span className="flex size-2 rounded-full bg-indigo-500 animate-pulse"></span>
                Next-Gen Order Management
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl/none animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-150">
                  Efficient Operations for <br className="hidden md:inline" />
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-white to-purple-400">
                    Modern Business
                  </span>
                </h1>
                <p className="mx-auto max-w-[700px] text-zinc-400 md:text-xl/relaxed lg:text-2xl/relaxed animate-in fade-in slide-in-from-bottom-5 duration-1000 delay-300">
                  Streamline your workflow, track inventory in real-time, and boost productivity with our state-of-the-art management solution.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-500">
                <Link href={user ? "/dashboard" : "/login"}>
                  <Button size="lg" className="h-14 px-10 text-lg rounded-full shadow-2xl shadow-indigo-600/20 hover:shadow-indigo-600/40 hover:-translate-y-1 transition-all">
                    Start Managing Now <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="#features">
                  <Button variant="outline" size="lg" className="h-14 px-10 text-lg rounded-full border-white/10 hover:bg-white/5 bg-transparent backdrop-blur-sm transition-all hover:-translate-y-1">
                    See Features
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Abstract Grid Decor */}
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.05] pointer-events-none"></div>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full py-24 md:py-32 bg-white relative">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">Built for Growth</h2>
              <p className="text-muted-foreground text-lg max-w-[600px]">
                Everything you need to scale your operations without the overhead of complex systems.
              </p>
            </div>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <div className="group flex flex-col items-center space-y-4 text-center p-8 rounded-3xl border border-transparent bg-slate-50 hover:bg-white hover:border-slate-100 hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] transition-all duration-500">
                <div className="p-4 bg-indigo-50 rounded-2xl group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                  <Zap className="h-8 w-8 text-indigo-600 group-hover:text-white" />
                </div>
                <h3 className="text-2xl font-bold">Real-time Processing</h3>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Instant updates on orders, inventory, and status changes across your entire organization.
                </p>
              </div>

              <div className="group flex flex-col items-center space-y-4 text-center p-8 rounded-3xl border border-transparent bg-slate-50 hover:bg-white hover:border-slate-100 hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] transition-all duration-500">
                <div className="p-4 bg-purple-50 rounded-2xl group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all duration-500">
                  <BarChart3 className="h-8 w-8 text-purple-600 group-hover:text-white" />
                </div>
                <h3 className="text-2xl font-bold">Advanced Analytics</h3>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Gain insights into your business performance with detailed reports and visualizations.
                </p>
              </div>

              <div className="group flex flex-col items-center space-y-4 text-center p-8 rounded-3xl border border-transparent bg-slate-50 hover:bg-white hover:border-slate-100 hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] transition-all duration-500">
                <div className="p-4 bg-emerald-50 rounded-2xl group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500">
                  <ShieldCheck className="h-8 w-8 text-emerald-600 group-hover:text-white" />
                </div>
                <h3 className="text-2xl font-bold">Secure & Reliable</h3>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Your data is protected with enterprise-grade security and automated daily backups.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t bg-slate-50/50">
        <div className="container px-4 md:px-6 mx-auto flex flex-col gap-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <SunkoolLogo size="md" />
            <nav className="flex gap-8">
              <Link className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" href="#">
                Terms
              </Link>
              <Link className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" href="#">
                Privacy
              </Link>
              <Link className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" href="#">
                Twitter
              </Link>
            </nav>
          </div>
          <div className="border-t pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Sunkool Management Inc. All rights reserved.
            </p>
            <div className="text-sm text-zinc-400">
              Built for speed and scale.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

