"use client"

import React from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock } from "lucide-react"

export interface ActivityItem {
  id: string
  action: "created" | "updated" | "deleted" | "shipped" | "paid"
  description: string
  customerName: string
  statusLabel: "In Progress" | "In Transit" | "Delivered" | "Payment due" | "New Order"
  user: {
    name: string
    avatar?: string
  }
  timestamp: Date
  orderId?: string
  orderNumber?: string
}

interface RecentActivityProps {
  activities: ActivityItem[]
}

const statusBorderMap: Record<ActivityItem["statusLabel"], string> = {
  "In Progress": "border-[#8B5CF6]",
  "In Transit": "border-[#0891B2]",
  Delivered: "border-[#16a34a]",
  "Payment due": "border-[#dc2626]",
  "New Order": "border-sk-primary",
}

export function RecentActivity({ activities }: RecentActivityProps) {
  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    const intervals: Record<string, number> = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
    }

    for (const [key, value] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / value)
      if (interval >= 1) {
        return interval === 1 ? `1 ${key} ago` : `${interval} ${key}s ago`
      }
    }
    return "just now"
  }

  return (
    <Card className="flex h-full min-h-[420px] flex-col border-sk-border bg-sk-card-bg">
      <CardHeader className="pb-3">
        <CardTitle className="text-[20px] font-semibold text-sk-text-1">Recent Activity</CardTitle>
        <CardDescription className="text-[12px] text-sk-text-3">
          Latest order updates
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {activities.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-8 text-center text-sk-text-2">
            <Clock className="mx-auto mb-2 h-8 w-8 text-sk-text-3" />
            <p>No recent activity</p>
          </div>
        ) : (
          <div className="flex-1 space-y-3">
            {activities.map((activity, idx) => {
              const orderIdLabel = activity.orderNumber || activity.orderId?.slice(0, 8) || "Order"
              const borderColor = statusBorderMap[activity.statusLabel]

              const rowContent = (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-sk-text-1">{orderIdLabel}</p>
                    <p className="text-[12px] text-[#64748b]">{activity.customerName}</p>
                  </div>
                  <span className="whitespace-nowrap text-[12px] text-sk-text-3">{getTimeAgo(activity.timestamp)}</span>
                </div>
              )

              return (
                <div
                  key={activity.id}
                  className={`rounded-[8px] border-l-[3px] ${borderColor} bg-sk-page-bg px-3 py-2 ${idx !== activities.length - 1 ? "" : ""}`}
                >
                  {activity.orderId ? (
                    <Link href={`/dashboard/orders/${activity.orderId}`} className="block transition-colors hover:text-sk-primary">
                      {rowContent}
                    </Link>
                  ) : (
                    rowContent
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-4 border-t border-sk-border pt-3">
          <Link href="/dashboard/orders" className="text-[12px] font-medium text-sk-primary hover:text-sk-primary-dk">
            View all activity &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
