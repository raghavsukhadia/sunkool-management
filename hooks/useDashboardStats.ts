"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { RealtimeChannel } from "@supabase/supabase-js"
import { getDashboardStats, type DashboardStats } from "@/app/actions/dashboard"

export type { DashboardStats }

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true)
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
      console.error("Dashboard stats fetch error:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch stats")
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()

    const supabase = createClient()
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
          fetchStats()
        }
      )
      .subscribe()

    return () => {
      realtimeChannel?.unsubscribe()
    }
  }, [fetchStats])

  return { stats, loading, error }
}
