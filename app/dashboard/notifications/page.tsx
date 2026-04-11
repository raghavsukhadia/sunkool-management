"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Bell, UserPlus, MessageSquare, Settings, Trash2, Edit2, Monitor, BarChart2, Send, Clock, Truck, Package } from "lucide-react"
import {
  getNotificationRecipients,
  createNotificationRecipient,
  updateNotificationRecipient,
  deleteNotificationRecipient,
  getWhatsAppConfig,
  upsertWhatsAppConfig,
  getNotificationTemplates,
  upsertNotificationTemplate,
  getMorningReportConfig,
  upsertMorningReportConfig,
  sendMorningReportNow,
  getEtaReminderConfig,
  upsertEtaReminderConfig,
  sendEtaReminderNow,
  getEtaReminderLogs,
  getEtaDueTodayCount,
  type EtaReminderLog,
  type EtaReminderConfig,
} from "@/app/actions/notifications"

type Recipient = { id: string; name: string; phone: string; is_active: boolean }
type WhatsAppConfig = {
  id: string
  provider: string | null
  user_id: string | null
  password: string | null
  api_key: string | null
  api_endpoint_url: string | null
} | null
type Template = { id: string; event_type: string; name: string | null; template_body: string }

const EVENT_TYPES = [{ value: "order_created", label: "Order created (punched)" }]
const MORNING_REPORT_EVENT_TYPE = "morning_report_config"
const ETA_REMINDER_EVENT_TYPE   = "eta_reminder_config"
const PLACEHOLDERS = "Placeholders: {{order_number}}, {{customer_name}}, {{sales_order_number}}"

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const m = window.matchMedia("(max-width: 1023px)")
    setIsMobile(m.matches)
    const listener = () => setIsMobile(m.matches)
    m.addEventListener("change", listener)
    return () => m.removeEventListener("change", listener)
  }, [])
  return isMobile
}

export default function NotificationsPage() {
  const isMobile = useIsMobile()
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [config, setConfig] = useState<WhatsAppConfig>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Recipients form
  const [recipientName, setRecipientName] = useState("")
  const [recipientPhone, setRecipientPhone] = useState("")
  const [savingRecipient, setSavingRecipient] = useState(false)
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null)

  // WhatsApp config form
  const [provider, setProvider] = useState("")
  const [userId, setUserId] = useState("")
  const [password, setPassword] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [apiEndpointUrl, setApiEndpointUrl] = useState("")
  const [savingConfig, setSavingConfig] = useState(false)

  // Template form
  const [templateEventType, setTemplateEventType] = useState("order_created")
  const [templateName, setTemplateName] = useState("")
  const [templateBody, setTemplateBody] = useState("")
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)

  // Morning report
  const [morningReportEnabled, setMorningReportEnabled] = useState(false)
  const [managerPhones, setManagerPhones] = useState<string[]>([])
  const [newManagerPhone, setNewManagerPhone] = useState("")
  const [savingMorningConfig, setSavingMorningConfig] = useState(false)
  const [sendingReport, setSendingReport] = useState(false)
  const [reportSendResult, setReportSendResult] = useState<string | null>(null)

  // ETA Delivery Reminder
  const [etaEnabled,         setEtaEnabled]         = useState(false)
  const [etaPhones,          setEtaPhones]           = useState<string[]>([])
  const [etaTemplate,        setEtaTemplate]         = useState("")
  const [etaLogs,            setEtaLogs]             = useState<EtaReminderLog[]>([])
  const [etaTodayCount,      setEtaTodayCount]       = useState<number | null>(null)
  const [newEtaPhone,        setNewEtaPhone]         = useState("")
  const [savingEtaConfig,    setSavingEtaConfig]     = useState(false)
  const [sendingEtaReminder, setSendingEtaReminder]  = useState(false)
  const [etaSendResult,      setEtaSendResult]       = useState<{ ok: boolean; msg: string } | null>(null)

  const loadAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [rRes, cRes, tRes, mrRes, etaRes, etaLogsRes, etaTodayRes] = await Promise.all([
        getNotificationRecipients(),
        getWhatsAppConfig(),
        getNotificationTemplates(),
        getMorningReportConfig(),
        getEtaReminderConfig(),
        getEtaReminderLogs(),
        getEtaDueTodayCount(),
      ])
      if (rRes.success && rRes.data) setRecipients(rRes.data as Recipient[])
      if (cRes.success && cRes.data) {
        const c = cRes.data as WhatsAppConfig
        setConfig(c)
        if (c) {
          setProvider(c.provider ?? "")
          setUserId(c.user_id ?? "")
          setPassword(c.password ?? "")
          setApiKey(c.api_key ?? "")
          setApiEndpointUrl(c.api_endpoint_url ?? "")
        }
      }
      if (tRes.success && tRes.data) setTemplates(tRes.data as Template[])
      setMorningReportEnabled(mrRes.enabled)
      setManagerPhones(mrRes.managerPhones)
      // ETA reminder
      setEtaEnabled(etaRes.enabled)
      setEtaPhones(etaRes.phones)
      setEtaTemplate(etaRes.template)
      if (etaLogsRes.success && etaLogsRes.data) setEtaLogs(etaLogsRes.data)
      setEtaTodayCount(etaTodayRes.count)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const handleAddRecipient = async () => {
    if (!recipientName.trim() || !recipientPhone.trim()) {
      setError("Name and phone are required")
      return
    }
    setSavingRecipient(true)
    setError(null)
    try {
      const result = await createNotificationRecipient(recipientName.trim(), recipientPhone.trim())
      if (result.success) {
        setSuccess("Recipient added")
        setRecipientName("")
        setRecipientPhone("")
        await loadAll()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error ?? "Failed to add recipient")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add")
    } finally {
      setSavingRecipient(false)
    }
  }

  const handleUpdateRecipient = async () => {
    if (!editingRecipient) return
    if (!recipientName.trim() || !recipientPhone.trim()) {
      setError("Name and phone are required")
      return
    }
    setSavingRecipient(true)
    setError(null)
    try {
      const result = await updateNotificationRecipient(editingRecipient.id, {
        name: recipientName.trim(),
        phone: recipientPhone.trim(),
      })
      if (result.success) {
        setSuccess("Recipient updated")
        setEditingRecipient(null)
        setRecipientName("")
        setRecipientPhone("")
        await loadAll()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error ?? "Failed to update")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update")
    } finally {
      setSavingRecipient(false)
    }
  }

  const handleToggleRecipientActive = async (r: Recipient) => {
    try {
      await updateNotificationRecipient(r.id, { is_active: !r.is_active })
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update")
    }
  }

  const handleDeleteRecipient = async (id: string) => {
    if (!confirm("Remove this recipient?")) return
    try {
      const result = await deleteNotificationRecipient(id)
      if (result.success) {
        setSuccess("Recipient removed")
        if (editingRecipient?.id === id) {
          setEditingRecipient(null)
          setRecipientName("")
          setRecipientPhone("")
        }
        await loadAll()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error ?? "Failed to delete")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete")
    }
  }

  const handleSaveConfig = async () => {
    setSavingConfig(true)
    setError(null)
    try {
      const result = await upsertWhatsAppConfig({
        provider: provider || undefined,
        user_id: userId || undefined,
        password: password || undefined,
        api_key: apiKey || undefined,
        api_endpoint_url: apiEndpointUrl || undefined,
      })
      if (result.success) {
        setSuccess("WhatsApp configuration saved")
        await loadAll()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error ?? "Failed to save config")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSavingConfig(false)
    }
  }

  const handleSaveTemplate = async () => {
    if (!templateBody.trim()) {
      setError("Template body is required")
      return
    }
    setSavingTemplate(true)
    setError(null)
    try {
      const result = await upsertNotificationTemplate({
        event_type: templateEventType,
        name: templateName.trim() || undefined,
        template_body: templateBody.trim(),
      })
      if (result.success) {
        setSuccess(editingTemplate ? "Template updated" : "Template saved")
        setEditingTemplate(null)
        setTemplateName("")
        setTemplateBody("")
        await loadAll()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error ?? "Failed to save template")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSavingTemplate(false)
    }
  }

  const startEditTemplate = (t: Template) => {
    if (t.event_type === MORNING_REPORT_EVENT_TYPE) {
      setError(
        "Morning report uses JSON settings in the card above — do not edit it here (that breaks the cron). Use the Morning Production Report section."
      )
      return
    }
    if (t.event_type === ETA_REMINDER_EVENT_TYPE) {
      setError(
        "ETA reminder settings are managed in the ETA Delivery Reminder card — do not edit it here. Use that section to change the template."
      )
      return
    }
    setEditingTemplate(t)
    setTemplateEventType(t.event_type)
    setTemplateName(t.name ?? "")
    setTemplateBody(t.template_body)
  }

  const cancelEditTemplate = () => {
    setEditingTemplate(null)
    setTemplateName("")
    setTemplateBody("")
    setTemplateEventType("order_created")
  }

  const handleToggleMorningReport = async (enabled: boolean) => {
    const previous = morningReportEnabled
    setMorningReportEnabled(enabled)
    setSavingMorningConfig(true)
    setError(null)
    try {
      const result = await upsertMorningReportConfig(enabled, managerPhones)
      if (!result.success) {
        setMorningReportEnabled(previous)
        setError(result.error ?? "Failed to save morning report config")
      }
    } catch (e) {
      setMorningReportEnabled(previous)
      setError(e instanceof Error ? e.message : "Failed to save morning report config")
    } finally {
      setSavingMorningConfig(false)
    }
  }

  const handleAddManagerPhone = async () => {
    const phone = newManagerPhone.trim()
    if (!phone) return
    if (!/^\+\d{10,13}$/.test(phone)) {
      setError("Phone must start with + followed by 10–13 digits (e.g. +91XXXXXXXXXX)")
      return
    }
    if (managerPhones.includes(phone)) {
      setError("This phone number is already added")
      return
    }
    setError(null)
    const previousPhones = [...managerPhones]
    const updated = [...managerPhones, phone]
    setManagerPhones(updated)
    setNewManagerPhone("")
    setSavingMorningConfig(true)
    try {
      const result = await upsertMorningReportConfig(morningReportEnabled, updated)
      if (!result.success) {
        setManagerPhones(previousPhones)
        setError(result.error ?? "Failed to save")
      }
    } catch (e) {
      setManagerPhones(previousPhones)
      setError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSavingMorningConfig(false)
    }
  }

  const handleRemoveManagerPhone = async (phone: string) => {
    const previousPhones = [...managerPhones]
    const updated = managerPhones.filter((p) => p !== phone)
    setManagerPhones(updated)
    setSavingMorningConfig(true)
    setError(null)
    try {
      const result = await upsertMorningReportConfig(morningReportEnabled, updated)
      if (!result.success) {
        setManagerPhones(previousPhones)
        setError(result.error ?? "Failed to save")
      }
    } catch (e) {
      setManagerPhones(previousPhones)
      setError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSavingMorningConfig(false)
    }
  }

  const handleSendReportNow = async () => {
    setSendingReport(true)
    setReportSendResult(null)
    setError(null)
    try {
      const result = await sendMorningReportNow()
      if (result.success) {
        setReportSendResult(`Report sent to ${result.sent} recipient(s) successfully.`)
        setTimeout(() => setReportSendResult(null), 6000)
      } else {
        setError(result.error ?? "Failed to send report")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send report")
    } finally {
      setSendingReport(false)
    }
  }

  // ── ETA Reminder handlers ────────────────────────────────────────────────

  const handleToggleEtaEnabled = async (enabled: boolean) => {
    const prev = etaEnabled
    setEtaEnabled(enabled)
    setSavingEtaConfig(true)
    setError(null)
    try {
      const res = await upsertEtaReminderConfig(enabled, etaPhones, etaTemplate)
      if (!res.success) {
        setEtaEnabled(prev)
        setError(res.error ?? "Failed to save ETA reminder config")
      }
    } catch (e) {
      setEtaEnabled(prev)
      setError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSavingEtaConfig(false)
    }
  }

  const handleSaveEtaTemplate = async () => {
    if (!etaTemplate.trim()) { setError("Template cannot be empty"); return }
    setSavingEtaConfig(true)
    setError(null)
    try {
      const res = await upsertEtaReminderConfig(etaEnabled, etaPhones, etaTemplate.trim())
      if (!res.success) setError(res.error ?? "Failed to save template")
      else { setSuccess("ETA reminder template saved"); setTimeout(() => setSuccess(null), 3000) }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save template")
    } finally {
      setSavingEtaConfig(false)
    }
  }

  const handleAddEtaPhone = async () => {
    const phone = newEtaPhone.trim()
    if (!phone) return
    if (!/^\+\d{10,13}$/.test(phone)) {
      setError("Phone must start with + followed by 10–13 digits (e.g. +91XXXXXXXXXX)")
      return
    }
    if (etaPhones.includes(phone)) { setError("This phone number is already added"); return }
    setError(null)
    const prev    = [...etaPhones]
    const updated = [...etaPhones, phone]
    setEtaPhones(updated)
    setNewEtaPhone("")
    setSavingEtaConfig(true)
    try {
      const res = await upsertEtaReminderConfig(etaEnabled, updated, etaTemplate)
      if (!res.success) { setEtaPhones(prev); setError(res.error ?? "Failed to save") }
    } catch (e) {
      setEtaPhones(prev); setError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSavingEtaConfig(false)
    }
  }

  const handleRemoveEtaPhone = async (phone: string) => {
    const prev    = [...etaPhones]
    const updated = etaPhones.filter((p) => p !== phone)
    setEtaPhones(updated)
    setSavingEtaConfig(true)
    setError(null)
    try {
      const res = await upsertEtaReminderConfig(etaEnabled, updated, etaTemplate)
      if (!res.success) { setEtaPhones(prev); setError(res.error ?? "Failed to save") }
    } catch (e) {
      setEtaPhones(prev); setError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSavingEtaConfig(false)
    }
  }

  const handleSendEtaReminderNow = async () => {
    setSendingEtaReminder(true)
    setEtaSendResult(null)
    setError(null)
    try {
      const res = await sendEtaReminderNow()
      if (res.success) {
        const msg = res.shipmentCount === 0
          ? "No undelivered shipments due today — nothing to send."
          : `✓ Reminder sent to ${res.sent} recipient(s) for ${res.shipmentCount} shipment(s).`
        setEtaSendResult({ ok: true, msg })
        setTimeout(() => setEtaSendResult(null), 8000)
        await loadAll() // refresh logs
      } else {
        setEtaSendResult({ ok: false, msg: res.error ?? "Failed to send reminder" })
      }
    } catch (e) {
      setEtaSendResult({ ok: false, msg: e instanceof Error ? e.message : "Failed to send" })
    } finally {
      setSendingEtaReminder(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Notifications</h1>
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-slate-500">Loading...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-2">
          <Bell className="h-6 w-6 lg:h-8 lg:w-8 text-blue-600" />
          Notifications
        </h1>
        <Card className="border-amber-200 border-l-4 bg-amber-50/50">
          <CardContent className="py-8 px-6">
            <div className="flex flex-col items-center text-center gap-4">
              <Monitor className="h-12 w-12 text-slate-400" />
              <p className="text-slate-700 font-medium">
                Notifications configuration is available on desktop. Please open this page on a computer to manage recipients and WhatsApp settings.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
          <Bell className="h-8 w-8 text-blue-600" />
          Notifications
        </h1>
        <p className="text-slate-600 mt-2">
          Configure WhatsApp notifications for workflow events (e.g. notify production when an order is punched).
          Recipients, provider config, and message templates are used by your messenger auto sender.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Morning Production Report */}
      <Card className="border-slate-200 border-l-4 border-l-orange-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-orange-500" />
            Morning Production Report
          </CardTitle>
          <CardDescription>
            Automatically generates a PDF of the pending production queue and sends it via WhatsApp to configured manager phone numbers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Enable toggle */}
          <div className="flex items-center gap-3">
            <input
              id="morning-report-toggle"
              type="checkbox"
              className="h-4 w-4 accent-orange-500 cursor-pointer"
              checked={morningReportEnabled}
              disabled={savingMorningConfig}
              onChange={(e) => handleToggleMorningReport(e.target.checked)}
            />
            <Label htmlFor="morning-report-toggle" className="cursor-pointer select-none">
              {morningReportEnabled ? "Morning report enabled" : "Morning report disabled"}
            </Label>
            {savingMorningConfig && <span className="text-xs text-slate-400">Saving...</span>}
          </div>

          {/* Schedule info */}
          <div className="flex items-center gap-2 rounded-md bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm text-slate-600">
            <Clock className="h-4 w-4 text-slate-400 shrink-0" />
            <span>Sent daily at <strong>2:45 PM IST</strong> (9:15 AM UTC) via Vercel Cron</span>
          </div>

          {/* Manager phones */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-slate-700">Manager phone numbers</Label>
            {managerPhones.length === 0 ? (
              <p className="text-sm text-slate-500">No manager phones added yet.</p>
            ) : (
              <ul className="space-y-2">
                {managerPhones.map((phone) => (
                  <li key={phone} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-mono text-sm text-slate-800">{phone}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveManagerPhone(phone)}
                      disabled={savingMorningConfig}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="new-manager-phone" className="text-xs text-slate-500">Add phone number</Label>
                <Input
                  id="new-manager-phone"
                  value={newManagerPhone}
                  onChange={(e) => setNewManagerPhone(e.target.value)}
                  placeholder="+91XXXXXXXXXX"
                  className="w-52"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddManagerPhone() }}
                />
              </div>
              <Button
                variant="outline"
                onClick={handleAddManagerPhone}
                disabled={savingMorningConfig || !newManagerPhone.trim()}
              >
                Add
              </Button>
            </div>
          </div>

          {/* Send now */}
          <div className="border-t pt-4 flex flex-col gap-2">
            <Button
              onClick={handleSendReportNow}
              disabled={sendingReport || managerPhones.length === 0}
              className="w-fit bg-orange-600 hover:bg-orange-700 text-white gap-2"
            >
              <Send className="h-4 w-4" />
              {sendingReport ? "Sending..." : "Send Test Report Now"}
            </Button>
            {managerPhones.length === 0 && (
              <p className="text-xs text-slate-400">Add at least one manager phone to send.</p>
            )}
            {reportSendResult && (
              <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                {reportSendResult}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── ETA Delivery Reminder ── */}
      <Card className="border-slate-200 border-l-4 border-l-teal-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-teal-500" />
            ETA Delivery Reminder
          </CardTitle>
          <CardDescription>
            Sends a daily WhatsApp message listing all shipments whose ETA is today but aren&apos;t yet marked as delivered. Helps the team follow up and update delivery status promptly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Enable toggle */}
          <div className="flex items-center gap-3">
            <input
              id="eta-reminder-toggle"
              type="checkbox"
              className="h-4 w-4 accent-teal-500 cursor-pointer"
              checked={etaEnabled}
              disabled={savingEtaConfig}
              onChange={(e) => handleToggleEtaEnabled(e.target.checked)}
            />
            <Label htmlFor="eta-reminder-toggle" className="cursor-pointer select-none">
              {etaEnabled ? "ETA reminder enabled" : "ETA reminder disabled"}
            </Label>
            {savingEtaConfig && <span className="text-xs text-slate-400">Saving…</span>}
          </div>

          {/* Schedule info */}
          <div className="flex items-center gap-2 rounded-md bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm text-slate-600">
            <Clock className="h-4 w-4 text-slate-400 shrink-0" />
            <span>Sent daily at <strong>10:00 AM IST</strong> (4:30 AM UTC) via Vercel Cron</span>
          </div>

          {/* Due today count */}
          {etaTodayCount !== null && (
            <div className={`flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm ${etaTodayCount > 0 ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-green-50 border-green-200 text-green-700"}`}>
              <Package className="h-4 w-4 shrink-0" />
              {etaTodayCount > 0
                ? <span><strong>{etaTodayCount}</strong> shipment(s) with ETA today are not yet marked delivered.</span>
                : <span>No pending shipments due today.</span>
              }
            </div>
          )}

          {/* Message template */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Message template</Label>
            <p className="text-xs text-slate-500">
              Placeholders:{" "}
              <code className="rounded bg-slate-100 px-1">{"{{date}}"}</code> — today&apos;s date,{" "}
              <code className="rounded bg-slate-100 px-1">{"{{count}}"}</code> — number of shipments,{" "}
              <code className="rounded bg-slate-100 px-1">{"{{shipment_list}}"}</code> — auto-generated order list
            </p>
            <textarea
              className="flex min-h-[130px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              value={etaTemplate}
              onChange={(e) => setEtaTemplate(e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveEtaTemplate}
              disabled={savingEtaConfig}
            >
              {savingEtaConfig ? "Saving…" : "Save template"}
            </Button>
          </div>

          {/* Phone numbers */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-slate-700">Phone numbers to notify</Label>
            {etaPhones.length === 0 ? (
              <p className="text-sm text-slate-500">No phones added yet.</p>
            ) : (
              <ul className="space-y-2">
                {etaPhones.map((phone) => (
                  <li key={phone} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-mono text-sm text-slate-800">{phone}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEtaPhone(phone)}
                      disabled={savingEtaConfig}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="new-eta-phone" className="text-xs text-slate-500">Add phone number</Label>
                <Input
                  id="new-eta-phone"
                  value={newEtaPhone}
                  onChange={(e) => setNewEtaPhone(e.target.value)}
                  placeholder="+91XXXXXXXXXX"
                  className="w-52"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddEtaPhone() }}
                />
              </div>
              <Button
                variant="outline"
                onClick={handleAddEtaPhone}
                disabled={savingEtaConfig || !newEtaPhone.trim()}
              >
                Add
              </Button>
            </div>
          </div>

          {/* Send now + result */}
          <div className="border-t pt-4 space-y-4">
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleSendEtaReminderNow}
                disabled={sendingEtaReminder || etaPhones.length === 0}
                className="w-fit bg-teal-600 hover:bg-teal-700 text-white gap-2"
              >
                <Send className="h-4 w-4" />
                {sendingEtaReminder ? "Sending…" : "Send Reminder Now"}
              </Button>
              {etaPhones.length === 0 && (
                <p className="text-xs text-slate-400">Add at least one phone number to send.</p>
              )}
              {etaSendResult && (
                <div className={`rounded-md border px-3 py-2 text-sm ${etaSendResult.ok ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                  {etaSendResult.msg}
                </div>
              )}
            </div>

            {/* Recent send log */}
            {etaLogs.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Recent sends</p>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-left">
                        <th className="px-3 py-2 font-semibold text-slate-600">Sent at (IST)</th>
                        <th className="px-3 py-2 font-semibold text-slate-600">ETA Date</th>
                        <th className="px-3 py-2 font-semibold text-slate-600">Shipments</th>
                        <th className="px-3 py-2 font-semibold text-slate-600">Delivered to</th>
                        <th className="px-3 py-2 font-semibold text-slate-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {etaLogs.map((log) => (
                        <tr key={log.id} className="text-slate-600">
                          <td className="px-3 py-2">
                            {new Date(log.sent_at).toLocaleString("en-IN", {
                              day: "2-digit", month: "short", year: "numeric",
                              hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
                            })}
                          </td>
                          <td className="px-3 py-2">{log.reminder_date}</td>
                          <td className="px-3 py-2">{log.shipment_count}</td>
                          <td className="px-3 py-2">{log.sent_count} recipient(s)</td>
                          <td className="px-3 py-2">
                            <Badge
                              variant={
                                log.status === "sent"    ? "default"     :
                                log.status === "skipped" ? "secondary"   : "destructive"
                              }
                            >
                              {log.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section 1: Recipients */}
      <Card className="border-slate-200 border-l-4 border-l-blue-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Recipients (who receives notifications)
          </CardTitle>
          <CardDescription>Add name and phone number for each person who should get WhatsApp alerts (e.g. production team).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="recipient-name">Name</Label>
              <Input
                id="recipient-name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Production Lead"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipient-phone">Phone (with country code)</Label>
              <Input
                id="recipient-phone"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="e.g. +919876543210"
              />
            </div>
            {editingRecipient ? (
              <>
                <Button onClick={handleUpdateRecipient} disabled={savingRecipient}>
                  {savingRecipient ? "Saving..." : "Update"}
                </Button>
                <Button variant="outline" onClick={() => { setEditingRecipient(null); setRecipientName(""); setRecipientPhone("") }}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={handleAddRecipient} disabled={savingRecipient}>
                {savingRecipient ? "Adding..." : "Add recipient"}
              </Button>
            )}
          </div>
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Recipients list</p>
            {recipients.length === 0 ? (
              <p className="text-sm text-slate-500">No recipients yet. Add one above.</p>
            ) : (
              <ul className="space-y-2">
                {recipients.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{r.name}</span>
                      <span className="text-slate-600">{r.phone}</span>
                      {!r.is_active && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleToggleRecipientActive(r)}>
                        {r.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingRecipient(r)
                          setRecipientName(r.name)
                          setRecipientPhone(r.phone)
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteRecipient(r.id)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section 2: WhatsApp configuration */}
      <Card className="border-slate-200 border-l-4 border-l-green-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            WhatsApp configuration
          </CardTitle>
          <CardDescription>Provider credentials and API endpoint used by the messenger auto sender to send messages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="config-provider">Provider</Label>
              <Input
                id="config-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="e.g. Twilio, WhatsApp Business API"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="config-user-id">User ID</Label>
              <Input
                id="config-user-id"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="User ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="config-password">Password</Label>
              <Input
                id="config-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="config-api-key">API Key</Label>
              <Input
                id="config-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="API Key"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="config-endpoint">API Endpoint URL</Label>
            <Input
              id="config-endpoint"
              value={apiEndpointUrl}
              onChange={(e) => setApiEndpointUrl(e.target.value)}
              placeholder="https://app.messageautosender.com/api/v1/message/create"
            />
          </div>
          <Button onClick={handleSaveConfig} disabled={savingConfig}>
            {savingConfig ? "Saving..." : "Save WhatsApp configuration"}
          </Button>
        </CardContent>
      </Card>

      {/* Section 3: Message templates */}
      <Card className="border-slate-200 border-l-4 border-l-purple-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Notification message templates
          </CardTitle>
          <CardDescription>
            Define message text per workflow event. For &quot;order_created&quot; you can use: {PLACEHOLDERS}{" "}
            <span className="text-amber-800">
              (Morning report settings are only in the Morning Production Report card — they are not listed here.)
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-event">Event type</Label>
            <select
              id="template-event"
              className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={templateEventType}
              onChange={(e) => setTemplateEventType(e.target.value)}
              disabled={!!editingTemplate}
            >
              {EVENT_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-name">Name (optional)</Label>
            <Input
              id="template-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. New order punched"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-body">Message body</Label>
            <textarea
              id="template-body"
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={templateBody}
              onChange={(e) => setTemplateBody(e.target.value)}
              placeholder="New order {{order_number}} for {{customer_name}}. Please check production queue."
            />
            <p className="text-xs text-slate-500">{PLACEHOLDERS}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveTemplate} disabled={savingTemplate}>
              {savingTemplate ? "Saving..." : editingTemplate ? "Update template" : "Save template"}
            </Button>
            {editingTemplate && (
              <Button variant="outline" onClick={cancelEditTemplate}>
                Cancel
              </Button>
            )}
          </div>
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Saved templates</p>
            {templates.filter((t) => ![MORNING_REPORT_EVENT_TYPE, ETA_REMINDER_EVENT_TYPE].includes(t.event_type)).length === 0 ? (
              <p className="text-sm text-slate-500">
                No workflow message templates yet. Add one for &quot;order_created&quot; so the auto sender can notify when an order is punched.
                {templates.some((t) => t.event_type === MORNING_REPORT_EVENT_TYPE) && (
                  <span className="block mt-2 text-slate-600">
                    Morning report is configured in the orange card above (not in this list).
                  </span>
                )}
              </p>
            ) : (
              <ul className="space-y-2">
                {templates.filter((t) => ![MORNING_REPORT_EVENT_TYPE, ETA_REMINDER_EVENT_TYPE].includes(t.event_type)).map((t) => (
                  <li key={t.id} className="flex items-start justify-between py-2 px-3 rounded-lg bg-slate-50">
                    <div>
                      <span className="font-medium text-slate-900">{t.event_type}</span>
                      {t.name && <span className="text-slate-600 ml-2">— {t.name}</span>}
                      <p className="text-sm text-slate-600 mt-1 truncate max-w-2xl">{t.template_body}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => startEditTemplate(t)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
