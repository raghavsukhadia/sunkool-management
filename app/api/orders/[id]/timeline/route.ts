import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrderTimeline } from "@/app/actions/timeline"

/**
 * GET /api/orders/:id/timeline
 *
 * Returns the complete event timeline for the given order.
 * Protected: requires an authenticated admin session (RLS enforced by Supabase).
 *
 * Response: { data: TimelineEntry[] } | { error: string }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await getOrderTimeline(params.id)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ data: result.data })
}
