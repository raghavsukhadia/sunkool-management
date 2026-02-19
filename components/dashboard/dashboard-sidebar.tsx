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
  Menu,
  X,
  Users
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import SunkoolLogo from "@/components/brand/SunkoolLogo"

export default function DashboardSidebar({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
    { href: "/dashboard/management", label: "Management", icon: Settings },
    { href: "/dashboard/rewards", label: "Rewards", icon: Gift },
  ]

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={cn(
          "fixed lg:relative inset-y-0 left-0 z-50 w-64 bg-[#0f172a] text-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col h-full",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="flex items-center justify-between h-20 px-4 border-b border-slate-700/50 bg-[#0f172a]">
            <Link href="/dashboard" className="flex items-center space-x-3 hover:opacity-90 transition-opacity flex-1">
              <SunkoolLogo variant="dark" size="lg" />
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
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
                  onClick={() => setSidebarOpen(false)}
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
        {/* Top Header Bar */}
        <header className="bg-white border-b border-gray-100 shadow-sm z-30 shrink-0">
          <div className="flex items-center justify-between h-20 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div className="flex flex-col ml-4 lg:ml-0">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Order Management System
                </h1>
                <p className="text-xs text-slate-500 font-medium">Sunkool Management &middot; Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              {/* Removed decorative elements */}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 scroll-smooth">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-700">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

