"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Home,
  ShoppingCart,
  Users,
  Layers,
  MoreHorizontal,
  Factory,
  DollarSign,
  Truck,
  BarChart3,
  Lightbulb,
  Settings,
  Bell,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const primaryNav = [
  { href: "/dashboard",           label: "Home",      icon: Home         },
  { href: "/dashboard/orders",    label: "Orders",    icon: ShoppingCart },
  { href: "/dashboard/customers", label: "Customers", icon: Users        },
  { href: "/dashboard/items",     label: "Items",     icon: Layers       },
]

const moreNav = [
  { href: "/dashboard/production",    label: "Production",    icon: Factory,    color: "text-blue-600"   },
  { href: "/dashboard/follow-up",     label: "Follow Up",     icon: DollarSign, color: "text-amber-600"  },
  { href: "/dashboard/tracking",      label: "Tracking",      icon: Truck,      color: "text-sky-600"    },
  { href: "/dashboard/reports",       label: "Reports",       icon: BarChart3,  color: "text-purple-600" },
  { href: "/dashboard/smart-insight", label: "Smart Insight", icon: Lightbulb,  color: "text-orange-500" },
  { href: "/dashboard/management",    label: "Management",    icon: Settings,   color: "text-slate-600"  },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell,       color: "text-slate-500"  },
]

export function MobileBottomNav() {
  const pathname  = usePathname()
  const [open, setOpen] = useState(false)

  const isMoreActive = moreNav.some((item) => pathname.startsWith(item.href))

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-sk-border bg-sk-card-bg px-1 py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] lg:hidden"
        role="navigation"
        aria-label="Mobile navigation"
      >
        {primaryNav.map((item) => {
          const Icon    = item.icon
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] py-1.5 text-[11px] font-medium transition-colors",
                isActive
                  ? "bg-sk-primary-tint text-sk-primary-dk"
                  : "text-sk-text-2 hover:bg-sk-primary-tint hover:text-sk-primary-dk"
              )}
            >
              <Icon className={cn("h-[22px] w-[22px]", isActive ? "text-sk-primary" : "text-sk-text-3")} />
              <span>{item.label}</span>
            </Link>
          )
        })}

        {/* More — opens bottom sheet */}
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] py-1.5 text-[11px] font-medium transition-colors",
            isMoreActive || open
              ? "bg-sk-primary-tint text-sk-primary-dk"
              : "text-sk-text-2 hover:bg-sk-primary-tint hover:text-sk-primary-dk"
          )}
        >
          <MoreHorizontal className={cn("h-[22px] w-[22px]", (isMoreActive || open) ? "text-sk-primary" : "text-sk-text-3")} />
          <span>More</span>
        </button>
      </nav>

      {/* ── More drawer ────────────────────────────────────────────── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-[20px] border-sk-border bg-white px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="pb-3 pt-1">
            <SheetTitle className="text-left text-[15px] font-semibold text-sk-text-1">
              More
            </SheetTitle>
          </SheetHeader>

          <div className="grid grid-cols-3 gap-3">
            {moreNav.map((item) => {
              const Icon     = item.icon
              const isActive = pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-[14px] border px-2 py-4 text-center transition-colors",
                    isActive
                      ? "border-sk-primary/25 bg-sk-primary-tint"
                      : "border-sk-border bg-sk-page-bg active:bg-sk-primary-tint"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-6 w-6",
                      isActive ? "text-sk-primary" : item.color
                    )}
                  />
                  <span
                    className={cn(
                      "text-[11.5px] font-medium leading-tight",
                      isActive ? "text-sk-primary-dk" : "text-sk-text-2"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
