"use client"

import { useState } from "react"
import { ChevronDown, Package } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { OrderLineItemSummary } from "@/app/actions/orders"
import { getOrderLineItemsForDropdown } from "@/app/actions/orders"

interface OrderItemsDropdownProps {
  orderId: string
  count: number
  className?: string
}

export function OrderItemsDropdown({
  orderId,
  count,
  className,
}: OrderItemsDropdownProps) {
  const [items, setItems] = useState<OrderLineItemSummary[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [resolvedCount, setResolvedCount] = useState<number | null>(null)

  const effectiveCount = resolvedCount ?? count

  const label =
    effectiveCount === 0
      ? "No items"
      : effectiveCount === 1
        ? "1 item"
        : `${effectiveCount} items`

  return (
    <div
      className={cn("inline-flex", className)}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <DropdownMenu
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)

          if (!nextOpen) return
          if (items !== null || loading) return
          if (!orderId) return

          void (async () => {
            setLoading(true)
            try {
              const res = await getOrderLineItemsForDropdown(orderId)
              setItems(res.items || [])
              setResolvedCount((res.items || []).length)
            } catch (err) {
              console.error("Failed to load order line items:", err)
              setItems([])
              setResolvedCount(0)
            } finally {
              setLoading(false)
            }
          })()
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-sk-border bg-white px-3 py-1.5 text-sm font-medium text-sk-text-2",
              "transition-colors hover:border-[#f3c29c] hover:bg-sk-primary-tint hover:text-sk-text-1",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sk-primary focus-visible:ring-offset-1",
              "data-[state=open]:border-[#f3c29c] data-[state=open]:bg-sk-primary-tint"
            )}
          >
            <Package className="h-3.5 w-3.5 shrink-0 text-sk-text-3" aria-hidden />
            <span>{label}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-sk-text-3" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[min(22rem,calc(100vw-2rem))] border-sk-border p-0 shadow-lg"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="border-b border-sk-border bg-[#fcf7f2] px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-sk-text-3">
              Order items
            </p>
            <p className="mt-0.5 text-sm font-medium text-sk-text-1">
              {effectiveCount === 0
                ? "Nothing added yet"
                : `${effectiveCount} line${effectiveCount === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="max-h-[min(18rem,50vh)] overflow-y-auto overscroll-contain p-2">
            {loading ? (
              <div className="px-2 py-6 text-center text-sm text-sk-text-2">
                Loading items…
              </div>
            ) : items && items.length > 0 ? (
              <ul className="space-y-1">
                {items.map((item, i) => (
                  <li
                    key={`${item.name}-${i}`}
                    className="flex flex-col gap-1.5 rounded-md px-2 py-2 text-sm hover:bg-sk-page-bg sm:flex-row sm:items-start sm:gap-2"
                  >
                    <span className="min-w-0 flex-1 leading-snug text-sk-text-1">
                      {item.name}
                    </span>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
                      <span
                        title="Ordered quantity"
                        className="rounded-md bg-cyan-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-cyan-800 ring-1 ring-cyan-100"
                      >
                        O-{item.ordered}
                      </span>
                      <span
                        title="Remaining quantity"
                        className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-900 ring-1 ring-amber-100"
                      >
                        R-{item.remaining}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-2 py-6 text-center text-sm text-sk-text-2">
                No items on this order.
              </p>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
