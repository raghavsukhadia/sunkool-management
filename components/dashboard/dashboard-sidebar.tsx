"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import {
  Home,
  ShoppingCart,
  Package,
  Factory,
  Truck,
  DollarSign,
  Settings,
  Bell,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav"
import { Button } from "@/components/ui/button"

// ─── Constants ───────────────────────────────────────────────────────────────
const SIDEBAR_EXPANDED  = 240
const SIDEBAR_COLLAPSED = 64
const AUTO_COLLAPSE_MS  = 30_000   // 30 seconds
const LS_KEY            = "sk_sidebar_collapsed"
const EASE              = "cubic-bezier(0.4,0,0.2,1)"

// ─── Nav structure ───────────────────────────────────────────────────────────
const NAV = [
  {
    group: "Main",
    items: [
      { href: "/dashboard",             label: "Dashboard",  icon: Home         },
      { href: "/dashboard/orders",      label: "Orders",     icon: ShoppingCart  },
      { href: "/dashboard/orders/new",  label: "New Order",  icon: Package      },
      { href: "/dashboard/production",  label: "Production", icon: Factory      },
      { href: "/dashboard/follow-up",   label: "Follow Up",  icon: DollarSign   },
      { href: "/dashboard/tracking",    label: "Tracking",   icon: Truck        },
      { href: "/dashboard/customers",   label: "Customers",  icon: Users        },
    ],
  },
  {
    group: "Admin",
    items: [
      { href: "/dashboard/management",    label: "Management",    icon: Settings },
      { href: "/dashboard/notifications", label: "Notifications", icon: Bell     },
    ],
  },
]

function resolveTitle(pathname: string) {
  if (pathname === "/dashboard")                       return "Dashboard"
  if (pathname.startsWith("/dashboard/orders"))        return "Orders"
  if (pathname.startsWith("/dashboard/customers"))     return "Customers"
  if (pathname.startsWith("/dashboard/tracking"))      return "Tracking"
  if (pathname.startsWith("/dashboard/production"))    return "Production"
  if (pathname.startsWith("/dashboard/follow-up"))     return "Follow Up"
  if (pathname.startsWith("/dashboard/notifications")) return "Notifications"
  if (pathname.startsWith("/dashboard/management"))    return "Management"
  return "Order Management"
}

// ─── NavItem ─────────────────────────────────────────────────────────────────
function NavItem({
  href, label, icon: Icon, isActive, collapsed,
}: {
  href: string; label: string
  icon: React.ComponentType<{ className?: string }>
  isActive: boolean; collapsed: boolean
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg transition-all duration-150",
        collapsed ? "mx-2 justify-center px-0 py-2.5" : "mx-2 px-3 py-2.5",
        isActive
          ? "bg-sk-primary text-white shadow-sm"
          : "text-[#94a3b8] hover:bg-white/[0.07] hover:text-white",
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-white/50" />
      )}
      <Icon className={cn(
        "flex-shrink-0",
        collapsed ? "h-[19px] w-[19px]" : "h-[17px] w-[17px]",
        isActive ? "text-white" : "text-[#64748b] group-hover:text-white",
      )} />
      <span className={cn(
        "overflow-hidden whitespace-nowrap text-[13px] font-medium leading-none transition-all duration-[280ms]",
        collapsed ? "w-0 opacity-0" : "w-auto opacity-100",
      )}>
        {label}
      </span>
    </Link>
  )
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────
function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  return (
    <div className={cn(
      "mb-1 mt-5 flex items-center",
      collapsed ? "justify-center px-2" : "px-3",
    )}>
      {collapsed
        ? <div className="h-px w-7 bg-white/[0.07]" />
        : <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#3f4f63]">{label}</span>
      }
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DashboardSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  const [collapsed, setCollapsed] = useState(false)
  const [mounted,   setMounted]   = useState(false)

  // ref so timer callbacks always see latest collapsed value
  const collapsedRef = useRef(collapsed)
  collapsedRef.current = collapsed

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Read persisted preference after mount ──────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY)
    if (stored === "1") setCollapsed(true)
    setMounted(true)
  }, [])

  // ── Auto-collapse helpers ──────────────────────────────────────────────────
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const scheduleCollapse = useCallback(() => {
    clearTimer()
    timerRef.current = setTimeout(() => {
      // Only collapse if currently expanded
      if (!collapsedRef.current) {
        setCollapsed(true)
        localStorage.setItem(LS_KEY, "1")
      }
    }, AUTO_COLLAPSE_MS)
  }, [clearTimer])

  // Start the idle timer once mounted (if sidebar starts expanded)
  useEffect(() => {
    if (mounted && !collapsed) scheduleCollapse()
    return clearTimer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted])

  // ── Manual toggle ──────────────────────────────────────────────────────────
  const toggleCollapsed = () => {
    clearTimer()
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(LS_KEY, next ? "1" : "0")
      // If expanding, restart idle timer
      if (!next) scheduleCollapse()
      return next
    })
  }

  const handleSignOut = async () => {
    clearTimer()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  // Sidebar mouse handlers
  const handleMouseEnter = () => {
    clearTimer()
    // Auto-expand if currently collapsed
    if (collapsedRef.current) {
      setCollapsed(false)
      localStorage.setItem(LS_KEY, "0")
    }
  }
  const handleMouseLeave = () => { scheduleCollapse() }

  const sidebarW = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED

  const todayLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "long", day: "2-digit", month: "short", year: "numeric",
  }).format(new Date())

  return (
    <div className="min-h-screen bg-sk-page-bg">

      {/* ── Desktop Sidebar ───────────────────────────────────────────────── */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="fixed inset-y-0 left-0 z-50 hidden h-full flex-col lg:flex"
        style={{
          width: mounted ? sidebarW : SIDEBAR_EXPANDED,
          transition: `width 280ms ${EASE}`,
          background: "linear-gradient(180deg, #0b1120 0%, #0f172a 60%, #111827 100%)",
          borderRight: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div className="flex h-full flex-col overflow-hidden">

          {/* ── Logo area ─────────────────────────────────────────────────── */}
          <div
            className="relative flex shrink-0 items-center justify-center border-b"
            style={{ borderColor: "rgba(255,255,255,0.06)", minHeight: 76, padding: "12px 10px" }}
          >
            <Link href="/dashboard" className="flex items-center justify-center">
              {/* Full logo — visible when expanded */}
              <div
                className={cn(
                  "flex items-center justify-center transition-all duration-[280ms]",
                  collapsed ? "w-0 overflow-hidden opacity-0" : "opacity-100",
                )}
                style={{ width: collapsed ? 0 : 160 }}
              >
                <Image
                  src="/images/logo.png"
                  alt="Sunkool"
                  width={150}
                  height={48}
                  priority
                  className="h-auto w-full object-contain"
                />
              </div>

              {/* Icon logo — visible when collapsed */}
              <div
                className={cn(
                  "flex items-center justify-center transition-all duration-[280ms]",
                  collapsed ? "opacity-100" : "w-0 overflow-hidden opacity-0",
                )}
                style={{ width: collapsed ? 36 : 0 }}
              >
                <Image
                  src="/images/logo-icon.png"
                  alt="SK"
                  width={36}
                  height={36}
                  priority
                  className="h-auto w-full object-contain"
                />
              </div>
            </Link>

            {/* ── Collapse toggle button (on the right border edge) ── */}
            <button
              onClick={toggleCollapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="absolute -right-3 top-1/2 z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-[#1e293b] bg-[#0f172a] text-[#475569] shadow-lg transition-all duration-150 hover:border-sk-primary hover:bg-sk-primary hover:text-white"
            >
              {collapsed
                ? <ChevronRight className="h-3.5 w-3.5" />
                : <ChevronLeft  className="h-3.5 w-3.5" />
              }
            </button>
          </div>

          {/* ── Auto-collapse countdown hint (thin progress bar) ─────────── */}
          {!collapsed && mounted && (
            <div className="h-[2px] w-full overflow-hidden bg-transparent">
              <div
                key={`bar-${collapsed}`}
                className="h-full bg-sk-primary/30"
                style={{
                  animation: `shrink ${AUTO_COLLAPSE_MS}ms linear forwards`,
                }}
              />
            </div>
          )}

          {/* ── Navigation ────────────────────────────────────────────────── */}
          <nav
            className="flex-1 overflow-y-auto overflow-x-hidden py-2"
            style={{ scrollbarWidth: "none" }}
          >
            {NAV.map((section) => (
              <div key={section.group}>
                <SectionLabel label={section.group} collapsed={collapsed} />
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/dashboard" && pathname.startsWith(item.href))
                    return (
                      <NavItem
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        icon={item.icon}
                        isActive={isActive}
                        collapsed={collapsed}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* ── Sign out ──────────────────────────────────────────────────── */}
          <div className="shrink-0 border-t p-2" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <button
              onClick={handleSignOut}
              title={collapsed ? "Sign Out" : undefined}
              className={cn(
                "group flex w-full items-center gap-3 rounded-lg py-2.5 text-[13px] font-medium text-[#475569] transition-all duration-150 hover:bg-white/[0.06] hover:text-[#f87171]",
                collapsed ? "justify-center px-0" : "px-3",
              )}
            >
              <LogOut className="h-[17px] w-[17px] flex-shrink-0 group-hover:text-[#f87171]" />
              <span className={cn(
                "overflow-hidden whitespace-nowrap transition-all duration-[280ms]",
                collapsed ? "w-0 opacity-0" : "w-auto opacity-100",
              )}>
                Sign Out
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Content area (shifts in sync with sidebar) ───────────────────── */}
      <div
        className="flex min-h-screen min-w-0 flex-col"
        style={{
          paddingLeft: mounted ? sidebarW : SIDEBAR_EXPANDED,
          transition: `padding-left 280ms ${EASE}`,
        }}
      >
        {/* ── Top bar ───────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-30 border-b border-sk-border bg-white/95 backdrop-blur-sm">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="min-w-0">
              <h1 className="truncate text-[18px] font-semibold text-sk-text-1">
                {resolveTitle(pathname)}
              </h1>
              <p className="text-[11px] font-medium text-sk-text-3" suppressHydrationWarning>
                {todayLabel}
              </p>
            </div>
            <Link href="/dashboard/orders/new">
              <Button className="h-9 gap-2 bg-sk-primary px-4 text-[13px] font-medium text-white hover:bg-sk-primary-dk">
                <Plus className="h-4 w-4" />
                New Order
              </Button>
            </Link>
          </div>
        </header>

        {/* ── Page ─────────────────────────────────────────────────────── */}
        <main className="flex-1 bg-sk-page-bg pb-20 lg:pb-0">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      <MobileBottomNav />

      {/* ── Keyframe for countdown bar ───────────────────────────────────── */}
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  )
}
