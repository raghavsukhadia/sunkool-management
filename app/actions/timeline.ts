"use server"

import { createClient } from "@/lib/supabase/server"
import type { TimelineEntry } from "@/app/actions/timeline-types"

/**
 * Fetch the complete timeline for one order, newest event first.
 * Joins to `profiles` to resolve the actor's display name.
 */
export async function getOrderTimeline(orderId: string): Promise<{
  success: boolean
  data: TimelineEntry[] | null
  error: string | null
}> {
  if (!orderId) return { success: false, data: null, error: "Order ID is required" }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("order_timeline")
    .select(`
      id,
      order_id,
      event_type,
      title,
      description,
      timestamp,
      actor,
      actor_id,
      metadata,
      profiles:actor_id ( full_name )
    `)
    .eq("order_id", orderId)
    .order("timestamp", { ascending: false })

  if (error) {
    return { success: false, data: null, error: error.message }
  }

  const entries: TimelineEntry[] = (data || []).map((row: any) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    return {
      id:          row.id,
      order_id:    row.order_id,
      event_type:  row.event_type,
      title:       row.title,
      description: row.description ?? null,
      timestamp:   row.timestamp,
      actor:       row.actor,
      actor_name:  profile?.full_name ?? null,
      metadata:    row.metadata ?? {},
    }
  })

  return { success: true, data: entries, error: null }
}
