"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Package,
  ShoppingCart,
  Factory,
  Truck,
  DollarSign,
  Settings,
  LogOut,
  Home,
  Bell,
  Users
} from "lucide-react"
import { cn } from "@/lib/utils"
import SunkoolLogo from "@/components/brand/SunkoolLogo"
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav"

export default function DashboardSidebar({
  children,
}: {
  children: React.ReactNode
}) {
  const desktopSidebarWidth = 220
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const mainNavItems = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/dashboard/orders", label: "Orders", icon: ShoppingCart },
    { href: "/dashboard/orders/new", label: "New Orders", icon: Package },
    { href: "/dashboard/production", label: "Production", icon: Factory },
  ]

  const settingsNavItems = [
    { href: "/dashboard/management", label: "Management", icon: Settings },
    { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  ]

  const additionalNavItems = [
    { href: "/dashboard/follow-up", label: "Follow Up", icon: DollarSign },
    { href: "/dashboard/tracking", label: "Tracking", icon: Truck },
    { href: "/dashboard/customers", label: "Customers", icon: Users },
  ]

  const topbarTitle = (() => {
    if (pathname === "/dashboard") return "Dashboard"
    if (pathname.startsWith("/dashboard/orders")) return "Orders"
    if (pathname.startsWith("/dashboard/customers")) return "Customers"
    if (pathname.startsWith("/dashboard/tracking")) return "Tracking"
    if (pathname.startsWith("/dashboard/production")) return "Production"
    if (pathname.startsWith("/dashboard/follow-up")) return "Follow Up"
    if (pathname.startsWith("/dashboard/notifications")) return "Notifications"
    if (pathname.startsWith("/dashboard/management")) return "Management"
    return "Order Management"
  })()

  const todayLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date())

  return (
    <div className="min-h-screen bg-sk-page-bg">
      <aside
        className="fixed inset-y-0 left-0 z-50 hidden h-full shrink-0 flex-col bg-sk-sidebar lg:flex lg:min-w-[220px] lg:max-w-[220px] lg:basis-[220px]"
        style={{ width: `${desktopSidebarWidth}px`, minWidth: `${desktopSidebarWidth}px`, maxWidth: `${desktopSidebarWidth}px` }}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-[#2d3748] px-4 py-5">
            <Link href="/dashboard" className="block">
              <SunkoolLogo size="md" />
              <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.1em] text-[#4b5563]">
                Order Management
              </p>
            </Link>
          </div>

          <nav className="custom-scrollbar flex-1 overflow-y-auto py-5">
            <p className="px-4 text-[9px] font-medium uppercase tracking-[0.1em] text-[#4b5563]">Main</p>
            <div className="mt-2 space-y-1">
              {mainNavItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href))

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "mx-[10px] my-[2px] flex items-center gap-2.5 rounded-[8px] px-4 py-[10px] text-[14px] font-medium",
                      isActive
                        ? "bg-sk-primary text-sk-sidebar-act"
                        : "text-sk-sidebar-text hover:bg-[rgba(249,115,22,0.1)] hover:text-sk-primary"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {item.label}
                  </Link>
                )
              })}
            </div>

            <div className="mt-5 border-t border-[#2d3748] pt-4">
              <p className="px-4 text-[9px] font-medium uppercase tracking-[0.1em] text-[#4b5563]">Settings</p>
            </div>

            <div className="mt-2 space-y-1">
              {settingsNavItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "mx-[10px] my-[2px] flex items-center gap-2.5 rounded-[8px] px-4 py-[10px] text-[14px] font-medium",
                    isActive
                      ? "bg-sk-primary text-sk-sidebar-act"
                      : "text-sk-sidebar-text hover:bg-[rgba(249,115,22,0.1)] hover:text-sk-primary"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {item.label}
                </Link>
              )
              })}
            </div>

            <div className="mt-5 border-t border-[#2d3748] pt-4">
              <p className="px-4 text-[9px] font-medium uppercase tracking-[0.1em] text-[#4b5563]">Additional</p>
            </div>

            <div className="mt-2 space-y-1">
              {additionalNavItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "mx-[10px] my-[2px] flex items-center gap-2.5 rounded-[8px] px-4 py-[10px] text-[14px] font-medium",
                    isActive
                      ? "bg-sk-primary text-sk-sidebar-act"
                      : "text-sk-sidebar-text hover:bg-[rgba(249,115,22,0.1)] hover:text-sk-primary"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {item.label}
                </Link>
              )
              })}
            </div>
          </nav>

          <div className="border-t border-[#2d3748] px-4 py-4">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 rounded-[8px] px-4 py-[10px] text-[14px] font-medium text-[#64748b] hover:bg-[rgba(249,115,22,0.1)] hover:text-sk-primary"
            >
              <LogOut className="h-[18px] w-[18px]" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col lg:pl-[220px]">
        <header className="z-30 border-b border-sk-border bg-white">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <h1 className="truncate text-[20px] font-semibold text-sk-text-1">{topbarTitle}</h1>
              <p className="text-[12px] font-medium text-sk-text-3">{todayLabel}</p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" className="h-9 px-4 text-sk-text-2 hover:bg-sk-primary-tint hover:text-sk-primary-dk">
                Export
              </Button>
              <Link href="/dashboard/orders/new">
                <Button className="h-9 bg-sk-primary px-[18px] text-[13px] font-medium text-white hover:bg-sk-primary-dk">
                  + New Order
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-sk-page-bg pb-20 lg:pb-0">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:pl-8 lg:pr-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      <MobileBottomNav />
    </div>
  )
}

