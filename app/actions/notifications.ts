"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role"
import { revalidatePath } from "next/cache"
import * as notificationService from "@/lib/notificationService"
import { checkRateLimit } from "@/lib/server/rate-limit"
import { reportError } from "@/lib/monitoring"
import { getProductionQueue } from "@/app/actions/production"
import { generateMorningReportPDF } from "@/lib/morning-report-pdf"

const NOTIFICATIONS_PATH = "/dashboard/notifications"
/** Stored as JSON: { enabled, manager_phones } — do not edit via generic message templates. */
const MORNING_REPORT_EVENT_TYPE = "morning_report_config"

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

export async function upsertNotificationTemplate(
  params: {
    event_type: string
    name?: string
    template_body: string
  },
  options?: { allowMorningReportConfig?: boolean }
) {
  if (
    params.event_type === MORNING_REPORT_EVENT_TYPE &&
    !options?.allowMorningReportConfig
  ) {
    return {
      success: false,
      error:
        "Morning report settings can only be changed from the Morning Production Report card (not message templates).",
      data: null,
    }
  }
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
  const queueRate = checkRateLimit(`notifications:queue:${event_type}`, 120, 60_000)
  if (!queueRate.ok) {
    return { success: false, error: "Notification queue rate limit reached. Please retry shortly." }
  }

  const { error } = await supabase.from("notification_queue").insert({ event_type, payload })
  if (error) {
    reportError(error, { area: "notifications.enqueueNotification", eventType: event_type })
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
  const sendRate = checkRateLimit("notifications:send:order_created", 60, 60_000)
  if (!sendRate.ok) {
    return
  }

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
  try {
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
  } catch (error) {
    reportError(error, { area: "notifications.sendOrderCreated" })
  }
}

// ---- Morning report config ----

export async function getMorningReportConfig(): Promise<{
  enabled: boolean
  managerPhones: string[]
}> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("notification_templates")
    .select("template_body")
    .eq("event_type", MORNING_REPORT_EVENT_TYPE)
    .maybeSingle()

  if (!data?.template_body) return { enabled: false, managerPhones: [] }
  try {
    const cfg = JSON.parse(data.template_body) as {
      enabled?: boolean | string
      manager_phones?: string[]
    }
    const enabled = cfg.enabled === true || cfg.enabled === "true"
    return {
      enabled,
      managerPhones: Array.isArray(cfg.manager_phones) ? cfg.manager_phones : [],
    }
  } catch {
    return { enabled: false, managerPhones: [] }
  }
}

export async function upsertMorningReportConfig(
  enabled: boolean,
  managerPhones: string[]
): Promise<{ success: boolean; error?: string }> {
  const templateBody = JSON.stringify({ enabled, manager_phones: managerPhones })
  const result = await upsertNotificationTemplate(
    {
      event_type: MORNING_REPORT_EVENT_TYPE,
      name: "Morning Production Report Config",
      template_body: templateBody,
    },
    { allowMorningReportConfig: true }
  )
  if (!result.success) return { success: false, error: result.error ?? "Failed to save config" }
  return { success: true }
}

export async function sendMorningReportNow(): Promise<{
  success: boolean
  error?: string
  sent?: number
}> {
  // Storage uploads need service role (cron has no session) or RLS policies on the bucket.
  const supabaseForStorage =
    createServiceRoleSupabaseClient() ?? (await createClient())

  // Fetch production queue
  const queueResult = await getProductionQueue()
  if (!queueResult.success) {
    return { success: false, error: queueResult.error }
  }

  const pendingRows = queueResult.data.rows.filter((r) => r.remainingUntilDone > 0)

  // Fetch logo best-effort
  let logoDataUrl: string | undefined
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")
  if (appUrl) {
    try {
      const logoRes = await fetch(`${appUrl}/images/logo.png`)
      if (logoRes.ok) {
        const logoBuffer = await logoRes.arrayBuffer()
        const base64 = Buffer.from(logoBuffer).toString("base64")
        logoDataUrl = `data:image/png;base64,${base64}`
      }
    } catch {
      // not critical
    }
  }

  // Generate PDF
  const { blob, filename } = generateMorningReportPDF(pendingRows, logoDataUrl)

  // Upload to Supabase storage
  const pdfBuffer = await blob.arrayBuffer()
  const pdfPath = `reports/${filename}`
  let pdfUrl = ""

  const { error: uploadError } = await supabaseForStorage.storage
    .from("production-reports")
    .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true })

  if (uploadError) {
    reportError(uploadError, { area: "notifications.sendMorningReportNow.storageUpload" })
  } else {
    const { data: urlData } = supabaseForStorage.storage
      .from("production-reports")
      .getPublicUrl(pdfPath)
    pdfUrl = urlData?.publicUrl ?? ""
  }

  // Fetch WhatsApp config
  const configRes = await getWhatsAppConfig()
  const waConfig = toServiceConfig(configRes.success ? configRes.data : null)

  if (!waConfig) {
    return { success: false, error: "WhatsApp not configured (missing endpoint, username, or password)" }
  }

  // Fetch manager phones
  const { managerPhones } = await getMorningReportConfig()
  if (managerPhones.length === 0) {
    return { success: false, error: "No manager phone numbers configured for morning report" }
  }

  // Build message
  const now = new Date()
  const dateStr = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  })

  const distinctOrders = new Set(pendingRows.map((r) => r.orderId)).size
  const totalRemaining = pendingRows.reduce((s, r) => s + r.remainingUntilDone, 0)
  const notStarted = pendingRows.filter(
    (r) => !r.hasInProductionRecord && !r.hasCompletedRecord
  ).length

  const message =
    `📊 *Morning Production Report — ${dateStr}*\n` +
    `\n` +
    `*Pending Orders:* ${distinctOrders}\n` +
    `*Total Units Remaining:* ${totalRemaining}\n` +
    `*Not Started:* ${notStarted}\n` +
    (pdfUrl ? `\n📄 Download Report: ${pdfUrl}\n` : "") +
    `\nPlease review and assign production tasks.`

  let sentCount = 0
  try {
    for (const phone of managerPhones) {
      if (!phone?.trim()) continue
      const result = await notificationService.sendMessage(waConfig, phone.trim(), message)
      if (result.ok) sentCount++
    }
  } catch (error) {
    reportError(error, { area: "notifications.sendMorningReportNow" })
    return { success: false, error: error instanceof Error ? error.message : "Failed to send" }
  }

  return { success: true, sent: sentCount }
}

/** Sends production record created notification (when "Create Production Record" is clicked). */
export async function sendProductionRecordCreatedNotification(payload: {
  order_number: string
  customer_name: string
  items: { name: string; quantity: number }[]
  order_id: string
}) {
  const sendRate = checkRateLimit("notifications:send:production_created", 60, 60_000)
  if (!sendRate.ok) {
    return
  }

  const [configRes, recipientsRes] = await Promise.all([
    getWhatsAppConfig(),
    getNotificationRecipients(),
  ])

  const config = toServiceConfig(configRes.success ? configRes.data : null)
  const recipients = (recipientsRes.success && recipientsRes.data
    ? recipientsRes.data as { id: string; name: string; phone: string; is_active: boolean }[]
    : []
  ).filter((r) => r.is_active)

  if (!config) {
    console.warn("[notifications] sendProductionRecordCreated: missing endpoint, username, or password; skipping send")
    return
  }
  if (recipients.length === 0) {
    console.warn("[notifications] sendProductionRecordCreated: no active recipients; skipping send")
    return
  }

  const phones = recipients.map((r) => r.phone?.trim()).filter(Boolean) as string[]
  const orderSystemBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://sunkool-management.vercel.app").replace(/\/$/, "")

  try {
    await notificationService.sendProductionRecordCreated(config, phones, {
      orderNumber: payload.order_number,
      customerName: payload.customer_name,
      items: payload.items,
      orderSystemBaseUrl,
      orderId: payload.order_id,
    })
  } catch (error) {
    reportError(error, { area: "notifications.sendProductionRecordCreated" })
  }
}
