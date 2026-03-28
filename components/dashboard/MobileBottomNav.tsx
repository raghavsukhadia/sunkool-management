"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { Home, ShoppingCart, Truck, Briefcase, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingCart },
  { href: "/dashboard/tracking", label: "Track", icon: Truck },
  { href: "/dashboard/work", label: "Work", icon: Briefcase },
  { href: "/dashboard/management", label: "More", icon: MoreHorizontal },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-sk-border bg-sk-card-bg px-2 py-2 lg:hidden"
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
              "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-[8px] px-3 py-2 text-xs font-medium transition-colors",
              active
                ? "bg-sk-primary-tint text-sk-primary-dk"
                : "text-sk-text-2 hover:bg-sk-primary-tint hover:text-sk-primary-dk"
            )}
          >
            <Icon className={cn("h-5 w-5", active && "text-sk-primary")} />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
