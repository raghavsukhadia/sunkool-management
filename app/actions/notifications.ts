"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import * as notificationService from "@/lib/notificationService"

const NOTIFICATIONS_PATH = "/dashboard/notifications"

// ---- Recipients ----
export async function getNotificationRecipients() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("notification_recipients")
    .select("*")
    .order("name", { ascending: true })
  if (error) return { success: false, error: error.message, data: null }
  return { success: true, data: data || [], error: null }
}

export async function createNotificationRecipient(name: string, phone: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("notification_recipients")
    .insert({ name, phone, is_active: true })
    .select()
    .single()
  if (error) return { success: false, error: error.message, data: null }
  revalidatePath(NOTIFICATIONS_PATH)
  return { success: true, data, error: null }
}

export async function updateNotificationRecipient(
  id: string,
  updates: { name?: string; phone?: string; is_active?: boolean }
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("notification_recipients")
    .update(updates)
    .eq("id", id)
    .select()
    .single()
  if (error) return { success: false, error: error.message, data: null }
  revalidatePath(NOTIFICATIONS_PATH)
  return { success: true, data, error: null }
}

export async function deleteNotificationRecipient(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("notification_recipients").delete().eq("id", id)
  if (error) return { success: false, error: error.message }
  revalidatePath(NOTIFICATIONS_PATH)
  return { success: true, error: null }
}

// ---- WhatsApp config (single row) ----
export async function getWhatsAppConfig() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("whatsapp_config")
    .select("*")
    .limit(1)
    .maybeSingle()
  if (error) return { success: false, error: error.message, data: null }
  return { success: true, data: data ?? null, error: null }
}

export async function upsertWhatsAppConfig(config: {
  provider?: string
  user_id?: string
  password?: string
  api_key?: string
  api_endpoint_url?: string
}) {
  const supabase = await createClient()
  const { data: existing } = await supabase.from("whatsapp_config").select("id").limit(1).maybeSingle()
  const payload = {
    provider: config.provider ?? null,
    user_id: config.user_id ?? null,
    password: config.password ?? null,
    api_key: config.api_key ?? null,
    api_endpoint_url: config.api_endpoint_url ?? null,
  }
  if (existing?.id) {
    const { data, error } = await supabase
      .from("whatsapp_config")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single()
    if (error) return { success: false, error: error.message, data: null }
    revalidatePath(NOTIFICATIONS_PATH)
    return { success: true, data, error: null }
  }
  const { data, error } = await supabase.from("whatsapp_config").insert(payload).select().single()
  if (error) return { success: false, error: error.message, data: null }
  revalidatePath(NOTIFICATIONS_PATH)
  return { success: true, data, error: null }
}

// ---- Notification templates ----
export async function getNotificationTemplates() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("notification_templates")
    .select("*")
    .order("event_type", { ascending: true })
  if (error) return { success: false, error: error.message, data: null }
  return { success: true, data: data || [], error: null }
}

export async function getNotificationTemplateByEventType(event_type: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("notification_templates")
    .select("*")
    .eq("event_type", event_type)
    .maybeSingle()
  if (error) return { success: false, error: error.message, data: null }
  return { success: true, data, error: null }
}

export async function upsertNotificationTemplate(params: {
  event_type: string
  name?: string
  template_body: string
}) {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from("notification_templates")
    .select("id")
    .eq("event_type", params.event_type)
    .maybeSingle()
  const payload = {
    event_type: params.event_type,
    name: params.name ?? null,
    template_body: params.template_body,
  }
  if (existing?.id) {
    const { data, error } = await supabase
      .from("notification_templates")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single()
    if (error) return { success: false, error: error.message, data: null }
    revalidatePath(NOTIFICATIONS_PATH)
    return { success: true, data, error: null }
  }
  const { data, error } = await supabase.from("notification_templates").insert(payload).select().single()
  if (error) return { success: false, error: error.message, data: null }
  revalidatePath(NOTIFICATIONS_PATH)
  return { success: true, data, error: null }
}

// ---- Queue (for messenger auto sender) ----
export async function enqueueNotification(event_type: string, payload: Record<string, unknown>) {
  const supabase = await createClient()
  const { error } = await supabase.from("notification_queue").insert({ event_type, payload })
  if (error) {
    console.error("[notifications] enqueueNotification failed:", error.message)
    return { success: false, error: error.message }
  }
  return { success: true, error: null }
}

// ---- In-app send: uses central notification service ----
function resolveTemplate(templateBody: string, payload: Record<string, unknown>): string {
  let out = templateBody
  for (const [key, value] of Object.entries(payload)) {
    const placeholder = `{{${key}}}`
    out = out.split(placeholder).join(String(value ?? ""))
  }
  return out
}

/** Build MessageAutoSender config from DB row; null if invalid */
function toServiceConfig(db: { api_endpoint_url?: string | null; user_id?: string | null; password?: string | null } | null): { url: string; username: string; password: string } | null {
  if (!db?.api_endpoint_url?.trim() || !db.user_id?.trim() || !db.password?.trim()) return null
  return {
    url: db.api_endpoint_url.trim(),
    username: db.user_id.trim(),
    password: db.password.trim(),
  }
}

/** Sends order_created notification to all active recipients. Uses DB config + template, then central service. */
export async function sendOrderCreatedNotification(payload: {
  order_number: string
  customer_name: string
  sales_order_number: string
}) {
  const [configRes, recipientsRes, templateRes] = await Promise.all([
    getWhatsAppConfig(),
    getNotificationRecipients(),
    getNotificationTemplateByEventType("order_created"),
  ])

  const config = toServiceConfig(configRes.success ? configRes.data : null)
  const recipients = (recipientsRes.success && recipientsRes.data
    ? recipientsRes.data as { id: string; name: string; phone: string; is_active: boolean }[]
    : []
  ).filter((r) => r.is_active)
  const template = templateRes.success ? templateRes.data : null

  if (!config) {
    console.warn("[notifications] sendOrderCreated: missing endpoint, username, or password; skipping send")
    return
  }
  if (recipients.length === 0) {
    console.warn("[notifications] sendOrderCreated: no active recipients; skipping send")
    return
  }

  const phones = recipients.map((r) => r.phone?.trim()).filter(Boolean) as string[]

  const templateBody = template?.template_body?.trim()
  if (templateBody) {
    const message = resolveTemplate(templateBody, {
      order_number: payload.order_number,
      customer_name: payload.customer_name,
      sales_order_number: payload.sales_order_number,
    })
    await notificationService.sendMessageToRecipients(config, phones, message)
  } else {
    await notificationService.sendOrderCreated(config, phones, {
      orderNumber: payload.order_number,
      customerName: payload.customer_name,
      salesOrderNumber: payload.sales_order_number || undefined,
    })
  }
}
