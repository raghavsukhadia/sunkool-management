"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
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
  Layers,
  BarChart3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav"
import { Button } from "@/components/ui/button"

// ─── Constants ───────────────────────────────────────────────────────────────
const SIDEBAR_EXPANDED  = 240
const SIDEBAR_COLLAPSED = 64
const LS_KEY            = "sk_sidebar_collapsed"
const EASE              = "cubic-bezier(0.4,0,0.2,1)"

// ─── Nav structure ───────────────────────────────────────────────────────────
const NAV = [
  {
    group: "Main",
    items: [
      { href: "/dashboard",            label: "Dashboard",  icon: Home         },
      { href: "/dashboard/orders",     label: "Orders",     icon: ShoppingCart },
      { href: "/dashboard/production", label: "Production", icon: Factory      },
      { href: "/dashboard/follow-up",  label: "Follow Up",  icon: DollarSign   },
      { href: "/dashboard/tracking",   label: "Tracking",   icon: Truck        },
      { href: "/dashboard/customers",  label: "Customers",  icon: Users        },
      { href: "/dashboard/items",      label: "Items",      icon: Layers       },
      { href: "/dashboard/reports",    label: "Reports",    icon: BarChart3    },
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
  if (pathname.startsWith("/dashboard/items"))         return "Items"
  if (pathname.startsWith("/dashboard/reports"))       return "Reports"
  return "Order Management"
}

// ─── NavItem ─────────────────────────────────────────────────────────────────
function NavItem({
  href, label, icon: Icon, isActive, collapsed,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  isActive: boolean
  collapsed: boolean
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg transition-all duration-150",
        collapsed ? "mx-2 justify-center px-0 py-2.5" : "mx-2 px-3 py-2.5",
        isActive
          ? "bg-white/[0.10] text-white"
          : "text-[#64748b] hover:bg-white/[0.06] hover:text-[#cbd5e1]",
      )}
    >
      {/* Left accent bar */}
      {isActive && (
        <span className="absolute left-0 top-1/2 h-[60%] w-[3px] -translate-y-1/2 rounded-r-full bg-sk-primary" />
      )}

      <Icon className={cn(
        "flex-shrink-0 transition-colors duration-150",
        collapsed ? "h-[18px] w-[18px]" : "h-[16px] w-[16px]",
        isActive ? "text-sk-primary" : "text-[#475569] group-hover:text-[#94a3b8]",
      )} />

      <span className={cn(
        "overflow-hidden whitespace-nowrap text-[13px] font-medium leading-none transition-all duration-300",
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
      "mb-1 mt-5 flex items-center gap-2 px-4",
      collapsed ? "justify-center px-2" : "",
    )}>
      {collapsed
        ? <div className="h-px w-5 bg-white/[0.08]" />
        : (
          <>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#2d3a4a]">{label}</span>
            <div className="flex-1 border-t border-white/[0.05]" />
          </>
        )
      }
    </div>
  )
}

// ─── UserFooter ──────────────────────────────────────────────────────────────
function UserFooter({
  email,
  collapsed,
  onSignOut,
}: {
  email: string
  collapsed: boolean
  onSignOut: () => void
}) {
  const initials = email
    ? email.split("@")[0].split(/[._-]/).map(p => p[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "U"
    : "U"
  const displayName = email ? email.split("@")[0].replace(/[._-]/g, " ") : "User"

  return (
    <div
      className="shrink-0 border-t p-2"
      style={{ borderColor: "rgba(255,255,255,0.06)" }}
    >
      {collapsed ? (
        <button
          onClick={onSignOut}
          title="Sign Out"
          className="flex w-full items-center justify-center rounded-lg py-2 text-[#475569] transition-all duration-150 hover:bg-white/[0.06] hover:text-[#f87171]"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sk-primary/20 text-[11px] font-bold text-sk-primary">
            {initials}
          </div>
        </button>
      ) : (
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          {/* Avatar */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sk-primary/20 text-[11px] font-bold text-sk-primary">
            {initials}
          </div>

          {/* Name + email */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold capitalize text-[#cbd5e1]">{displayName}</p>
            <p className="truncate text-[10px] text-[#334155]">{email}</p>
          </div>

          {/* Sign out icon */}
          <button
            onClick={onSignOut}
            title="Sign Out"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#334155] transition-all duration-150 hover:bg-white/[0.06] hover:text-[#f87171]"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DashboardSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const auth = supabase.auth

  const [collapsed, setCollapsed] = useState(false)
  const [mounted,   setMounted]   = useState(false)
  const [userEmail, setUserEmail] = useState("")

  const collapsedRef = useRef(collapsed)
  collapsedRef.current = collapsed

  // ── Read persisted preference + current user after mount ──────────────────
  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY)
    if (stored === "1") setCollapsed(true)
    setMounted(true)

    auth.getUser().then(({ data }) => {
      if (data?.user?.email) setUserEmail(data.user.email)
    })
  }, [auth])

  // ── Manual toggle ──────────────────────────────────────────────────────────
  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(LS_KEY, next ? "1" : "0")
      return next
    })
  }

  const handleSignOut = async () => {
    await auth.signOut()
    router.push("/login")
    router.refresh()
  }

  // Sidebar hover: expand on enter, collapse on leave
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    if (collapsedRef.current) {
      setCollapsed(false)
      localStorage.setItem(LS_KEY, "0")
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    hoverTimer.current = setTimeout(() => {
      if (!collapsedRef.current) {
        setCollapsed(true)
        localStorage.setItem(LS_KEY, "1")
      }
    }, 600)
  }, [])

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
          background: "linear-gradient(180deg, #080e1a 0%, #0c1526 55%, #0f1b30 100%)",
          borderRight: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div className="flex h-full flex-col overflow-hidden">

          {/* ── Logo area ─────────────────────────────────────────────────── */}
          <div
            className="relative flex shrink-0 items-center justify-center border-b"
            style={{ borderColor: "rgba(255,255,255,0.05)", minHeight: 72, padding: "10px 10px" }}
          >
            <Link href="/dashboard" className="flex items-center justify-center">
              {/* Full logo */}
              <div
                className={cn(
                  "flex items-center justify-center transition-all duration-300",
                  collapsed ? "w-0 overflow-hidden opacity-0" : "opacity-100",
                )}
                style={{ width: collapsed ? 0 : 152 }}
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

              {/* Icon logo */}
              <div
                className={cn(
                  "flex items-center justify-center transition-all duration-300",
                  collapsed ? "opacity-100" : "w-0 overflow-hidden opacity-0",
                )}
                style={{ width: collapsed ? 34 : 0 }}
              >
                <Image
                  src="/images/logo-icon.png"
                  alt="SK"
                  width={34}
                  height={34}
                  priority
                  className="h-auto w-full object-contain"
                />
              </div>
            </Link>

            {/* Collapse toggle */}
            <button
              onClick={toggleCollapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="absolute -right-3 top-1/2 z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-[#1a2740] bg-[#0c1526] text-[#334155] shadow-md transition-all duration-150 hover:border-sk-primary/50 hover:bg-sk-primary hover:text-white"
            >
              {collapsed
                ? <ChevronRight className="h-3.5 w-3.5" />
                : <ChevronLeft  className="h-3.5 w-3.5" />
              }
            </button>
          </div>

          {/* ── Tagline below logo ────────────────────────────────────────── */}
          <div
            className={cn(
              "overflow-hidden text-center transition-all duration-300",
              collapsed ? "max-h-0 opacity-0 py-0" : "max-h-8 opacity-100 py-1.5",
            )}
          >
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[#475569]">
              Order Management System
            </span>
          </div>

          {/* ── Thin accent line below tagline ────────────────────────────── */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-sk-primary/30 to-transparent" />

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

          {/* ── User footer ───────────────────────────────────────────────── */}
          <UserFooter
            email={userEmail}
            collapsed={collapsed}
            onSignOut={handleSignOut}
          />
        </div>
      </aside>

      {/* ── Content area ─────────────────────────────────────────────────── */}
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
    </div>
  )
}
