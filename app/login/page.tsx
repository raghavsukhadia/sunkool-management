"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Mail, Lock } from 'lucide-react'
import Link from 'next/link'
import SunkoolLogo from '@/components/brand/SunkoolLogo'

const QUOTES = [
  {
    title: "Winners focus on selling. Systems handle the rest.",
    subtitle: "Let your OMS manage operations while you grow revenue.",
    initials: "WF"
  },
  {
    title: "Stop managing work. Start multiplying sales.",
    subtitle: "Smart systems take care of operations so you can scale faster.",
    initials: "SM"
  },
  {
    title: "Operations should support growth, not consume it.",
    subtitle: "With the right OMS, you focus on customers — not chaos.",
    initials: "OS"
  },
  {
    title: "Revenue grows when operations run on autopilot.",
    subtitle: "Scale your business with ease.",
    initials: "RG"
  }
]

const HERO_POINTS = ["Order-to-dispatch tracking", "Production-ready workflows", "Multi-user operations"]

export const dynamic = "force-dynamic"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0)
  const [fade, setFade] = useState(true)
  const router = useRouter()
  const supabaseRef = useRef<any>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setCurrentQuoteIndex((prev) => (prev + 1) % QUOTES.length)
        setFade(true)
      }, 500)
    }, 6000)
    return () => clearInterval(interval)
  }, [])

  const getSupabase = () => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient()
    }
    return supabaseRef.current
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = getSupabase()
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (data.user) {
        router.push("/dashboard")
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during login")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Side - Hero/Background */}
      <div className="hidden lg:flex flex-col justify-between bg-[#060b1b] p-10 text-white relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.16),transparent_42%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(15,23,42,0.9),rgba(2,6,23,0.96))]" />
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.06]" />
        </div>

        <div className="relative z-10 rounded-2xl border border-white/15 bg-white/5 px-6 py-5 backdrop-blur-sm">
          <SunkoolLogo variant="light" size="lg" />
          <p className="mt-4 text-xs tracking-[0.28em] text-slate-300/90">ORDER MANAGEMENT SYSTEM</p>
        </div>

        <div className="relative z-10 max-w-xl space-y-8">
          <blockquote className={`space-y-6 transition-all duration-700 transform ${fade ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
            <div className="space-y-4">
              <p className="text-3xl font-medium leading-tight tracking-tight text-white/95">
                &ldquo;{QUOTES[currentQuoteIndex].title}&rdquo;
              </p>
              {QUOTES[currentQuoteIndex].subtitle && (
                <p className="text-base text-slate-300 font-normal leading-relaxed">
                  {QUOTES[currentQuoteIndex].subtitle}
                </p>
              )}
            </div>
            <footer className="flex items-center gap-4 pt-4 border-t border-white/15">
              <div className="size-11 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-700/30">
                {QUOTES[currentQuoteIndex].initials}
              </div>
              <div>
                <div className="font-semibold text-base text-white">Sunkool Management</div>
                <div className="text-sm text-slate-400">Growth-focused operations workspace</div>
              </div>
            </footer>
          </blockquote>

          <div className="grid grid-cols-1 gap-3">
            {HERO_POINTS.map((point) => (
              <div key={point} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200/95">
                {point}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-sm text-slate-400 flex justify-between items-center">
          <span>© {new Date().getFullYear()} Sunkool Management Inc.</span>
          <div className="flex gap-4">
            <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms</Link>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex items-center justify-center p-8 bg-background relative">
        <div className="mx-auto w-full max-w-[400px] space-y-8">
          <div className="flex flex-col space-y-2 text-center">
            <div className="lg:hidden flex justify-center mb-6">
              <SunkoolLogo size="lg" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Sign in to your account
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to access the dashboard
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="pl-9 h-11"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-primary font-medium hover:underline"
                  >
                    Forgot?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pl-9 h-11"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md flex items-center gap-2 border border-destructive/20">
                <div className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full min-h-[44px] h-11 text-base shadow-sm" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
