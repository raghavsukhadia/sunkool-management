"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { Home, ShoppingCart, Briefcase, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingCart },
  { href: "/dashboard/work", label: "Work", icon: Briefcase },
  { href: "/dashboard/management", label: "More", icon: MoreHorizontal },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-slate-200 bg-white px-2 py-2 lg:hidden"
      role="navigation"
      aria-label="Mobile navigation"
    >
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" &&
            item.href !== "/dashboard/management" &&
            pathname.startsWith(item.href)) ||
          (item.href === "/dashboard/management" &&
            pathname.startsWith("/dashboard/management"))
        const isWorkActive =
          item.href === "/dashboard/work" &&
          (pathname.startsWith("/dashboard/production") ||
            pathname.startsWith("/dashboard/follow-up") ||
            pathname.startsWith("/dashboard/notifications"))

        const active = isActive || isWorkActive

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
              active
                ? "text-amber-600"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            )}
          >
            <Icon className={cn("h-5 w-5", active && "text-amber-600")} />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
