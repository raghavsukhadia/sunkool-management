"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export interface OrderCardItem {
  id: string
  internal_order_number: string | null
  sales_order_number?: string | null
  order_status: string
  payment_status: string
  total_price: number
  created_at: string
  customer?: { name?: string; email?: string | null } | null
  customers?: { name?: string; email?: string | null; id?: string; phone?: string | null } | null
}

const statusColorMap: Record<string, string> = {
  "New Order": "bg-amber-100 text-amber-700",
  "In Progress": "bg-purple-100 text-purple-700",
  "Ready for Dispatch": "bg-orange-100 text-orange-700",
  Invoiced: "bg-blue-100 text-blue-700",
  "In Transit": "bg-indigo-100 text-indigo-700",
  Delivered: "bg-green-100 text-green-700",
  Void: "bg-red-100 text-red-700",
}

const paymentColorMap: Record<string, string> = {
  Pending: "bg-red-100 text-red-700",
  "Partial Payment": "bg-yellow-100 text-yellow-700",
  Paid: "bg-green-100 text-green-700",
  "Delivered Unpaid": "bg-orange-100 text-orange-700",
  Partial: "bg-yellow-100 text-yellow-700",
  Refunded: "bg-red-100 text-red-700",
}

interface OrderCardListProps {
  data: OrderCardItem[]
  isLoading?: boolean
}

function OrderCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse">
      <div className="h-4 w-24 bg-slate-200 rounded mb-3" />
      <div className="h-4 w-32 bg-slate-200 rounded mb-2" />
      <div className="flex gap-2 mt-3">
        <div className="h-6 w-20 bg-slate-200 rounded-full" />
        <div className="h-6 w-16 bg-slate-200 rounded-full" />
      </div>
      <div className="h-5 w-20 bg-slate-200 rounded mt-3" />
    </div>
  )
}

export function OrderCardList({ data, isLoading = false }: OrderCardListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <OrderCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <p className="text-slate-500 font-medium">No orders to show</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {data.map((order) => {
        const customerName =
          order.customer?.name ?? order.customers?.name ?? "—"
        const statusColor =
          statusColorMap[order.order_status] ?? "bg-slate-100 text-slate-700"
        const paymentColor =
          paymentColorMap[order.payment_status] ?? "bg-slate-100 text-slate-700"

        return (
          <Link
            key={order.id}
            href={`/dashboard/orders/${order.id}`}
            className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md active:bg-slate-50 min-h-[44px]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 truncate">
                  {order.internal_order_number ?? order.id.slice(0, 8)}
                </p>
                <p className="text-sm text-slate-600 truncate mt-0.5">
                  {customerName}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span
                    className={cn(
                      "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                      statusColor
                    )}
                  >
                    {order.order_status}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                      paymentColor
                    )}
                  >
                    {order.payment_status}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-900 mt-2">
                  ₹{(order.total_price ?? 0).toLocaleString("en-IN")}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400 shrink-0 mt-1" />
            </div>
          </Link>
        )
      })}
    </div>
  )
}
