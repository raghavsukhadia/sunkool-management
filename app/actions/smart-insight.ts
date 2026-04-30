"use server"

import { createClient } from "@/lib/supabase/server"
import { getProductionQueue } from "@/app/actions/production"
import { getShipmentsDashboard } from "@/app/actions/tracking"
import { getNotificationRecipients, getWhatsAppConfig } from "@/app/actions/notifications"
import * as notificationService from "@/lib/notificationService"
import { reportError } from "@/lib/monitoring"

type Priority = "High" | "Medium" | "Low"
type Timeframe = "today" | "next24h" | "week"
type TeamName = "Production" | "Dispatch"

export type SmartInsightKpis = {
  productionBacklogUnits: number
  dispatchReadyOrders: number
  overdueEtaShipments: number
  partialDeliveryRiskCount: number
  plannedVsCompletedToday: {
    planned: number
    completed: number
  }
}

export type SmartInsightPlanItem = {
  id: string
  team: TeamName
  priority: Priority
  title: string
  reason: string
  targetRef: string
}

export type SmartInsightRiskItem = {
  id: string
  severity: Priority
  type: string
  title: string
  detail: string
}

export type SmartInsightRecommendation = {
  id: string
  priority: Priority
  action: string
  reason: string
  actionIntent: {
    type: "prioritize_production" | "prepare_dispatch" | "escalate_tracking"
    refId: string
  }
}

export type SmartInsightTeamLoad = {
  team: TeamName
  pending: number
  critical: number
}

export type SmartInsightPayload = {
  generatedAt: string
  timeframe: Timeframe
  headlineKpis: SmartInsightKpis
  todayPlan: SmartInsightPlanItem[]
  criticalRisks: SmartInsightRiskItem[]
  autoOpsRecommendations: SmartInsightRecommendation[]
  teamLoadSummary: SmartInsightTeamLoad[]
  fromSnapshot: boolean
}

type OpsBriefResult = { success: true; sent: number } | { success: false; error: string }

function startOfTodayISO() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.toISOString()
}

function priorityByScore(score: number): Priority {
  if (score >= 80) return "High"
  if (score >= 50) return "Medium"
  return "Low"
}

function getDaysOld(isoDate?: string | null): number {
  if (!isoDate) return 0
  const then = new Date(isoDate)
  if (Number.isNaN(then.getTime())) return 0
  const now = Date.now()
  return Math.max(0, Math.floor((now - then.getTime()) / (1000 * 60 * 60 * 24)))
}

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

async function readSnapshot(timeframe: Timeframe): Promise<SmartInsightPayload | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("smart_insight_daily_snapshot")
    .select("payload, generated_at, timeframe")
    .eq("snapshot_date", new Date().toISOString().slice(0, 10))
    .eq("timeframe", timeframe)
    .maybeSingle()

  if (error) return null
  if (!data?.payload || typeof data.payload !== "object") return null
  return {
    ...(data.payload as SmartInsightPayload),
    fromSnapshot: true,
    generatedAt: data.generated_at ?? new Date().toISOString(),
    timeframe,
  }
}

async function upsertSnapshot(timeframe: Timeframe, payload: SmartInsightPayload) {
  const supabase = await createClient()
  await supabase.from("smart_insight_daily_snapshot").upsert(
    {
      snapshot_date: new Date().toISOString().slice(0, 10),
      timeframe,
      generated_at: new Date().toISOString(),
      payload,
    },
    { onConflict: "snapshot_date,timeframe" }
  )
}

export async function getSmartInsightData(
  timeframe: Timeframe = "today"
): Promise<{ success: true; data: SmartInsightPayload } | { success: false; error: string }> {
  const cached = await readSnapshot(timeframe)
  if (cached) return { success: true, data: cached }

  const supabase = await createClient()
  const todayISO = startOfTodayISO()

  const [queueRes, shipmentRes, readyOrdersRes, partialRiskRes, productionTodayRes, timelineRes] = await Promise.all([
    getProductionQueue(),
    getShipmentsDashboard(),
    supabase.from("orders").select("id").in("order_status", ["Ready for Dispatch", "Invoiced"]).range(0, 9999),
    supabase
      .from("orders")
      .select("id")
      .eq("order_status", "Partial Delivered")
      .in("payment_status", ["Pending", "Partial"])
      .range(0, 9999),
    supabase
      .from("production_records")
      .select("id, status, created_at, updated_at")
      .gte("created_at", todayISO)
      .range(0, 9999),
    supabase
      .from("order_timeline")
      .select("id, actor, actor_id, title, timestamp")
      .gte("timestamp", todayISO)
      .range(0, 9999),
  ])

  if (!queueRes.success) return { success: false, error: queueRes.error }
  if (!shipmentRes.success) return { success: false, error: shipmentRes.error ?? "Failed to load shipment data" }
  if (readyOrdersRes.error) return { success: false, error: readyOrdersRes.error.message }
  if (partialRiskRes.error) return { success: false, error: partialRiskRes.error.message }
  if (productionTodayRes.error) return { success: false, error: productionTodayRes.error.message }
  if (timelineRes.error) return { success: false, error: timelineRes.error.message }

  const queueRows = queueRes.data.rows
  const delayedOrderIds = new Set(queueRes.data.kpiData.delayedOrderIds)
  const shipments = safeArray(shipmentRes.data)
  const overdueShipments = shipments.filter((s) => s.is_delayed || s.is_stuck)
  const readyOrders = safeArray(readyOrdersRes.data)
  const partialRiskOrders = safeArray(partialRiskRes.data)
  const productionToday = safeArray(productionTodayRes.data)
  const timelineToday = safeArray(timelineRes.data)

  const headlineKpis: SmartInsightKpis = {
    productionBacklogUnits: queueRows.reduce((sum, r) => sum + Math.max(0, r.remainingUntilDone), 0),
    dispatchReadyOrders: readyOrders.length,
    overdueEtaShipments: overdueShipments.length,
    partialDeliveryRiskCount: partialRiskOrders.length,
    plannedVsCompletedToday: {
      planned: productionToday.length,
      completed: productionToday.filter((p) => String(p.status).toLowerCase() === "completed").length,
    },
  }

  const productionCandidates = queueRows
    .filter((row) => row.remainingUntilDone > 0)
    .map((row) => {
      const ageDays = getDaysOld(row.orderDate)
      const score = Math.min(100, row.remainingUntilDone * 0.8 + ageDays * 6 + (delayedOrderIds.has(row.orderId) ? 20 : 0))
      return {
        id: `prod-${row.orderId}-${row.itemId}`,
        team: "Production" as const,
        priority: priorityByScore(score),
        title: `Push production for ${row.orderNumber} (${row.itemName})`,
        reason: delayedOrderIds.has(row.orderId)
          ? `Order is delayed and has ${row.remainingUntilDone} units pending.`
          : `${row.remainingUntilDone} units pending with ${ageDays} days aging.`,
        targetRef: row.orderNumber,
        score,
      }
    })
    .sort((a, b) => b.score - a.score)

  const dispatchCandidates = overdueShipments
    .map((shipment) => {
      const score = shipment.is_stuck ? 95 : 85
      return {
        id: `disp-${shipment.dispatch_id}`,
        team: "Dispatch" as const,
        priority: priorityByScore(score),
        title: `Escalate tracking for ${shipment.order_number}`,
        reason: shipment.is_stuck
          ? "Shipment is stuck without ETA update for >7 days."
          : "Shipment ETA is overdue and needs customer communication.",
        targetRef: shipment.tracking_id ?? shipment.order_number,
        score,
      }
    })
    .sort((a, b) => b.score - a.score)

  const todayPlan: SmartInsightPlanItem[] = [...productionCandidates, ...dispatchCandidates]
    .sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "High" ? -1 : b.priority === "High" ? 1 : 0))
    .slice(0, 10)
    .map(({ score: _score, ...item }) => item)

  const criticalRisks: SmartInsightRiskItem[] = [
    ...overdueShipments.slice(0, 5).map((s) => ({
      id: `risk-track-${s.dispatch_id}`,
      severity: "High" as const,
      type: "dispatch",
      title: `Shipment at risk: ${s.order_number}`,
      detail: s.is_stuck ? "No ETA update for more than 7 days." : "ETA missed for active shipment.",
    })),
    ...queueRows
      .filter((r) => delayedOrderIds.has(r.orderId) && r.remainingUntilDone > 0)
      .slice(0, 5)
      .map((r) => ({
        id: `risk-prod-${r.orderId}-${r.itemId}`,
        severity: "High" as const,
        type: "production",
        title: `Production delay: ${r.orderNumber}`,
        detail: `${r.itemName} has ${r.remainingUntilDone} units pending.`,
      })),
  ].slice(0, 8)

  const autoOpsRecommendations: SmartInsightRecommendation[] = [
    ...productionCandidates.slice(0, 4).map((p) => ({
      id: `rec-${p.id}`,
      priority: p.priority,
      action: `Prioritize ${p.targetRef} in next production slot`,
      reason: p.reason,
      actionIntent: {
        type: "prioritize_production" as const,
        refId: p.targetRef,
      },
    })),
    ...readyOrders.slice(0, 3).map((order) => ({
      id: `rec-dispatch-${order.id}`,
      priority: "Medium" as const,
      action: "Prepare dispatch plan and courier slot",
      reason: "Order is ready/invoiced and can be dispatched today.",
      actionIntent: {
        type: "prepare_dispatch" as const,
        refId: order.id,
      },
    })),
    ...overdueShipments.slice(0, 3).map((s) => ({
      id: `rec-track-${s.dispatch_id}`,
      priority: "High" as const,
      action: `Escalate courier update for ${s.order_number}`,
      reason: s.is_stuck ? "Stuck shipment detected." : "ETA overdue shipment detected.",
      actionIntent: {
        type: "escalate_tracking" as const,
        refId: s.dispatch_id,
      },
    })),
  ].slice(0, 10)

  const productionEvents = timelineToday.filter((e) =>
    String(e.title ?? "").toLowerCase().includes("production")
  ).length
  const dispatchEvents = timelineToday.filter((e) =>
    String(e.title ?? "").toLowerCase().includes("shipment") ||
    String(e.title ?? "").toLowerCase().includes("dispatch")
  ).length

  const teamLoadSummary: SmartInsightTeamLoad[] = [
    {
      team: "Production",
      pending: productionCandidates.length,
      critical: productionCandidates.filter((p) => p.priority === "High").length + productionEvents,
    },
    {
      team: "Dispatch",
      pending: dispatchCandidates.length + readyOrders.length,
      critical: dispatchCandidates.filter((d) => d.priority === "High").length + dispatchEvents,
    },
  ]

  const payload: SmartInsightPayload = {
    generatedAt: new Date().toISOString(),
    timeframe,
    headlineKpis,
    todayPlan,
    criticalRisks,
    autoOpsRecommendations,
    teamLoadSummary,
    fromSnapshot: false,
  }

  void upsertSnapshot(timeframe, payload)

  return { success: true, data: payload }
}

export async function sendSmartInsightOpsBrief(timeframe: Timeframe = "today"): Promise<OpsBriefResult> {
  const autoSendEnabled = (process.env.SMART_INSIGHT_AUTO_ALERTS_ENABLED ?? "false") === "true"
  if (!autoSendEnabled) {
    return { success: false, error: "Smart Insight auto alerts are disabled. Enable SMART_INSIGHT_AUTO_ALERTS_ENABLED=true." }
  }

  const insight = await getSmartInsightData(timeframe)
  if (!insight.success) return { success: false, error: insight.error }

  const [configRes, recipientsRes] = await Promise.all([getWhatsAppConfig(), getNotificationRecipients()])
  const config = configRes.success ? configRes.data : null
  if (!config?.api_endpoint_url || !config.user_id || !config.password) {
    return { success: false, error: "WhatsApp config is incomplete." }
  }
  const recipients = recipientsRes.success ? safeArray(recipientsRes.data) : []
  const phones = recipients.filter((r) => r.is_active && r.phone?.trim()).map((r) => r.phone.trim())
  if (phones.length === 0) return { success: false, error: "No active recipients configured." }

  const data = insight.data
  const topActions = data.todayPlan.slice(0, 3).map((item, idx) => `${idx + 1}. ${item.title}`).join("\n")
  const message =
    `Smart Insight Ops Brief\n` +
    `Backlog Units: ${data.headlineKpis.productionBacklogUnits}\n` +
    `Dispatch Ready: ${data.headlineKpis.dispatchReadyOrders}\n` +
    `Overdue ETA: ${data.headlineKpis.overdueEtaShipments}\n\n` +
    `Top Actions:\n${topActions}`

  try {
    const results = await notificationService.sendMessageToRecipients(
      {
        url: config.api_endpoint_url,
        username: config.user_id,
        password: config.password,
      },
      phones,
      message
    )
    const sent = results.filter((r) => r.ok).length
    return { success: true, sent }
  } catch (error) {
    reportError(error, { area: "smart-insight.sendSmartInsightOpsBrief" })
    return { success: false, error: error instanceof Error ? error.message : "Failed to send smart insight brief." }
  }
}
