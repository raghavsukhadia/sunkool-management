"use client"

import React from "react"
import Link from "next/link"
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
  { key: "pendingOrders", label: "New Order", color: "bg-[#FEF3C7] text-[#92400E]", statusParam: "New Order" },
  { key: "inProductionOrders", label: "In Progress", color: "bg-[#EDE9FE] text-[#4C1D95]", statusParam: "In Progress" },
  { key: "readyForDispatchOrders", label: "Ready", color: "bg-[#DBEAFE] text-[#1e3a8a]", statusParam: "Ready for Dispatch" },
  { key: "inTransitOrders", label: "In Transit", color: "bg-[#E0F2FE] text-[#0C4A6E]", statusParam: "In Transit" },
  { key: "deliveredOrders", label: "Delivered", color: "bg-[#DCFCE7] text-[#14532D]", statusParam: "Delivered" },
  { key: "voidOrders", label: "Void", color: "bg-[#FEE2E2] text-[#7f1d1d]", statusParam: "Void" },
]

export function OrderPipeline({ stats, basePath = "/dashboard/orders" }: OrderPipelineProps) {
  if (!stats) return null

  return (
    <div className="rounded-xl border border-sk-border bg-sk-card-bg p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {stages.map((stage, idx) => {
          const count = Number(stats[stage.key] ?? 0)

          return (
            <React.Fragment key={stage.key}>
              {idx > 0 && <span className="text-sk-text-3">&rsaquo;</span>}
              <Link
                href={`${basePath}?status=${encodeURIComponent(stage.statusParam)}`}
                className={`inline-flex items-center gap-1 rounded-[20px] px-3 py-1 text-xs font-medium ${stage.color}`}
              >
                <span>{stage.label}</span>
                <span className="font-semibold">{count}</span>
              </Link>
            </React.Fragment>
          )
        })}
      </div>

      <div className="rounded-[8px] border border-[#FED7AA] bg-sk-primary-tint px-3 py-2 text-[12px] text-[#92400E]">
        <Link href="/dashboard/follow-up" className="font-medium hover:underline">
          {stats.unpaidInvoices} delivered unpaid
        </Link>
        <span> &middot; </span>
        <Link href="/dashboard/orders" className="font-medium hover:underline">
          {stats.missingSalesOrderNumber} missing sales order #
        </Link>
      </div>
    </div>
  )
}
