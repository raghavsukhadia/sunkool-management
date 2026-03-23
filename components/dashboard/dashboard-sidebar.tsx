"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import {
  Package,
  ShoppingCart,
  Factory,
  DollarSign,
  Settings,
  Gift,
  LogOut,
  Home,
  Bell
} from "lucide-react"
import { cn } from "@/lib/utils"
import SunkoolLogo from "@/components/brand/SunkoolLogo"
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav"

export default function DashboardSidebar({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/dashboard/orders", label: "Orders", icon: ShoppingCart },
    { href: "/dashboard/orders/new", label: "New Order", icon: Package },
    { href: "/dashboard/production", label: "Production", icon: Factory },
    { href: "/dashboard/follow-up", label: "Follow Up", icon: DollarSign },
    { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
    { href: "/dashboard/management", label: "Management", icon: Settings },
    { href: "/dashboard/rewards", label: "Rewards", icon: Gift },
  ]

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Left Sidebar - hidden on mobile (bottom nav instead), visible lg and up */}
      <aside
        className="fixed inset-y-0 left-0 z-50 w-64 bg-[#0f172a] text-white transform transition-transform duration-300 ease-in-out flex-col h-full hidden lg:flex lg:relative lg:translate-x-0"
      >
        <div className="flex flex-col h-full w-64">
          {/* Logo/Header */}
          <div className="flex items-center justify-between h-20 px-4 border-b border-slate-700/50 bg-[#0f172a]">
            <Link href="/dashboard" className="flex items-center space-x-3 hover:opacity-90 transition-opacity flex-1">
              <SunkoolLogo variant="dark" size="lg" />
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto custom-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200",
                    isActive
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                  )}
                >
                  <Icon className={cn("w-5 h-5 mr-3 transition-colors", isActive ? "text-white" : "text-slate-500")} />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Footer/Sign Out */}
          <div className="p-4 border-t border-slate-800 bg-[#070b14]">
            <button
              onClick={handleSignOut}
              className="group flex items-center w-full px-4 py-3 text-sm font-semibold text-slate-400 rounded-xl hover:bg-red-500/10 hover:text-red-500 transition-all duration-200 border border-transparent hover:border-red-500/20"
            >
              <LogOut className="w-5 h-5 mr-3 text-slate-500 group-hover:text-red-500 transition-colors" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Bar - compact on mobile, no hamburger (bottom nav used) */}
        <header className="bg-white border-b border-gray-100 shadow-sm z-30 shrink-0">
          <div className="flex items-center justify-between h-14 lg:h-20 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center min-w-0 gap-2 lg:gap-3">
              <Link href="/dashboard" className="flex-shrink-0">
                <span className="hidden lg:inline-block">
                  <SunkoolLogo variant="dark" size="md" />
                </span>
                <span className="lg:hidden">
                  <SunkoolLogo variant="dark" size="sm" />
                </span>
              </Link>
              <div className="flex flex-col min-w-0">
                <h1 className="text-base lg:text-xl font-bold text-slate-900 tracking-tight truncate">
                  Order Management System
                </h1>
                <p className="text-xs text-slate-500 font-medium hidden sm:block">Sunkool Management &middot; Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              {/* Removed decorative elements */}
            </div>
          </div>
        </header>

        {/* Main Content - pb for mobile bottom nav */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 scroll-smooth pb-20 lg:pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 animate-in fade-in duration-700">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation - visible only below lg */}
      <MobileBottomNav />
    </div>
  )
}

