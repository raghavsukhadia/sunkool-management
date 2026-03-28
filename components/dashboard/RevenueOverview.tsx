"use client"

import React from "react"
import { BarChart3 } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface RevenueDataPoint {
  date: string
  revenue: number
  orders: number
}

interface RevenueOverviewProps {
  data: RevenueDataPoint[]
  dayLabel?: string
}

export function RevenueOverview({ data, dayLabel = "7 days" }: RevenueOverviewProps) {
  const totalRevenue = data.reduce((sum, point) => sum + point.revenue, 0)
  const avgRevenue = data.length ? totalRevenue / data.length : 0
  const totalOrders = data.reduce((sum, point) => sum + point.orders, 0)
  const hasRevenue = data.length > 0 && data.some((point) => point.revenue > 0)

  return (
    <Card className="h-full border-sk-border bg-sk-card-bg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-[20px] font-semibold text-sk-text-1">Revenue Overview</CardTitle>
            <CardDescription className="text-[12px] text-sk-text-3">
              Daily revenue trends for the last {dayLabel}
            </CardDescription>
          </div>
          <div className="text-right" suppressHydrationWarning>
            <div className="text-[32px] font-semibold leading-none text-sk-text-1">
              ₹{totalRevenue.toLocaleString("en-IN")}
            </div>
            <p className="mt-1 text-[11px] uppercase tracking-[0.06em] text-sk-text-3">Total Revenue</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasRevenue ? (
          <div className="flex h-[240px] flex-col items-center justify-center text-center">
            <BarChart3 className="mb-2 h-8 w-8 text-sk-border" />
            <p className="text-[13px] text-sk-text-3">No revenue data yet</p>
            <p className="mt-1 text-[11px] text-[#cbd5e1]">Revenue will appear once invoices are marked paid</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={data}
              margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
            >
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                stroke="#94a3b8"
                style={{ fontSize: "12px" }}
              />
              <Tooltip
                formatter={(value: any) => `₹${(value as number).toLocaleString("en-IN")}`}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                dot={false}
                stroke="#f97316"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div suppressHydrationWarning>
            <div className="rounded-[8px] border border-sk-border bg-[#F8FAFC] px-5 py-3">
              <p className="text-[11px] uppercase tracking-[0.06em] text-sk-text-3">Total Revenue</p>
              <p className="mt-1 text-[20px] font-semibold text-sk-text-1">₹{totalRevenue.toLocaleString("en-IN")}</p>
            </div>
          </div>
          <div suppressHydrationWarning>
            <div className="rounded-[8px] border border-sk-border bg-[#F8FAFC] px-5 py-3">
              <p className="text-[11px] uppercase tracking-[0.06em] text-sk-text-3">Average Daily</p>
              <p className="mt-1 text-[20px] font-semibold text-sk-text-1">
                ₹{avgRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
          <div>
            <div className="rounded-[8px] border border-sk-border bg-[#F8FAFC] px-5 py-3">
              <p className="text-[11px] uppercase tracking-[0.06em] text-sk-text-3">Total Orders</p>
              <p className="mt-1 text-[20px] font-semibold text-sk-text-1">{totalOrders}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
