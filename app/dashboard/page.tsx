"use client"

import React, { Suspense, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  Package,
  DollarSign,
  Truck,
  AlertCircle,
  Plus,
  Factory,
  TrendingUp,
  Eye,
  Zap,
  Command,
} from "lucide-react"
import { useDashboardStats } from "@/hooks/useDashboardStats"
import { createClient } from "@/lib/supabase/client"
import { RevenueOverview } from "@/components/RevenueOverview"
import { RecentActivity, ActivityItem } from "@/components/RecentActivity"
import { OrderTable, Order } from "@/components/OrderTable"
import SunkoolLogo from "@/components/SunkoolLogo"

// KPI Card Component with percentage change indicator
function KPICard({
  title,
  value,
  icon: Icon,
  color,
  change,
  link,
  suppressHydrationWarning,
}: {
  title: string
  value: number | string
  icon: React.ReactNode
  color: string
  change?: number
  link?: string
  suppressHydrationWarning?: boolean
}) {
  const isPositive = change && change >= 0
  const cardContent = (
    <Card 
      className={`border-l-4 ${color} hover:shadow-lg transition-all duration-200 cursor-pointer group`}
      suppressHydrationWarning={suppressHydrationWarning}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold text-slate-700">{title}</CardTitle>
        <div className={`p-2 rounded-lg bg-slate-100 group-hover:bg-slate-200 transition-colors`}>
          {Icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900 mb-2">{value}</div>
        {change !== undefined && (
          <div className="flex items-center gap-1">
            <TrendingUp
              className={`h-4 w-4 ${
                isPositive ? "text-green-600" : "text-red-600"
              }`}
              style={{
                transform: isPositive ? "none" : "rotate(180deg)",
              }}
            />
            <span
              className={`text-xs font-semibold ${
                isPositive ? "text-green-600" : "text-red-600"
              }`}
            >
              {isPositive ? "+" : ""}
              {change}% from yesterday
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )

  return link ? <Link href={link}>{cardContent}</Link> : cardContent
}

// Deterministic mock data - replace with actual data from Supabase
const generateMockRevenueData = () => {
  const fixedValues = [
    { date: "Jan 22", revenue: 45000, orders: 8 },
    { date: "Jan 23", revenue: 52000, orders: 9 },
    { date: "Jan 24", revenue: 38000, orders: 5 },
    { date: "Jan 25", revenue: 61000, orders: 11 },
    { date: "Jan 26", revenue: 55000, orders: 10 },
    { date: "Jan 27", revenue: 48000, orders: 7 },
    { date: "Jan 28", revenue: 67000, orders: 12 },
  ]
  return fixedValues
}

// Mock activity data - replace with actual data from Supabase
const generateMockActivityData = (): ActivityItem[] => {
  return [
    {
      id: "1",
      action: "created",
      description: "New order SK001 created",
      user: { name: "Piyush" },
      timestamp: new Date(Date.now() - 10 * 60000),
      orderNumber: "SK001",
    },
    {
      id: "2",
      action: "updated",
      description: "Order SK002 status updated to In Production",
      user: { name: "Admin" },
      timestamp: new Date(Date.now() - 30 * 60000),
      orderNumber: "SK002",
    },
    {
      id: "3",
      action: "shipped",
      description: "Order SK003 dispatched to customer",
      user: { name: "Piyush" },
      timestamp: new Date(Date.now() - 60 * 60000),
      orderNumber: "SK003",
    },
  ]
}

export default function DashboardPage() {
  const { stats, loading } = useDashboardStats()
  const [orders, setOrders] = useState<Order[]>([])
  const [revenueData] = useState(generateMockRevenueData())
  const [activities] = useState<ActivityItem[]>(generateMockActivityData())
  const supabase = createClient()

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select(
            `
            id,
            internal_order_number,
            sales_order_number,
            customer_id,
            order_status,
            payment_status,
            total_price,
            created_at,
            updated_at,
            customers:customer_id (id, name, email)
          `
          )
          .order("created_at", { ascending: false })
          .limit(10)

        if (error) throw error

        const mappedOrders = data?.map((order: any) => ({
          ...order,
          customer: order.customers,
        })) || []

        setOrders(mappedOrders)
      } catch (error) {
        console.error("Error fetching orders:", error)
      }
    }

    fetchOrders()
  }, [supabase])

  return (
    <div className="space-y-6">
      {/* Header with Logo */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <SunkoolLogo variant="light" size="lg" />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Sunkool OMS</h1>
            <p className="text-slate-600 mt-1">Professional Order Management System</p>
          </div>
        </div>
        <div className="hidden sm:block">
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            <Command className="h-4 w-4" />
            Ctrl+K
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Orders"
          value={stats?.totalOrders || 0}
          icon={<Package className="h-5 w-5 text-blue-600" />}
          color="border-l-blue-500"
          change={12}
          link="/dashboard/orders"
        />
        <KPICard
          title="Pending Orders"
          value={stats?.pendingOrders || 0}
          icon={<AlertCircle className="h-5 w-5 text-amber-600" />}
          color="border-l-amber-500"
          change={-5}
          link="/dashboard/orders?status=Pending"
        />
        <KPICard
          title="In Transit"
          value={stats?.dispatchedOrders || 0}
          icon={<Truck className="h-5 w-5 text-green-600" />}
          color="border-l-green-500"
          change={8}
        />
        <KPICard
          title="Total Revenue"
          value={`₹${(stats?.totalRevenue || 0).toLocaleString("en-IN")}`}
          icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
          color="border-l-emerald-500"
          change={15}
          suppressHydrationWarning
        />
      </div>

      {/* Revenue Chart & Activity Feed */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueOverview data={revenueData} />
        </div>
        <div>
          <RecentActivity activities={activities} />
        </div>
      </div>

      {/* Quick Actions Section */}
      <Card className="shadow-sm border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link href="/dashboard/orders/new">
              <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-4 w-4" />
                New Order
              </Button>
            </Link>
            <Link href="/dashboard/production">
              <Button variant="outline" className="w-full gap-2 border-slate-300 hover:bg-slate-100">
                <Factory className="h-4 w-4" />
                Production Queue
              </Button>
            </Link>
            <Link href="/dashboard/follow-up">
              <Button variant="outline" className="w-full gap-2 border-slate-300 hover:bg-slate-100">
                <DollarSign className="h-4 w-4" />
                Follow-ups
              </Button>
            </Link>
            <Link href="/dashboard/orders">
              <Button variant="outline" className="w-full gap-2 border-slate-300 hover:bg-slate-100">
                <Eye className="h-4 w-4" />
                All Orders
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Orders Table */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg text-slate-900">Recent Orders</CardTitle>
              <CardDescription className="text-slate-600">
                Latest 10 orders in your system
              </CardDescription>
            </div>
            <Link href="/dashboard/orders">
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="text-center py-8 text-slate-500">Loading orders...</div>}>
            <OrderTable data={orders} isLoading={loading} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

