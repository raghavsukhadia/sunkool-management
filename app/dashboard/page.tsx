"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import {
  AlertCircle,
  Clock3,
  FileText,
  IndianRupee,
  Package,
  Plus,
  Triangle,
  Truck,
} from "lucide-react"
import { useDashboardStats } from "@/hooks/useDashboardStats"
import { getDashboardData } from "@/app/actions/dashboard"
import type { RevenueByDayPoint, RecentActivityRow } from "@/app/actions/dashboard"
import { RevenueOverview } from "@/components/dashboard/RevenueOverview"
import { RecentActivity, ActivityItem } from "@/components/dashboard/RecentActivity"
import { OrderPipeline } from "@/components/dashboard/OrderPipeline"
import { Skeleton } from "@/components/ui/skeleton"

function KPICardSkeleton() {
  return (
    <Card className="min-h-[120px] overflow-hidden border-sk-border bg-sk-card-bg">
      <div className="h-[3px] w-full bg-sk-border" />
      <CardContent className="space-y-3 px-5 py-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-12 w-24" />
        <Skeleton className="h-4 w-32" />
      </CardContent>
    </Card>
  )
}

function KPICard({
  title,
  value,
  accent,
  delta,
  deltaTone,
  icon: Icon,
  href,
}: {
  title: string
  value: number | string
  accent: string
  delta: string
  deltaTone: "up" | "down" | "warn"
  icon: React.ComponentType<{ className?: string }>
  href?: string
}) {
  const deltaColor =
    deltaTone === "up"
      ? "text-sk-success"
      : deltaTone === "down"
      ? "text-sk-danger"
      : "text-sk-warning"
  const deltaIcon = deltaTone === "up" ? "▲" : deltaTone === "down" ? "▼" : "⚠"

  const content = (
    <Card className="min-h-[120px] overflow-hidden border-sk-border bg-sk-card-bg hover:bg-sk-primary-tint">
      <div className="h-[3px] w-full" style={{ backgroundColor: accent }} />
      <CardContent className="px-5 py-6">
        <div className="mb-3 flex items-start justify-between">
          <p className="text-[11px] uppercase tracking-[0.08em] text-sk-text-3">{title}</p>
          <Icon className="h-5 w-5 text-sk-text-3" />
        </div>
        <div className="text-[40px] font-semibold leading-none text-sk-text-1" suppressHydrationWarning>
          {value}
        </div>
        <div className={`mt-2 flex items-center gap-1 text-[12px] ${deltaColor}`}>
          <span>{deltaIcon}</span>
          <span>{delta}</span>
        </div>
      </CardContent>
    </Card>
  )

  return href ? <Link href={href}>{content}</Link> : content
}

function mapActivityToItem(row: RecentActivityRow): ActivityItem {
  return {
    id: row.id,
    action: row.action,
    description: row.description,
    customerName: row.customer_name,
    statusLabel: row.status_label,
    user: { name: row.user_name },
    timestamp: new Date(row.created_at),
    orderNumber: row.order_number,
    orderId: row.order_id,
  }
}

export default function DashboardPage() {
  const { stats, loading: statsLoading } = useDashboardStats()
  const [revenueByDay, setRevenueByDay] = useState<RevenueByDayPoint[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [extraLoading, setExtraLoading] = useState(true)
  const [extraError, setExtraError] = useState<string | null>(null)

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statsLoading ? (
          <>
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
              accent="#F97316"
              delta="+8.6% vs last period"
              deltaTone="up"
              icon={Package}
              href="/dashboard/orders"
            />
            <KPICard
              title="In Progress"
              value={stats?.inProductionOrders ?? 0}
              accent="#8B5CF6"
              delta="+3.2% active jobs"
              deltaTone="up"
              icon={Clock3}
              href="/dashboard/orders?status=In%20Progress"
            />
            <KPICard
              title="In Transit"
              value={stats?.inTransitOrders ?? 0}
              accent="#0891B2"
              delta="+2.1% dispatch velocity"
              deltaTone="up"
              icon={Truck}
              href="/dashboard/orders?status=In%20Transit"
            />
            <KPICard
              title="Unpaid"
              value={stats?.unpaidInvoices ?? 0}
              accent="#DC2626"
              delta={`${stats?.missingSalesOrderNumber ?? 0} missing sales order #`}
              deltaTone="warn"
              icon={AlertCircle}
              href="/dashboard/follow-up"
            />
          </>
        )}
      </div>

      {!statsLoading && <OrderPipeline stats={stats} />}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <Link
          href="/dashboard/orders/new"
          className="rounded-[10px] border border-sk-border bg-white px-4 py-[14px]"
        >
          <div className="flex items-start gap-3">
            <Plus className="h-[18px] w-[18px] text-sk-primary" />
            <div>
              <p className="text-[13px] font-medium text-sk-text-1">New Order</p>
              <p className="text-[11px] text-sk-text-3">Create a new order</p>
            </div>
          </div>
        </Link>
        <Link
          href="/dashboard/orders?status=Ready%20for%20Dispatch"
          className="rounded-[10px] border border-sk-border bg-white px-4 py-[14px]"
        >
          <div className="flex items-start gap-3">
            <Truck className="h-[18px] w-[18px] text-sk-primary" />
            <div>
              <p className="text-[13px] font-medium text-sk-text-1">Dispatch</p>
              <p className="text-[11px] text-sk-text-3">Mark orders dispatched</p>
            </div>
          </div>
        </Link>
        <Link
          href="/dashboard/follow-up"
          className="rounded-[10px] border border-sk-border bg-white px-4 py-[14px]"
        >
          <div className="flex items-start gap-3">
            <IndianRupee className="h-[18px] w-[18px] text-sk-primary" />
            <div>
              <p className="text-[13px] font-medium text-sk-text-1">Payment</p>
              <p className="text-[11px] text-sk-text-3">Record a payment</p>
            </div>
          </div>
        </Link>
        <Link
          href="/dashboard/production"
          className="rounded-[10px] border border-sk-border bg-white px-4 py-[14px]"
        >
          <div className="flex items-start gap-3">
            <FileText className="h-[18px] w-[18px] text-sk-primary" />
            <div>
              <p className="text-[13px] font-medium text-sk-text-1">Production</p>
              <p className="text-[11px] text-sk-text-3">Add to production queue</p>
            </div>
          </div>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[65%_35%]">
        <div className="h-full">
          {extraLoading ? (
            <Card className="h-full border-sk-border bg-sk-card-bg">
              <CardContent className="p-6">
                <Skeleton className="mb-4 h-5 w-40" />
                <Skeleton className="mb-6 h-4 w-56" />
                <Skeleton className="h-[300px] w-full" />
              </CardContent>
            </Card>
          ) : extraError ? (
            <Card className="h-full border-sk-border bg-sk-card-bg">
              <CardContent className="py-8 text-center text-sm text-sk-text-2">
                {extraError}
              </CardContent>
            </Card>
          ) : (
            <RevenueOverview data={revenueByDay} dayLabel="7 days" />
          )}
        </div>
        <div className="h-full">
          {extraLoading ? (
            <Card className="h-full border-sk-border bg-sk-card-bg">
              <CardContent className="p-6">
                <Skeleton className="mb-4 h-5 w-32" />
                <Skeleton className="mb-6 h-4 w-48" />
                <Skeleton className="h-[300px] w-full" />
              </CardContent>
            </Card>
          ) : (
            <RecentActivity activities={activities} />
          )}
        </div>
      </div>
    </div>
  )
}
