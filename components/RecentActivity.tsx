"use client"

import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, Clock, Edit2, Plus, Trash2 } from "lucide-react"

export interface ActivityItem {
  id: string
  action: "created" | "updated" | "deleted" | "shipped" | "paid"
  description: string
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

const actionConfig = {
  created: {
    icon: Plus,
    color: "bg-blue-100 text-blue-700",
    label: "Created",
  },
  updated: {
    icon: Edit2,
    color: "bg-amber-100 text-amber-700",
    label: "Updated",
  },
  deleted: {
    icon: Trash2,
    color: "bg-red-100 text-red-700",
    label: "Deleted",
  },
  shipped: {
    icon: CheckCircle2,
    color: "bg-green-100 text-green-700",
    label: "Shipped",
  },
  paid: {
    icon: CheckCircle2,
    color: "bg-emerald-100 text-emerald-700",
    label: "Paid",
  },
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
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-slate-900">Recent Activity</CardTitle>
        <CardDescription className="text-slate-600">
          Latest order updates and changes
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Clock className="h-8 w-8 mx-auto mb-2 text-slate-400" />
            <p>No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity, idx) => {
              const config = actionConfig[activity.action]
              const Icon = config.icon

              return (
                <div
                  key={activity.id}
                  className={`flex items-start gap-3 pb-4 ${
                    idx !== activities.length - 1 ? "border-b border-slate-200" : ""
                  }`}
                >
                  {/* Icon */}
                  <div className={`p-2 rounded-lg ${config.color} flex-shrink-0 mt-0.5`}>
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {activity.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500">
                            by {activity.user.name}
                          </span>
                          {activity.orderNumber && (
                            <Badge variant="secondary" className="text-xs">
                              {activity.orderNumber}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-slate-500 whitespace-nowrap">
                        {getTimeAgo(activity.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
