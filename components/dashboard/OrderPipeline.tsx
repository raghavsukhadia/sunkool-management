"use client"

import React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { DashboardStats } from "@/app/actions/dashboard"

export interface OrderPipelineProps {
  stats: DashboardStats | null
  basePath?: string
}

const stages: {
  key: keyof DashboardStats
  label: string
  color: string
  statusParam: string
}[] = [
  { key: "pendingOrders", label: "New Order", color: "bg-yellow-100 text-yellow-800 border-yellow-200", statusParam: "New Order" },
  { key: "inProductionOrders", label: "In Progress", color: "bg-purple-100 text-purple-800 border-purple-200", statusParam: "In Progress" },
  { key: "readyForDispatchOrders", label: "Ready for Dispatch", color: "bg-orange-100 text-orange-800 border-orange-200", statusParam: "Ready for Dispatch" },
  { key: "invoicedOrders", label: "Invoiced", color: "bg-blue-100 text-blue-800 border-blue-200", statusParam: "Invoiced" },
  { key: "inTransitOrders", label: "In Transit", color: "bg-indigo-100 text-indigo-800 border-indigo-200", statusParam: "In Transit" },
  { key: "partialDeliveredOrders", label: "Partial Delivered", color: "bg-teal-100 text-teal-800 border-teal-200", statusParam: "Partial Delivered" },
  { key: "deliveredOrders", label: "Delivered", color: "bg-emerald-100 text-emerald-800 border-emerald-200", statusParam: "Delivered" },
]

export function OrderPipeline({ stats, basePath = "/dashboard/orders" }: OrderPipelineProps) {
  if (!stats) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Order pipeline</h3>
        <Link
          href={basePath}
          className="text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          View all
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {stages.map((stage, idx) => {
          const count = Number(stats[stage.key] ?? 0)
          return (
            <React.Fragment key={stage.key}>
              {idx > 0 && (
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" aria-hidden />
              )}
              <Link
                href={`${basePath}?status=${encodeURIComponent(stage.statusParam)}`}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-90 ${stage.color}`}
              >
                <span>{stage.label}</span>
                <span className="font-bold">{count}</span>
              </Link>
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
