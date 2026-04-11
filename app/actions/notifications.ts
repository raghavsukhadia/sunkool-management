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

// ─────────────────────────────────────────────────────────────────────────────
// ETA Delivery Reminder
// Stored as JSON in notification_templates (event_type = 'eta_reminder_config').
// ─────────────────────────────────────────────────────────────────────────────

const ETA_REMINDER_EVENT_TYPE = "eta_reminder_config"

const DEFAULT_ETA_REMINDER_TEMPLATE =
  `📦 *ETA Delivery Reminder — {{date}}*\n` +
  `\n` +
  `*{{count}} shipment(s) due today — please confirm delivery status:*\n` +
  `\n` +
  `{{shipment_list}}\n` +
  `\n` +
  `Please update each order's status in the system.`

export type EtaReminderConfig = {
  enabled:  boolean
  phones:   string[]
  template: string
}

export type EtaReminderLog = {
  id:             string
  sent_at:        string
  reminder_date:  string
  shipment_count: number
  sent_count:     number
  status:         string
  error_message:  string | null
}

/** Returns stored config or safe defaults. */
export async function getEtaReminderConfig(): Promise<EtaReminderConfig> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("notification_templates")
    .select("template_body")
    .eq("event_type", ETA_REMINDER_EVENT_TYPE)
    .maybeSingle()

  if (!data?.template_body) {
    return { enabled: false, phones: [], template: DEFAULT_ETA_REMINDER_TEMPLATE }
  }
  try {
    const cfg = JSON.parse(data.template_body) as {
      enabled?:  boolean | string
      phones?:   string[]
      template?: string
    }
    return {
      enabled:  cfg.enabled === true || cfg.enabled === "true",
      phones:   Array.isArray(cfg.phones) ? cfg.phones : [],
      template: typeof cfg.template === "string" && cfg.template.trim()
        ? cfg.template
        : DEFAULT_ETA_REMINDER_TEMPLATE,
    }
  } catch {
    return { enabled: false, phones: [], template: DEFAULT_ETA_REMINDER_TEMPLATE }
  }
}

/** Persists enabled flag, phone list, and template as JSON. */
export async function upsertEtaReminderConfig(
  enabled:  boolean,
  phones:   string[],
  template: string
): Promise<{ success: boolean; error?: string }> {
  const body = JSON.stringify({ enabled, phones, template })
  const result = await upsertNotificationTemplate({
    event_type:    ETA_REMINDER_EVENT_TYPE,
    name:          "ETA Delivery Reminder Config",
    template_body: body,
  })
  if (!result.success) return { success: false, error: result.error ?? "Failed to save config" }
  return { success: true }
}

/** Returns the last 10 reminder send logs. */
export async function getEtaReminderLogs(): Promise<{
  success: boolean
  data:    EtaReminderLog[] | null
  error:   string | null
}> {
  const supabase = createServiceRoleSupabaseClient() ?? await createClient()
  const { data, error } = await supabase
    .from("tracking_reminder_log")
    .select("id, sent_at, reminder_date, shipment_count, sent_count, status, error_message")
    .order("sent_at", { ascending: false })
    .limit(10)
  if (error) return { success: false, data: null, error: error.message }
  return { success: true, data: data ?? [], error: null }
}

/** Returns count of undelivered shipments whose ETA is today (IST). */
export async function getEtaDueTodayCount(): Promise<{ count: number; error: string | null }> {
  const supabase = createServiceRoleSupabaseClient() ?? await createClient()
  const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
  const TERMINAL = ["delivered", "cancelled", "returned", "rto_initiated"]

  const { data, error } = await supabase
    .from("dispatches")
    .select("id, shipment_status")
    .lte("estimated_delivery", todayIST)
    .not("estimated_delivery", "is", null)
    .neq("dispatch_type", "return")

  if (error) return { count: 0, error: error.message }
  const count = (data ?? []).filter((r) => !TERMINAL.includes(r.shipment_status)).length
  return { count, error: null }
}

/** Queries today's due shipments and sends WhatsApp reminders. Used by both UI "Send Now" and cron. */
export async function sendEtaReminderNow(): Promise<{
  success:       boolean
  error?:        string
  sent?:         number
  shipmentCount?: number
}> {
  const supabase = createServiceRoleSupabaseClient() ?? await createClient()

  // WhatsApp credentials
  const configRes = await getWhatsAppConfig()
  const waConfig  = toServiceConfig(configRes.success ? configRes.data : null)
  if (!waConfig) {
    return { success: false, error: "WhatsApp not configured (missing endpoint, username, or password)" }
  }

  // Reminder config
  const { phones, template } = await getEtaReminderConfig()
  if (phones.length === 0) {
    return { success: false, error: "No phone numbers configured for ETA reminder" }
  }

  // Today's IST date string (YYYY-MM-DD)
  const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
  const TERMINAL = ["delivered", "cancelled", "returned", "rto_initiated"]

  const { data: rawShipments, error: fetchError } = await supabase
    .from("dispatches")
    .select(`
      id,
      tracking_id,
      shipment_status,
      orders (
        internal_order_number,
        sales_order_number,
        customers:customer_id ( name )
      ),
      courier_companies ( name )
    `)
    .lte("estimated_delivery", todayIST)
    .not("estimated_delivery", "is", null)
    .neq("dispatch_type", "return")
    .order("estimated_delivery", { ascending: true })
    .order("created_at", { ascending: false })

  if (fetchError) {
    return { success: false, error: `Failed to fetch shipments: ${fetchError.message}` }
  }

  const shipments = (rawShipments ?? []).filter(
    (s: any) => !TERMINAL.includes(s.shipment_status)
  )

  if (shipments.length === 0) {
    await supabase.from("tracking_reminder_log").insert({
      reminder_date:   todayIST,
      shipment_count:  0,
      sent_count:      0,
      phones_notified: phones,
      dispatch_ids:    [],
      status:          "skipped",
    })
    return { success: true, sent: 0, shipmentCount: 0 }
  }

  // Build message
  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  })

  const STATUS_LABELS: Record<string, string> = {
    pending:          "Pending",
    ready:            "Ready for Pickup",
    picked_up:        "Picked Up",
    in_transit:       "In Transit",
    out_for_delivery: "Out for Delivery",
    failed_delivery:  "Failed Delivery",
    rto_initiated:    "RTO Initiated",
  }

  const shipmentList = shipments.map((s: any, i: number) => {
    const order      = Array.isArray(s.orders)           ? s.orders[0]           : s.orders
    const cust       = Array.isArray(order?.customers)   ? order.customers[0]    : order?.customers
    const courier    = Array.isArray(s.courier_companies)? s.courier_companies[0]: s.courier_companies
    const orderNo    = order?.internal_order_number || order?.sales_order_number || "—"
    const statusLabel = STATUS_LABELS[s.shipment_status] ?? s.shipment_status ?? "—"
    const etaLabel    = s.estimated_delivery
      ? new Date(s.estimated_delivery).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" })
      : "—"
    const overdue = s.estimated_delivery && s.estimated_delivery < todayIST ? " ⚠️" : ""
    return `${i + 1}. Order #${orderNo} | ${cust?.name ?? "—"} | ${courier?.name ?? "—"} | ${s.tracking_id ?? "—"} | *${statusLabel}* | ETA: ${etaLabel}${overdue}`
  }).join("\n")

  const message = template
    .replace(/\{\{date\}\}/g, dateStr)
    .replace(/\{\{count\}\}/g, String(shipments.length))
    .replace(/\{\{shipment_list\}\}/g, shipmentList)

  let sentCount = 0
  const sendErrors: string[] = []
  for (const phone of phones) {
    if (!phone?.trim()) continue
    const result = await notificationService.sendMessage(waConfig, phone.trim(), message)
    if (result.ok) sentCount++
    else if (result.error) sendErrors.push(`${phone}: ${result.error}`)
  }

  await supabase.from("tracking_reminder_log").insert({
    reminder_date:   todayIST,
    shipment_count:  shipments.length,
    sent_count:      sentCount,
    phones_notified: phones,
    dispatch_ids:    shipments.map((s: any) => s.id),
    status:          sentCount > 0 ? "sent" : "failed",
    error_message:   sendErrors.length > 0 ? sendErrors.join("; ") : null,
  })

  if (sentCount === 0) {
    return {
      success:       false,
      error:         `No messages sent. ${sendErrors.join("; ")}`,
      shipmentCount: shipments.length,
    }
  }

  return { success: true, sent: sentCount, shipmentCount: shipments.length }
}
