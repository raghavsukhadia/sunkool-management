/**
 * Order Timeline — server-side utility.
 *
 * NOT "use server" — imported as a plain helper by other server actions that
 * already hold an authenticated Supabase client. Reuses the existing session
 * to avoid extra round-trips.
 *
 * Design rules:
 *  1. NEVER throw — a logging failure must never crash a primary mutation.
 *  2. ALWAYS warn — emit a console.warn so failures surface in server logs.
 *  3. Fire-and-forget callers use `void logTimelineEvent(...)`.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { TimelineEventType, TimelineActor } from "@/app/actions/timeline-types"

export interface TimelineEventInput {
  event_type:   TimelineEventType
  title:        string
  description?: string | null
  actor?:       TimelineActor
  /** UUID of the profiles row that triggered the event. Omit to auto-resolve. */
  actor_id?:    string | null
  metadata?:    Record<string, unknown>
  /** Override timestamp (ISO string). Omit to use DB server now(). */
  timestamp?:   string
}

/**
 * Append one event to `order_timeline`.
 *
 * Always call with `void` — do not await unless you need confirmation:
 *   `void logTimelineEvent(supabase, orderId, { ... })`
 *
 * Actor resolution: the function always looks up the currently authenticated
 * user's profile so the timeline records the real person who performed each
 * action. Any hardcoded `actor_id` passed in the event is overridden when a
 * live user session is present.
 *
 * @param supabase - Pass the caller's existing client so no new session is created.
 * @param orderId  - The order this event belongs to.
 * @param event    - Event payload.
 */
export async function logTimelineEvent(
  supabase: SupabaseClient,
  orderId: string,
  event: TimelineEventInput,
): Promise<void> {
  try {
    // Defaults — used as fallback when no user session is found.
    let actorId:    string | null = event.actor_id ?? null
    let actorLabel: string        = event.actor    ?? "system"

    // Always attempt to resolve the authenticated user's profile.
    // This overwrites any hardcoded values so every event is attributed
    // to the actual person who performed the action.
    try {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData?.user?.id

      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, role")
          .eq("id", userId)
          .maybeSingle()

        if (profile) {
          actorId    = profile.id
          actorLabel = profile.role as TimelineActor   // 'admin' | 'user'
        }
      }
    } catch {
      // Non-fatal: if resolution fails keep the provided/default values.
    }

    const { error } = await supabase.from("order_timeline").insert({
      order_id:    orderId,
      event_type:  event.event_type,
      title:       event.title,
      description: event.description ?? null,
      actor:       actorLabel,
      actor_id:    actorId,
      metadata:    event.metadata ?? {},
      ...(event.timestamp ? { timestamp: event.timestamp } : {}),
    })

    if (error) {
      console.warn("[Timeline] Insert failed:", {
        event_type: event.event_type,
        order_id:   orderId,
        error:      error.message,
      })
    }
  } catch (err) {
    console.warn("[Timeline] Unexpected error:", {
      event_type: event.event_type,
      order_id:   orderId,
      error:      err instanceof Error ? err.message : String(err),
    })
  }
}
