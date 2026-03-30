"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { RealtimeChannel } from "@supabase/supabase-js"
import { getDashboardStats, type DashboardStats } from "@/app/actions/dashboard"
import { reportError } from "@/lib/monitoring"

export type { DashboardStats }

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true)
      setError(null)
      const result = await getDashboardStats()
      if (result.success && result.data) {
        const d = result.data
        setStats({
          ...d,
          lastUpdated: d.lastUpdated instanceof Date ? d.lastUpdated : new Date(d.lastUpdated as unknown as string),
        })
      } else {
        setError(result.success ? null : result.error)
        setStats(null)
      }
    } catch (err) {
      reportError(err, { area: "dashboard.useDashboardStats" })
      setError(err instanceof Error ? err.message : "Failed to fetch stats")
      setStats(null)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats(true)

    const supabase = createClient()
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    let realtimeChannel: RealtimeChannel
    realtimeChannel = supabase
      .channel("orders_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          if (refreshTimer) clearTimeout(refreshTimer)
          refreshTimer = setTimeout(() => {
            fetchStats(false)
          }, 300)
        }
      )
      .subscribe()

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      realtimeChannel?.unsubscribe()
    }
  }, [fetchStats])

  return { stats, loading, error }
}
