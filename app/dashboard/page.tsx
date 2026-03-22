"use client"

import React, { useEffect, useState } from "react"
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
  Eye,
  Zap,
  ClipboardList,
} from "lucide-react"
import { useDashboardStats } from "@/hooks/useDashboardStats"
import { createClient } from "@/lib/supabase/client"
import { getDashboardData } from "@/app/actions/dashboard"
import type { RevenueByDayPoint, RecentActivityRow } from "@/app/actions/dashboard"
import { RevenueOverview } from "@/components/dashboard/RevenueOverview"
import { RecentActivity, ActivityItem } from "@/components/dashboard/RecentActivity"
import { OrderPipeline } from "@/components/dashboard/OrderPipeline"
import { OrderTable, Order } from "@/components/orders/OrderTable"
import { OrderCardList } from "@/components/orders/OrderCardList"
import { Skeleton } from "@/components/ui/skeleton"

function KPICardSkeleton() {
  return (
    <Card className="border-l-4 border-l-slate-200 animate-pulse">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-4 w-32" />
      </CardContent>
    </Card>
  )
}

function KPICard({
  title,
  value,
  icon: Icon,
  color,
  link,
  suppressHydrationWarning,
}: {
  title: string
  value: number | string
  icon: React.ReactNode
  color: string
  link?: string
  suppressHydrationWarning?: boolean
}) {
  const cardContent = (
    <Card
      className={`border-l-4 ${color} hover:shadow-lg transition-all duration-200 cursor-pointer group`}
      suppressHydrationWarning={suppressHydrationWarning}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold text-slate-700">{title}</CardTitle>
        <div className="p-2 rounded-lg bg-slate-100 group-hover:bg-slate-200 transition-colors">
          {Icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
      </CardContent>
    </Card>
  )
  return link ? <Link href={link}>{cardContent}</Link> : cardContent
}

function mapActivityToItem(row: RecentActivityRow): ActivityItem {
  return {
    id: row.id,
    action: row.action,
    description: row.description,
    user: { name: row.user_name },
    timestamp: new Date(row.created_at),
    orderNumber: row.order_number,
    orderId: row.order_id,
  }
}

export default function DashboardPage() {
  const { stats, loading: statsLoading } = useDashboardStats()
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [revenueByDay, setRevenueByDay] = useState<RevenueByDayPoint[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [extraLoading, setExtraLoading] = useState(true)
  const [extraError, setExtraError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      setExtraLoading(true)
      setExtraError(null)
      const res = await getDashboardData()
      if (res.success && res.data) {
        setRevenueByDay(res.data.revenueByDay)
        setActivities(res.data.recentActivity.map(mapActivityToItem))
      } else {
        setExtraError(res.success ? null : res.error ?? "Failed to load")
      }
      setExtraLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setOrdersLoading(true)
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

        const mappedOrders =
          data?.map((order: any) => ({
            ...order,
            customer: order.customers,
          })) ?? []
        setOrders(mappedOrders)
      } catch (err) {
        console.error("Error fetching orders:", err)
      } finally {
        setOrdersLoading(false)
      }
    }
    fetchOrders()
  }, [supabase])

  const needsAttention =
    stats &&
    (stats.unpaidInvoices > 0 || stats.partialPaymentOrders > 0 || stats.missingSalesOrderNumber > 0)

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 font-medium text-base">OMS at a glance</p>
      </div>

      {/* KPI Cards - mobile: 2x3 grid or horizontal scroll; desktop: 4-6 cols */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {statsLoading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              title="Total Orders"
              value={stats?.totalOrders ?? 0}
              icon={<Package className="h-5 w-5 text-blue-600" />}
              color="border-l-blue-500"
              link="/dashboard/orders"
            />
            <KPICard
              title="New Order"
              value={stats?.pendingOrders ?? 0}
              icon={<AlertCircle className="h-5 w-5 text-amber-600" />}
              color="border-l-amber-500"
              link="/dashboard/orders?status=New Order"
            />
            <KPICard
              title="In Progress"
              value={stats?.inProductionOrders ?? 0}
              icon={<ClipboardList className="h-5 w-5 text-purple-600" />}
              color="border-l-purple-500"
              link="/dashboard/orders?status=In Progress"
            />
            <KPICard
              title="Dispatched"
              value={stats?.dispatchedOrders ?? 0}
              icon={<Truck className="h-5 w-5 text-green-600" />}
              color="border-l-green-500"
              link="/dashboard/orders"
            />
            <KPICard
              title="Partial Delivered"
              value={stats?.partialDeliveredOrders ?? 0}
              icon={<Truck className="h-5 w-5 text-teal-600" />}
              color="border-l-teal-500"
              link="/dashboard/orders?status=Partial%20Delivered"
            />
            <KPICard
              title="Delivered"
              value={stats?.deliveredOrders ?? 0}
              icon={<Package className="h-5 w-5 text-emerald-600" />}
              color="border-l-emerald-500"
              link="/dashboard/orders?status=Delivered"
            />
            <KPICard
              title="Total Revenue"
              value={`₹${(stats?.totalRevenue ?? 0).toLocaleString("en-IN")}`}
              icon={<DollarSign className="h-5 w-5 text-slate-600" />}
              color="border-l-slate-500"
              suppressHydrationWarning
            />
          </>
        )}
      </div>

      {/* Order Pipeline */}
      {!statsLoading && <OrderPipeline stats={stats} />}

      {/* Needs attention */}
      {needsAttention && (
        <Card className="shadow-sm border-amber-200 bg-amber-50/50">
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700">
              {stats!.unpaidInvoices > 0 && (
                <Link
                  href="/dashboard/follow-up"
                  className="font-medium text-amber-800 hover:underline"
                >
                  {stats!.unpaidInvoices} delivered unpaid
                </Link>
              )}
              {stats!.partialPaymentOrders > 0 && (
                <Link
                  href="/dashboard/follow-up"
                  className="font-medium text-amber-800 hover:underline"
                >
                  {stats!.partialPaymentOrders} partial payments
                </Link>
              )}
              {stats!.missingSalesOrderNumber > 0 && (
                <Link
                  href="/dashboard/orders"
                  className="font-medium text-amber-800 hover:underline"
                >
                  {stats!.missingSalesOrderNumber} missing sales order #
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revenue & Activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {extraLoading ? (
            <Card className="shadow-sm border-slate-200">
              <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56 mt-1" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[300px] w-full" />
              </CardContent>
            </Card>
          ) : extraError ? (
            <Card className="shadow-sm border-slate-200">
              <CardContent className="py-8 text-center text-slate-500 text-sm">
                {extraError}
              </CardContent>
            </Card>
          ) : (
            <RevenueOverview data={revenueByDay} dayLabel="7 days" />
          )}
        </div>
        <div>
          {extraLoading ? (
            <Card className="shadow-sm border-slate-200">
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48 mt-1" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ) : (
            <RecentActivity activities={activities} />
          )}
        </div>
      </div>

      {/* Quick Actions - mobile: 2x2 grid with touch targets */}
      <Card className="shadow-sm border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Link href="/dashboard/orders/new">
              <Button className="w-full min-h-[44px] gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-4 w-4" />
                New Order
              </Button>
            </Link>
            <Link href="/dashboard/production">
              <Button variant="outline" className="w-full min-h-[44px] gap-2 border-slate-300 hover:bg-slate-100">
                <Factory className="h-4 w-4" />
                Production Queue
              </Button>
            </Link>
            <Link href="/dashboard/follow-up">
              <Button variant="outline" className="w-full min-h-[44px] gap-2 border-slate-300 hover:bg-slate-100">
                <DollarSign className="h-4 w-4" />
                Follow-ups
              </Button>
            </Link>
            <Link href="/dashboard/orders">
              <Button variant="outline" className="w-full min-h-[44px] gap-2 border-slate-300 hover:bg-slate-100">
                <Eye className="h-4 w-4" />
                All Orders
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Orders - card list on mobile, table on desktop */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg text-slate-900">Recent Orders</CardTitle>
              <CardDescription className="text-slate-600">
                Latest 10 orders
              </CardDescription>
            </div>
            <Link href="/dashboard/orders">
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 min-h-[44px] min-w-[44px]">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-4 lg:p-6">
          {ordersLoading ? (
            <div className="space-y-3">
              <div className="lg:hidden">
                <OrderCardList data={[]} isLoading />
              </div>
              <div className="hidden lg:block space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ) : (
            <>
              <div className="lg:hidden">
                <OrderCardList data={orders} />
              </div>
              <div className="hidden lg:block">
                <OrderTable data={orders} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
