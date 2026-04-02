"use client"

import React from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Package, Layers, Truck, CheckCircle2, Clock, AlertCircle, BarChart3 } from "lucide-react"
import type { OrdersOverviewPoint } from "@/app/actions/dashboard"
import type { DashboardStats } from "@/app/actions/dashboard"

interface OrdersOverviewProps {
  data: OrdersOverviewPoint[]
  stats: DashboardStats | null
  dayLabel?: string
}

const COLORS = {
  orders:    { bar: "#F97316", light: "#FFF7ED", text: "text-orange-600",    border: "border-orange-200" },
  produced:  { bar: "#8B5CF6", light: "#F5F3FF", text: "text-violet-600",    border: "border-violet-200" },
  dispatched:{ bar: "#0EA5E9", light: "#F0F9FF", text: "text-sky-600",       border: "border-sky-200"    },
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-sk-border bg-white px-4 py-3 shadow-lg">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-sk-text-3">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-xs text-sk-text-2 capitalize">{p.dataKey}</span>
          <span className="ml-auto pl-4 text-xs font-semibold text-sk-text-1">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

function PipelineStat({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
  borderColor,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  color: string
  bgColor: string
  borderColor: string
}) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${borderColor}`} style={{ backgroundColor: bgColor }}>
      <div className="flex-shrink-0">
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-sk-text-3">{label}</p>
        <p className={`text-xl font-bold leading-tight ${color}`}>{value}</p>
      </div>
    </div>
  )
}

export function OrdersOverview({ data, stats, dayLabel = "7 days" }: OrdersOverviewProps) {
  const totalOrders    = data.reduce((s, d) => s + d.orders, 0)
  const totalProduced  = data.reduce((s, d) => s + d.produced, 0)
  const totalDispatched= data.reduce((s, d) => s + d.dispatched, 0)
  const hasData = data.some((d) => d.orders > 0 || d.produced > 0 || d.dispatched > 0)

  return (
    <Card className="h-full border-sk-border bg-sk-card-bg">
      {/* ── Header ───────────────────────────────────────── */}
      <CardHeader className="pb-3 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-semibold leading-tight text-sk-text-1">Orders Overview</h2>
            <p className="mt-0.5 text-[12px] text-sk-text-3">
              New orders, production &amp; dispatch · last {dayLabel}
            </p>
          </div>

          {/* 7-day totals summary */}
          <div className="flex gap-3">
            {(
              [
                { label: "Orders",    value: totalOrders,    color: COLORS.orders.bar    },
                { label: "Produced",  value: totalProduced,  color: COLORS.produced.bar  },
                { label: "Dispatched",value: totalDispatched,color: COLORS.dispatched.bar},
              ] as const
            ).map(({ label, value, color }) => (
              <div key={label} className="text-right">
                <div className="text-[22px] font-semibold leading-none text-sk-text-1">{value}</div>
                <div className="mt-0.5 flex items-center justify-end gap-1">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[10px] uppercase tracking-wider text-sk-text-3">{label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pb-5">
        {/* ── Bar Chart ─────────────────────────────────── */}
        {!hasData ? (
          <div className="flex h-[220px] flex-col items-center justify-center text-center">
            <BarChart3 className="mb-2 h-8 w-8 text-sk-border" />
            <p className="text-[13px] text-sk-text-3">No data yet for this period</p>
            <p className="mt-1 text-[11px] text-slate-300">Activity will appear once orders are placed</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc", radius: 4 }} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "11px", color: "#64748b", paddingTop: "8px" }}
              />
              <Bar dataKey="orders"    fill={COLORS.orders.bar}    radius={[4, 4, 0, 0]} name="Orders Placed" />
              <Bar dataKey="produced"  fill={COLORS.produced.bar}  radius={[4, 4, 0, 0]} name="Production Started" />
              <Bar dataKey="dispatched"fill={COLORS.dispatched.bar} radius={[4, 4, 0, 0]} name="Dispatched" />
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* ── Pipeline Status ───────────────────────────── */}
        <div>
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sk-text-3">
            Current Pipeline
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            <PipelineStat
              label="New Orders"
              value={stats?.pendingOrders ?? 0}
              icon={Package}
              color="text-amber-600"
              bgColor="#FFFBEB"
              borderColor="border-amber-200"
            />
            <PipelineStat
              label="In Production"
              value={stats?.inProductionOrders ?? 0}
              icon={Layers}
              color="text-violet-600"
              bgColor="#F5F3FF"
              borderColor="border-violet-200"
            />
            <PipelineStat
              label="Ready to Dispatch"
              value={stats?.readyForDispatchOrders ?? 0}
              icon={Clock}
              color="text-orange-600"
              bgColor="#FFF7ED"
              borderColor="border-orange-200"
            />
            <PipelineStat
              label="In Transit"
              value={stats?.inTransitOrders ?? 0}
              icon={Truck}
              color="text-sky-600"
              bgColor="#F0F9FF"
              borderColor="border-sky-200"
            />
            <PipelineStat
              label="Unpaid / Follow-up"
              value={stats?.unpaidInvoices ?? 0}
              icon={AlertCircle}
              color="text-red-600"
              bgColor="#FEF2F2"
              borderColor="border-red-200"
            />
          </div>
        </div>

        {/* ── Delivered & Partial ───────────────────────── */}
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
          <div className="flex flex-wrap gap-4">
            <div>
              <span className="text-sm font-bold text-emerald-700">{stats?.deliveredOrders ?? 0}</span>
              <span className="ml-1.5 text-[11px] text-emerald-600">Delivered</span>
            </div>
            <div className="h-4 w-px bg-emerald-200" />
            <div>
              <span className="text-sm font-bold text-teal-700">{stats?.partialDeliveredOrders ?? 0}</span>
              <span className="ml-1.5 text-[11px] text-teal-600">Partial Delivered</span>
            </div>
            <div className="h-4 w-px bg-emerald-200" />
            <div>
              <span className="text-sm font-bold text-slate-600">{stats?.partialPaymentOrders ?? 0}</span>
              <span className="ml-1.5 text-[11px] text-slate-500">Partial Payment</span>
            </div>
            <div className="h-4 w-px bg-emerald-200" />
            <div>
              <span className="text-sm font-bold text-sk-text-1">{stats?.totalOrders ?? 0}</span>
              <span className="ml-1.5 text-[11px] text-sk-text-3">Total Orders (all time)</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
