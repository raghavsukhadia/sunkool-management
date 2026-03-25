"use client"

import { ChevronDown, Package } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { OrderLineItemSummary } from "@/app/actions/orders"

interface OrderItemsDropdownProps {
  lineItems: OrderLineItemSummary[]
  count: number
  className?: string
}

export function OrderItemsDropdown({
  lineItems,
  count,
  className,
}: OrderItemsDropdownProps) {
  const label =
    count === 0
      ? "No items"
      : count === 1
        ? "1 item"
        : `${count} items`

  return (
    <div
      className={cn("inline-flex", className)}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm",
              "transition-colors hover:border-blue-200 hover:bg-blue-50/60 hover:text-blue-900",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
              "data-[state=open]:border-blue-300 data-[state=open]:bg-blue-50/80"
            )}
          >
            <Package className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
            <span>{label}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[min(22rem,calc(100vw-2rem))] p-0 shadow-lg border-slate-200"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="border-b border-slate-100 bg-slate-50/90 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Order items
            </p>
            <p className="text-sm font-medium text-slate-900 mt-0.5">
              {count === 0 ? "Nothing added yet" : `${count} line${count === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="max-h-[min(18rem,50vh)] overflow-y-auto overscroll-contain p-2">
            {lineItems.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-slate-500">
                No items on this order.
              </p>
            ) : (
              <ul className="space-y-1">
                {lineItems.map((item, i) => (
                  <li
                    key={`${item.name}-${i}`}
                    className="flex items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1 text-slate-800 leading-snug">
                      {item.name}
                    </span>
                    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700">
                      ×{item.quantity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
