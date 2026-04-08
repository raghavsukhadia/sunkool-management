"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Truck,
  MapPin,
  CalendarDays,
  User,
  Phone,
  ExternalLink,
  MessageSquare,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  PackageOpen,
  Package,
  PackageCheck,
} from "lucide-react"
import {
  getShipmentNotes,
  addShipmentNote,
  updateShipmentTracking,
} from "@/app/actions/tracking"
import {
  type ShipmentRow,
  type ShipmentNote,
  type ShipmentStatus,
  SHIPMENT_STATUS_LABELS,
} from "@/app/actions/tracking-types"

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    pending:          "bg-slate-100 text-slate-700 border-slate-200",
    ready:            "bg-amber-50 text-amber-800 border-amber-200",
    picked_up:        "bg-blue-50 text-blue-700 border-blue-200",
    in_transit:       "bg-blue-100 text-blue-800 border-blue-300",
    out_for_delivery: "bg-orange-50 text-orange-800 border-orange-200",
    delivered:        "bg-green-50 text-green-800 border-green-200",
    failed_delivery:  "bg-red-50 text-red-800 border-red-200",
    rto_initiated:    "bg-orange-100 text-orange-800 border-orange-300",
    returned:         "bg-purple-50 text-purple-700 border-purple-200",
    cancelled:        "bg-slate-100 text-slate-500 border-slate-200",
  }
  const classes = cfg[status] ?? "bg-slate-100 text-slate-700 border-slate-200"
  const label   = SHIPMENT_STATUS_LABELS[status as ShipmentStatus] ?? status
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  )
}

// ── Tracking timeline ─────────────────────────────────────────────────────────
// 3-step: Ready → Picked Up → Delivered (or Delivery Failed)

const TIMELINE_STEPS = [
  { key: "ready",     label: "Ready",     icon: Package     },
  { key: "picked_up", label: "Picked Up", icon: PackageOpen },
  { key: "delivered", label: "Delivered", icon: PackageCheck },
]

const STATUS_ORDER: Record<string, number> = {
  pending:          -1,
  ready:            0,
  picked_up:        1,
  in_transit:       1,
  out_for_delivery: 1,
  delivered:        2,
  failed_delivery:  2,
  rto_initiated:    1,
  returned:         2,
  cancelled:        -1,
}

function TrackingTimeline({ status }: { status: string }) {
  const currentStep = STATUS_ORDER[status] ?? -1
  const isFailed    = status === "failed_delivery" || status === "returned"

  return (
    <div className="relative">
      <div className="flex items-start gap-0">
        {TIMELINE_STEPS.map((step, idx) => {
          const done      = idx < currentStep
          const active    = idx === currentStep
          const isLast    = idx === TIMELINE_STEPS.length - 1
          const showFail  = isFailed && isLast && active

          // Last step swaps label + icon on failure
          const label = showFail ? "Delivery Failed" : step.label
          const Icon  = showFail ? AlertCircle       : step.icon

          let dotClass  = "bg-slate-200 border-slate-300"
          let iconClass = "text-slate-400"
          let lineClass = "bg-slate-200"

          if (done)     { dotClass = "bg-sk-primary border-sk-primary"; iconClass = "text-white"; lineClass = "bg-sk-primary" }
          if (active && !showFail) { dotClass = "bg-sk-primary border-sk-primary ring-4 ring-sk-primary/20"; iconClass = "text-white" }
          if (showFail) { dotClass = "bg-red-500 border-red-500 ring-4 ring-red-200"; iconClass = "text-white" }

          return (
            <div key={step.key} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${dotClass}`}>
                  <Icon className={`h-3.5 w-3.5 ${iconClass}`} />
                </div>
                {!isLast && (
                  <div className={`h-0.5 flex-1 ${idx < currentStep ? lineClass : "bg-slate-200"}`} />
                )}
              </div>
              <span className={`mt-1.5 text-center text-[10px] font-medium leading-tight ${showFail ? "text-red-600" : active || done ? "text-sk-text-1" : "text-sk-text-3"}`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Info row helper ───────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sk-page-bg">
        <Icon className="h-3.5 w-3.5 text-sk-text-3" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-sk-text-3">{label}</p>
        <div className="mt-0.5 text-sm font-medium text-sk-text-1">{value || <span className="text-sk-text-3">—</span>}</div>
      </div>
    </div>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-sk-text-3">
      {children}
    </p>
  )
}

// ── Main drawer ───────────────────────────────────────────────────────────────

interface Props {
  shipment: ShipmentRow | null
  open:     boolean
  onClose:  () => void
  onUpdated: () => void
}

export function ShipmentDetailDrawer({ shipment, open, onClose, onUpdated }: Props) {
  const [notes,     setNotes]    = useState<ShipmentNote[]>([])
  const [newNote,   setNewNote]  = useState("")
  const [noteLoading, setNoteLoading] = useState(false)
  const [notesLoading, setNotesLoading] = useState(false)

  // Edit state
  const [editStatus, setEditStatus] = useState<string>("")
  const [saving,     setSaving]     = useState(false)
  const [saveMsg,    setSaveMsg]    = useState<{ type: "ok" | "err"; text: string } | null>(null)

  // Reset when shipment changes
  useEffect(() => {
    if (!shipment) return
    setEditStatus(shipment.shipment_status)
    setNotes([])
    setNewNote("")
    setSaveMsg(null)
  }, [shipment?.dispatch_id])

  // Load notes when drawer opens
  const loadNotes = useCallback(async () => {
    if (!shipment) return
    setNotesLoading(true)
    const res = await getShipmentNotes(shipment.dispatch_id)
    if (res.success && res.data) setNotes(res.data)
    setNotesLoading(false)
  }, [shipment?.dispatch_id])

  useEffect(() => {
    if (open && shipment) loadNotes()
  }, [open, shipment?.dispatch_id])

  const handleSave = async () => {
    if (!shipment) return
    setSaving(true)
    setSaveMsg(null)

    const res = await updateShipmentTracking(shipment.dispatch_id, {
      shipment_status: editStatus as ShipmentStatus,
    })

    setSaving(false)
    if (res.success) {
      setSaveMsg({ type: "ok", text: "Saved successfully." })
      onUpdated()
    } else {
      setSaveMsg({ type: "err", text: res.error ?? "Failed to save." })
    }
  }

  const handleAddNote = async () => {
    if (!shipment || !newNote.trim()) return
    setNoteLoading(true)
    const res = await addShipmentNote(shipment.dispatch_id, newNote)
    if (res.success) {
      setNewNote("")
      await loadNotes()
    }
    setNoteLoading(false)
  }

  const hasChanges = shipment && editStatus !== shipment.shipment_status

  if (!shipment) return null

  const formatDate = (d: string | null) => {
    if (!d) return null
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return d
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        {/* ── Header ── */}
        <SheetHeader className="border-b border-sk-border bg-[#fcf7f2] px-5 py-4">
          <SheetTitle className="text-base font-semibold text-sk-text-1">
            Order #{shipment.order_number}
            {shipment.sales_order_number && (
              <span className="ml-2 text-sm font-normal text-sk-text-3">· SO {shipment.sales_order_number}</span>
            )}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <StatusBadge status={shipment.shipment_status} />
            {shipment.tracking_id && (
              <span className="font-mono text-xs text-sk-text-2">{shipment.tracking_id}</span>
            )}
          </SheetDescription>
        </SheetHeader>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* Timeline */}
          <div>
            <SectionLabel>Tracking Progress</SectionLabel>
            <TrackingTimeline status={shipment.shipment_status} />
          </div>

          {/* Shipment info */}
          <div>
            <SectionLabel>Shipment Details</SectionLabel>
            <div className="space-y-3 rounded-lg border border-sk-border bg-white p-3">
              <InfoRow icon={User}       label="Customer"         value={shipment.customer_name} />
              {shipment.customer_phone && (
                <InfoRow icon={Phone}   label="Phone"            value={shipment.customer_phone} />
              )}
              <InfoRow icon={Package}   label="Order #"          value={`#${shipment.order_number}`} />
              {shipment.sales_order_number && (
                <InfoRow icon={Package} label="Sales Order #"    value={shipment.sales_order_number} />
              )}
              <InfoRow icon={Truck}        label="Courier"       value={shipment.courier_name} />
              <InfoRow icon={CalendarDays} label="Dispatched"   value={formatDate(shipment.dispatch_date)} />
              <InfoRow
                icon={Clock}
                label="ETA"
                value={
                  shipment.estimated_delivery ? (
                    <span className={shipment.is_delayed ? "font-medium text-red-600" : undefined}>
                      {formatDate(shipment.estimated_delivery)}
                      {shipment.is_delayed && <span className="ml-1.5 text-xs font-normal text-red-500">(Overdue)</span>}
                    </span>
                  ) : null
                }
              />
              {shipment.tracking_id && (
                <InfoRow
                  icon={Truck}
                  label="Tracking ID"
                  value={
                    <span className="flex items-center gap-2">
                      <span className="font-mono">{shipment.tracking_id}</span>
                      {shipment.tracking_url && (
                        <a
                          href={shipment.tracking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-sk-primary hover:underline"
                        >
                          Track <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </span>
                  }
                />
              )}
              {shipment.current_location && (
                <InfoRow icon={MapPin} label="Last Location" value={shipment.current_location} />
              )}
            </div>
          </div>

          {/* Update status */}
          <div>
            <SectionLabel>Update Shipment</SectionLabel>
            <div className="space-y-3 rounded-lg border border-sk-border bg-white p-3">
              <div>
                <label className="mb-2 block text-xs font-medium text-sk-text-2">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "ready",           label: "Ready",           cls: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"  },
                    { value: "picked_up",        label: "Picked Up",       cls: "border-blue-200  bg-blue-50  text-blue-800  hover:bg-blue-100"   },
                    { value: "delivered",        label: "Delivered",       cls: "border-green-200 bg-green-50 text-green-800 hover:bg-green-100"  },
                    { value: "failed_delivery",  label: "Delivery Failed", cls: "border-red-200   bg-red-50   text-red-800   hover:bg-red-100"    },
                  ].map(({ value, label, cls }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setEditStatus(value)}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${cls} ${
                        editStatus === value
                          ? "ring-2 ring-offset-1 " + (
                              value === "ready"          ? "ring-amber-400" :
                              value === "picked_up"      ? "ring-blue-400"  :
                              value === "delivered"      ? "ring-green-500" :
                                                           "ring-red-400"
                            )
                          : "opacity-60"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {saveMsg && (
                <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${saveMsg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {saveMsg.type === "ok"
                    ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                    : <AlertCircle  className="h-4 w-4 shrink-0" />}
                  {saveMsg.text}
                </div>
              )}

              <Button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="h-9 w-full text-sm"
              >
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save Changes"}
              </Button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <SectionLabel>Internal Notes</SectionLabel>
            <div className="space-y-3">
              {/* Add note */}
              <div className="flex gap-2">
                <Input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note…"
                  className="h-9 border-sk-border bg-white text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAddNote() } }}
                />
                <Button
                  onClick={() => void handleAddNote()}
                  disabled={noteLoading || !newNote.trim()}
                  size="sm"
                  className="h-9 shrink-0"
                >
                  {noteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                </Button>
              </div>

              {/* Note list */}
              {notesLoading ? (
                <div className="flex items-center gap-2 text-sm text-sk-text-3">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading notes…
                </div>
              ) : notes.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-sk-border bg-sk-page-bg px-3 py-3 text-sm text-sk-text-3">
                  <MessageSquare className="h-4 w-4" />
                  No notes yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {notes.map((n) => (
                    <div key={n.id} className="rounded-lg border border-sk-border bg-white px-3 py-2.5">
                      <p className="text-sm text-sk-text-1">{n.note}</p>
                      <p className="mt-1 text-[11px] text-sk-text-3">
                        {n.created_by ?? "Team"} ·{" "}
                        {new Date(n.created_at).toLocaleDateString("en-IN", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
