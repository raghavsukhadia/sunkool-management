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
      <div className="hidden lg:flex flex-col justify-between bg-zinc-900 p-10 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-zinc-900">
          {/* Abstract Geometric Pattern with Gradient Mesh */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-b from-indigo-500/20 to-transparent rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-t from-purple-500/20 to-transparent rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2"></div>

          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>

          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03]"></div>
        </div>

        <div className="relative z-10">
          <SunkoolLogo variant="light" size="lg" />
        </div>

        <div className="relative z-10 max-w-lg">
          <blockquote className={`space-y-6 transition-all duration-1000 transform ${fade ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="space-y-4">
              <p className="text-3xl font-light leading-tight tracking-tight">
                &ldquo;{QUOTES[currentQuoteIndex].title}&rdquo;
              </p>
              {QUOTES[currentQuoteIndex].subtitle && (
                <p className="text-lg text-zinc-400 font-normal leading-relaxed">
                  {QUOTES[currentQuoteIndex].subtitle}
                </p>
              )}
            </div>
            <footer className="flex items-center gap-4 pt-4 border-t border-white/10">
              <div className="size-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg">
                {QUOTES[currentQuoteIndex].initials}
              </div>
              <div>
                <div className="font-semibold text-lg text-white">Sunkool Management</div>
                <div className="text-sm text-zinc-400">Growth & Efficiency</div>
              </div>
            </footer>
          </blockquote>
        </div>

        <div className="relative z-10 text-sm text-zinc-500 flex justify-between items-center">
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

            <Button type="submit" className="w-full h-11 text-base shadow-sm" disabled={loading}>
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
