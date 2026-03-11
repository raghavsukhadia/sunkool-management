"use client"

import React from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface RevenueDataPoint {
  date: string
  revenue: number
  orders: number
}

interface RevenueOverviewProps {
  data: RevenueDataPoint[]
}

export function RevenueOverview({ data }: RevenueOverviewProps) {
  const totalRevenue = data.reduce((sum, point) => sum + point.revenue, 0)
  const avgRevenue = totalRevenue / data.length || 0

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg text-slate-900">Revenue Overview</CardTitle>
            <CardDescription className="text-slate-600">
              Daily revenue trends for the last 7 days
            </CardDescription>
          </div>
          <div className="text-right" suppressHydrationWarning>
            <div className="text-2xl font-bold text-slate-900">
              ₹{totalRevenue.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-slate-500">Total Revenue</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              stroke="#94a3b8"
              style={{ fontSize: "12px" }}
            />
            <YAxis
              stroke="#94a3b8"
              style={{ fontSize: "12px" }}
              tickFormatter={(value: any) => `₹${(value / 1000).toFixed(0)}K`}
            />
            <Tooltip
              formatter={(value: any) => `₹${(value as number).toLocaleString("en-IN")}`}
              contentStyle={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
              }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorRevenue)"
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-200">
          <div suppressHydrationWarning>
            <p className="text-xs text-slate-600 font-medium">Total Revenue</p>
            <p className="text-xl font-bold text-slate-900 mt-1">
              ₹{totalRevenue.toLocaleString("en-IN")}
            </p>
          </div>
          <div suppressHydrationWarning>
            <p className="text-xs text-slate-600 font-medium">Average Daily</p>
            <p className="text-xl font-bold text-slate-900 mt-1">
              ₹{avgRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-600 font-medium">Total Orders</p>
            <p className="text-xl font-bold text-slate-900 mt-1">
              {data.reduce((sum, point) => sum + point.orders, 0)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
