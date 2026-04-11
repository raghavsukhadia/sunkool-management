"use client"

import { useMemo, useState } from "react"
import {
  ShoppingCart,
  Edit2,
  XCircle,
  RefreshCw,
  Plus,
  Minus,
  Banknote,
  CreditCard,
  Receipt,
  FileText,
  Factory,
  CheckCircle2,
  Package,
  Undo2,
  Truck,
  MessageSquare,
  StickyNote,
  Clock,
  Filter,
  AlertTriangle,
  MapPin,
  CheckCheck,
  Wrench,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type {
  TimelineEntry,
  TimelineEventType,
  TimelineCategory,
} from "@/app/actions/timeline-types"
import {
  EVENT_CATEGORY,
  TIMELINE_CATEGORY_LABELS,
  EVENT_SEVERITY,
} from "@/app/actions/timeline-types"

// ─── Icon map ────────────────────────────────────────────────────────────────

const EVENT_ICON: Record<TimelineEventType, React.ElementType> = {
  order_created:             ShoppingCart,
  order_updated:             Edit2,
  order_cancelled:           XCircle,
  order_status_changed:      RefreshCw,
  item_added:                Plus,
  item_removed:              Minus,
  payment_received:          Banknote,
  payment_status_changed:    CreditCard,
  invoice_created:           Receipt,
  invoice_updated:           FileText,
  production_record_created: Factory,
  production_in_progress:    Wrench,
  production_completed:      CheckCircle2,
  dispatch_created:          Package,
  return_dispatch_created:   Undo2,
  shipment_status_changed:   Truck,
  shipment_note_added:       MessageSquare,
  admin_note:                StickyNote,
}

// ─── Colour tokens ───────────────────────────────────────────────────────────

type ColourSet = { dot: string; icon: string; ring: string }

const SEVERITY_COLOURS: Record<string, ColourSet> = {
  success: {
    dot:  "bg-emerald-500",
    icon: "text-emerald-600",
    ring: "ring-emerald-100",
  },
  info: {
    dot:  "bg-blue-500",
    icon: "text-blue-600",
    ring: "ring-blue-100",
  },
  warning: {
    dot:  "bg-amber-500",
    icon: "text-amber-600",
    ring: "ring-amber-100",
  },
  error: {
    dot:  "bg-red-500",
    icon: "text-red-600",
    ring: "ring-red-100",
  },
  neutral: {
    dot:  "bg-slate-400",
    icon: "text-slate-500",
    ring: "ring-slate-100",
  },
}

// Shipment statuses that override the default "info" severity
const SHIPMENT_STATUS_SEVERITY: Record<string, string> = {
  delivered:         "success",
  out_for_delivery:  "info",
  in_transit:        "info",
  picked_up:         "info",
  failed_delivery:   "error",
  rto_initiated:     "warning",
  returned:          "warning",
  cancelled:         "error",
}

function severityForEntry(entry: TimelineEntry): string {
  if (
    entry.event_type === "shipment_status_changed" &&
    typeof entry.metadata.new_status === "string"
  ) {
    return SHIPMENT_STATUS_SEVERITY[entry.metadata.new_status] ?? "info"
  }
  return EVENT_SEVERITY[entry.event_type] ?? "neutral"
}

// ─── Timestamp helpers ────────────────────────────────────────────────────────

function formatRelative(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)

  if (mins  < 1)   return "Just now"
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  if (days  === 1) return "Yesterday"
  if (days  < 7)   return `${days} days ago`
  return new Date(isoString).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  })
}

function formatAbsolute(isoString: string): string {
  return new Date(isoString).toLocaleString("en-IN", {
    day:    "numeric",
    month:  "short",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

// ─── Metadata renderer ────────────────────────────────────────────────────────

function MetadataPills({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata).filter(([, v]) => v != null && v !== "")
  if (entries.length === 0) return null

  // Human-friendly label mapping
  const LABELS: Record<string, string> = {
    courier_name:    "Courier",
    tracking_id:     "Tracking ID",
    dispatch_type:   "Type",
    new_status:      "New Status",
    old_status:      "Previous",
    amount:          "Amount",
    payment_method:  "Method",
    invoice_number:  "Invoice",
    item_count:      "Items",
    note_preview:    "Note",
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => {
        const label = LABELS[key] ?? key.replace(/_/g, " ")
        const display =
          key === "amount"
            ? `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
            : String(value)

        return (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600"
          >
            <span className="font-medium text-slate-400">{label}:</span>
            {display}
          </span>
        )
      })}
    </div>
  )
}

// ─── Single event row ─────────────────────────────────────────────────────────

interface TimelineRowProps {
  entry:    TimelineEntry
  isFirst:  boolean
  isLast:   boolean
}

function TimelineRow({ entry, isFirst, isLast }: TimelineRowProps) {
  const Icon     = EVENT_ICON[entry.event_type] ?? Clock
  const severity = severityForEntry(entry)
  const colours  = SEVERITY_COLOURS[severity]

  return (
    <div className="relative flex gap-4">
      {/* Vertical connector line */}
      <div className="flex flex-col items-center">
        {/* Dot */}
        <div
          className={`
            relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center
            rounded-full bg-white ring-4 shadow-sm
            ${colours.ring}
            ${isFirst ? "ring-2 " + colours.dot.replace("bg-", "ring-") : ""}
          `}
        >
          <div
            className={`
              flex h-7 w-7 items-center justify-center rounded-full
              ${isFirst ? colours.dot : "bg-slate-100"}
            `}
          >
            <Icon
              className={`h-3.5 w-3.5 ${isFirst ? "text-white" : colours.icon}`}
            />
          </div>
        </div>

        {/* Line below (skip for last item) */}
        {!isLast && (
          <div className="mt-1 w-px flex-1 bg-slate-200" />
        )}
      </div>

      {/* Content */}
      <div className={`pb-6 min-w-0 flex-1 ${isLast ? "pb-0" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={`text-sm font-semibold leading-5 ${
                isFirst ? "text-slate-900" : "text-slate-700"
              }`}
            >
              {entry.title}
              {isFirst && (
                <span className="ml-2 inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                  Latest
                </span>
              )}
            </p>

            {entry.description && (
              <p className="mt-0.5 text-sm text-slate-500 leading-relaxed">
                {entry.description}
              </p>
            )}

            <MetadataPills metadata={entry.metadata} />

            {/* Actor + relative timestamp */}
            <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
              {entry.actor_name ? (
                <span className="font-medium text-slate-500">{entry.actor_name}</span>
              ) : (
                <span className="capitalize">{entry.actor}</span>
              )}
              <span>·</span>
              <span title={formatAbsolute(entry.timestamp)}>
                {formatRelative(entry.timestamp)}
              </span>
            </div>
          </div>

          {/* Absolute timestamp chip (desktop) */}
          <span className="hidden sm:block flex-shrink-0 text-xs text-slate-400 pt-0.5 whitespace-nowrap">
            {formatAbsolute(entry.timestamp)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

const ORDER_STAGES = [
  { key: "created",    label: "Created",    events: ["order_created"] },
  { key: "production", label: "Production", events: ["production_record_created", "production_completed"] },
  { key: "dispatched", label: "Dispatched", events: ["dispatch_created"] },
  { key: "shipped",    label: "Shipped",    events: ["shipment_status_changed"] },
  { key: "delivered",  label: "Delivered",  events: [] as string[] },  // derived from metadata
  { key: "paid",       label: "Paid",       events: ["payment_received"] },
] as const

function ProgressBar({ entries }: { entries: TimelineEntry[] }) {
  const eventTypes = new Set(entries.map((e) => e.event_type))
  const hasDelivered = entries.some(
    (e) =>
      e.event_type === "shipment_status_changed" &&
      e.metadata.new_status === "delivered",
  )

  const completed = ORDER_STAGES.map((stage) => {
    if (stage.key === "delivered") return hasDelivered
    return stage.events.some((ev) => eventTypes.has(ev as TimelineEventType))
  })

  const lastCompleted = completed.lastIndexOf(true)
  const progressPct =
    lastCompleted < 0
      ? 0
      : Math.round(((lastCompleted + 1) / ORDER_STAGES.length) * 100)

  return (
    <div className="mb-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
      {/* Labels */}
      <div className="flex justify-between mb-2">
        {ORDER_STAGES.map((stage, i) => (
          <div key={stage.key} className="flex flex-col items-center gap-1 flex-1">
            <div
              className={`
                h-2.5 w-2.5 rounded-full border-2 transition-colors
                ${completed[i]
                  ? "border-orange-500 bg-orange-500"
                  : i === lastCompleted + 1
                  ? "border-orange-400 bg-white animate-pulse"
                  : "border-slate-300 bg-white"
                }
              `}
            />
            <span
              className={`text-[10px] font-medium leading-tight text-center ${
                completed[i] ? "text-orange-600" : "text-slate-400"
              }`}
            >
              {stage.label}
            </span>
          </div>
        ))}
      </div>

      {/* Bar */}
      <div className="relative h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-orange-500 transition-all duration-700"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <p className="mt-2 text-right text-xs text-slate-400">
        {progressPct}% complete · {entries.length} event{entries.length !== 1 ? "s" : ""}
      </p>
    </div>
  )
}

// ─── Empty & Loading states ───────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="space-y-6 py-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ category }: { category: TimelineCategory }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Clock className="h-10 w-10 text-slate-300 mb-3" />
      <p className="text-sm font-medium text-slate-500">No events yet</p>
      {category !== "all" && (
        <p className="mt-1 text-xs text-slate-400">
          No {TIMELINE_CATEGORY_LABELS[category].toLowerCase()} events recorded for this order.
        </p>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface OrderTimelineProps {
  entries: TimelineEntry[] | null
  loading: boolean
  error:   string | null
}

export function OrderTimeline({ entries, loading, error }: OrderTimelineProps) {
  const [category, setCategory] = useState<TimelineCategory>("all")

  const filtered = useMemo(() => {
    if (!entries) return []
    if (category === "all") return entries
    return entries.filter((e) => EVENT_CATEGORY[e.event_type] === category)
  }, [entries, category])

  const categories: TimelineCategory[] = ["all", "order", "payment", "shipment", "production"]

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <TimelineSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
        <span>Failed to load timeline: {error}</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      {entries && entries.length > 0 && <ProgressBar entries={entries} />}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-slate-400 mr-1 flex-shrink-0" />
        {categories.map((cat) => {
          const count =
            cat === "all"
              ? (entries?.length ?? 0)
              : (entries?.filter((e) => EVENT_CATEGORY[e.event_type] === cat).length ?? 0)

          return (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`
                inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium
                transition-colors
                ${category === cat
                  ? "bg-orange-500 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }
              `}
            >
              {TIMELINE_CATEGORY_LABELS[cat]}
              <span
                className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                  category === cat ? "bg-orange-400 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Timeline list */}
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-5">
        {filtered.length === 0 ? (
          <EmptyState category={category} />
        ) : (
          <div>
            {filtered.map((entry, index) => (
              <TimelineRow
                key={entry.id}
                entry={entry}
                isFirst={index === 0}
                isLast={index === filtered.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
