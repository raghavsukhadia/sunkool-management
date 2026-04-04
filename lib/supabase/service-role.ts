import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Server-only client that bypasses RLS. Use for trusted server jobs (e.g. cron uploads).
 * Set SUPABASE_SERVICE_ROLE_KEY in Vercel; never expose it to the browser.
 */
export function createServiceRoleSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url.trim(), key.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
