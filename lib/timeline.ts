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
  /** UUID of the profiles row that triggered the event. */
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
    const { error } = await supabase.from("order_timeline").insert({
      order_id:    orderId,
      event_type:  event.event_type,
      title:       event.title,
      description: event.description ?? null,
      actor:       event.actor    ?? "system",
      actor_id:    event.actor_id ?? null,
      metadata:    event.metadata ?? {},
      ...(event.timestamp ? { timestamp: event.timestamp } : {}),
    })

    if (error) {
      // Surface the DB error without crashing the caller.
      console.warn("[Timeline] Insert failed:", {
        event_type: event.event_type,
        order_id:   orderId,
        error:      error.message,
      })
    }
  } catch (err) {
    // Catch network / unexpected errors.
    console.warn("[Timeline] Unexpected error:", {
      event_type: event.event_type,
      order_id:   orderId,
      error:      err instanceof Error ? err.message : String(err),
    })
  }
}
