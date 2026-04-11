"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Activity,
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit2,
  Factory,
  FileText,
  MessageSquare,
  Wrench,
  Minus,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  ShoppingCart,
  StickyNote,
  Truck,
  Undo2,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { getOrderTimeline } from "@/app/actions/timeline"
import type {
  TimelineCategory,
  TimelineEntry,
  TimelineEventType,
} from "@/app/actions/timeline-types"
import {
  EVENT_CATEGORY,
  EVENT_SEVERITY,
  TIMELINE_CATEGORY_LABELS,
} from "@/app/actions/timeline-types"

// ─── Icon map ─────────────────────────────────────────────────────────────────

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

// ─── Colour tokens ────────────────────────────────────────────────────────────

type ColourSet = { bg: string; icon: string; line: string; ring: string }

const SEVERITY_COLOURS: Record<string, ColourSet> = {
  success: { bg: "bg-emerald-500", icon: "text-white",    line: "bg-emerald-200", ring: "ring-emerald-100" },
  info:    { bg: "bg-blue-500",    icon: "text-white",    line: "bg-blue-200",    ring: "ring-blue-100"    },
  warning: { bg: "bg-amber-500",   icon: "text-white",    line: "bg-amber-200",   ring: "ring-amber-100"   },
  error:   { bg: "bg-red-500",     icon: "text-white",    line: "bg-red-200",     ring: "ring-red-100"     },
  neutral: { bg: "bg-slate-300",   icon: "text-slate-600",line: "bg-slate-200",   ring: "ring-slate-100"   },
}

const IDLE_COLOURS: ColourSet = {
  bg: "bg-slate-100", icon: "text-slate-500", line: "bg-slate-200", ring: "ring-slate-100",
}

const SHIPMENT_STATUS_SEVERITY: Record<string, string> = {
  delivered:        "success",
  out_for_delivery: "info",
  in_transit:       "info",
  picked_up:        "info",
  failed_delivery:  "error",
  rto_initiated:    "warning",
  returned:         "warning",
  cancelled:        "error",
}

function severityOf(entry: TimelineEntry): string {
  if (
    entry.event_type === "shipment_status_changed" &&
    typeof entry.metadata.new_status === "string"
  ) {
    return SHIPMENT_STATUS_SEVERITY[entry.metadata.new_status] ?? "info"
  }
  return EVENT_SEVERITY[entry.event_type] ?? "neutral"
}

// ─── Timestamp helpers ────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function relativeLabel(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)   return "Just now"
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  if (days  === 1) return "Yesterday"
  if (days  < 7)   return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  })
}

function absoluteLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  })
}

// ─── Date grouping ────────────────────────────────────────────────────────────

interface DateGroup {
  label: string
  items: TimelineEntry[]
}

function groupByDate(entries: TimelineEntry[]): DateGroup[] {
  if (entries.length === 0) return []

  const today     = startOfDay(new Date())
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)

  const groups: DateGroup[] = []
  let current: DateGroup | null = null as DateGroup | null

  for (const entry of entries) {
    const day = startOfDay(new Date(entry.timestamp))
    let label: string

    if (day.getTime() === today.getTime()) {
      label = "Today"
    } else if (day.getTime() === yesterday.getTime()) {
      label = "Yesterday"
    } else {
      label = day.toLocaleDateString("en-IN", {
        weekday: "short", day: "numeric", month: "short",
      })
    }

    if (current?.label !== label) {
      current = { label, items: [] }
      groups.push(current)
    }
    current!.items.push(entry)
  }

  return groups
}

// ─── Progress bar (compact) ───────────────────────────────────────────────────

const ORDER_STAGES = [
  { key: "created",    label: "Created",    events: ["order_created"] },
  { key: "production", label: "Produced",   events: ["production_record_created", "production_completed"] },
  { key: "dispatched", label: "Dispatched", events: ["dispatch_created"] },
  { key: "shipped",    label: "Shipped",    events: ["shipment_status_changed"] },
  { key: "delivered",  label: "Delivered",  events: [] as string[] },
  { key: "paid",       label: "Paid",       events: ["payment_received"] },
] as const

function CompactProgressBar({ entries }: { entries: TimelineEntry[] }) {
  const types = new Set(entries.map((e) => e.event_type))
  const hasDelivered = entries.some(
    (e) =>
      e.event_type === "shipment_status_changed" &&
      e.metadata.new_status === "delivered",
  )

  const completed = ORDER_STAGES.map((s) =>
    s.key === "delivered"
      ? hasDelivered
      : s.events.some((ev) => types.has(ev as TimelineEventType)),
  )
  const lastDone   = completed.lastIndexOf(true)
  const pct        = lastDone < 0 ? 0 : Math.round(((lastDone + 1) / ORDER_STAGES.length) * 100)
  const nextActive = lastDone + 1

  return (
    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
      {/* Stage dots */}
      <div className="flex items-center justify-between mb-2">
        {ORDER_STAGES.map((stage, i) => (
          <div key={stage.key} className="flex flex-col items-center gap-1 flex-1">
            <div
              className={`
                h-2 w-2 rounded-full border transition-all duration-500
                ${completed[i]
                  ? "border-orange-500 bg-orange-500 scale-110"
                  : i === nextActive
                  ? "border-orange-400 bg-white animate-pulse"
                  : "border-slate-300 bg-white"
                }
              `}
            />
            <span
              className={`text-[9px] font-medium leading-none text-center ${
                completed[i] ? "text-orange-600" : "text-slate-400"
              }`}
            >
              {stage.label}
            </span>
          </div>
        ))}
      </div>
      {/* Bar */}
      <div className="h-1 rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-orange-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-right text-[10px] text-slate-400">
        {pct}% · {entries.length} event{entries.length !== 1 ? "s" : ""}
      </p>
    </div>
  )
}

// ─── Metadata pills ───────────────────────────────────────────────────────────

const METADATA_LABELS: Record<string, string> = {
  courier_name:   "Courier",
  tracking_id:    "Tracking ID",
  dispatch_type:  "Type",
  new_status:     "Status",
  old_status:     "Previous",
  amount:         "Amount",
  payment_method: "Method",
  invoice_number: "Invoice",
  item_count:     "Items",
}

// Keys we never want to render as visible pills
const METADATA_HIDDEN = new Set([
  "dispatch_id", "invoice_id", "order_id", "reference",
])

function MetadataPills({ metadata }: { metadata: Record<string, unknown> }) {
  const visible = Object.entries(metadata).filter(
    ([k, v]) => !METADATA_HIDDEN.has(k) && v != null && v !== "",
  )
  if (visible.length === 0) return null

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {visible.map(([key, value]) => {
        const label   = METADATA_LABELS[key] ?? key.replace(/_/g, " ")
        const display =
          key === "amount"
            ? `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
            : String(value)

        return (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 leading-none"
          >
            <span className="font-medium text-slate-400">{label}:</span>
            {display}
          </span>
        )
      })}
    </div>
  )
}

// ─── Single timeline event row ────────────────────────────────────────────────

interface RowProps {
  entry:   TimelineEntry
  isFirst: boolean   // very first entry overall (latest)
  isLast:  boolean   // last in its date group
}

function TimelineRow({ entry, isFirst, isLast }: RowProps) {
  const Icon     = EVENT_ICON[entry.event_type] ?? Clock
  const severity = severityOf(entry)
  const colours  = isFirst ? SEVERITY_COLOURS[severity] : IDLE_COLOURS

  return (
    <div className="relative flex gap-3 group">
      {/* Icon column */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className={`
            relative z-10 flex h-8 w-8 items-center justify-center rounded-full
            ring-4 shadow-sm transition-all
            ${isFirst ? colours.ring + " " + colours.bg : "bg-slate-100 ring-slate-50"}
          `}
        >
          <Icon
            className={`h-3.5 w-3.5 ${isFirst ? "text-white" : "text-slate-400 group-hover:text-slate-600"} transition-colors`}
          />
        </div>
        {!isLast && (
          <div className={`mt-1 w-px flex-1 min-h-[1.5rem] ${colours.line}`} />
        )}
      </div>

      {/* Content column */}
      <div className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-5"}`}>
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <p
            className={`text-sm leading-5 font-semibold ${
              isFirst ? "text-slate-900" : "text-slate-700"
            }`}
          >
            {entry.title}
            {isFirst && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-orange-100 px-1.5 py-px text-[10px] font-semibold text-orange-700 leading-none">
                Latest
              </span>
            )}
          </p>

          {/* Relative time */}
          <span
            className="flex-shrink-0 text-[10px] text-slate-400 mt-0.5 whitespace-nowrap"
            title={absoluteLabel(entry.timestamp)}
          >
            {relativeLabel(entry.timestamp)}
          </span>
        </div>

        {/* Description */}
        {entry.description && (
          <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
            {entry.description}
          </p>
        )}

        {/* Metadata chips */}
        <MetadataPills metadata={entry.metadata} />

        {/* Actor */}
        <p className="mt-1 text-[10px] text-slate-400">
          {entry.actor_name ?? entry.actor}
        </p>
      </div>
    </div>
  )
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function DrawerSkeleton() {
  return (
    <div className="space-y-5 px-5 py-4">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5 pt-1">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-52" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function DrawerEmpty({ category }: { category: TimelineCategory }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <Clock className="h-5 w-5 text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-600">No events yet</p>
      <p className="mt-1 text-xs text-slate-400 max-w-[220px] leading-relaxed">
        {category === "all"
          ? "Events will appear here as the order progresses."
          : `No ${TIMELINE_CATEGORY_LABELS[category].toLowerCase()} events recorded for this order.`}
      </p>
    </div>
  )
}

// ─── Error state ──────────────────────────────────────────────────────────────

function DrawerError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-5 my-4 rounded-lg border border-red-100 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-red-700">Failed to load timeline</p>
          <p className="mt-0.5 text-xs text-red-600 leading-relaxed">{message}</p>
          <button
            onClick={onRetry}
            className="mt-2 text-xs font-medium text-red-700 underline underline-offset-2 hover:text-red-900"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Filter chip row ──────────────────────────────────────────────────────────

const ALL_CATEGORIES: TimelineCategory[] = [
  "all", "order", "payment", "shipment", "production",
]

interface FilterChipsProps {
  active:   TimelineCategory
  counts:   Record<TimelineCategory, number>
  onChange: (c: TimelineCategory) => void
}

function FilterChips({ active, counts, onChange }: FilterChipsProps) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
      {ALL_CATEGORIES.map((cat) => {
        const isActive = cat === active
        const count    = counts[cat] ?? 0

        return (
          <button
            key={cat}
            onClick={() => onChange(cat)}
            className={`
              inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1
              text-xs font-medium transition-all duration-150
              ${isActive
                ? "bg-orange-500 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800"
              }
            `}
          >
            {TIMELINE_CATEGORY_LABELS[cat]}
            <span
              className={`
                rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums leading-none
                ${isActive ? "bg-orange-400 text-white" : "bg-white text-slate-500"}
              `}
            >
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TimelineDrawerProps {
  orderId:      string
  orderNumber?: string | null
}

export function TimelineDrawer({ orderId, orderNumber }: TimelineDrawerProps) {
  const [open,     setOpen]     = useState(false)
  const [entries,  setEntries]  = useState<TimelineEntry[] | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [category, setCategory] = useState<TimelineCategory>("all")
  const hasFetched = useRef(false)

  // ── Data fetching ────────────────────────────────────────────────────────
  const fetchTimeline = useCallback(async (force = false) => {
    if (hasFetched.current && !force) return
    setLoading(true)
    setError(null)
    const result = await getOrderTimeline(orderId)
    hasFetched.current = true
    if (result.success) {
      setEntries(result.data)
    } else {
      setError(result.error)
    }
    setLoading(false)
  }, [orderId])

  // Fetch on first open; no-op on subsequent opens (cache hit)
  useEffect(() => {
    if (open) fetchTimeline()
  }, [open, fetchTimeline])

  // ── Derived state ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!entries) return []
    if (category === "all") return entries
    return entries.filter((e) => EVENT_CATEGORY[e.event_type] === category)
  }, [entries, category])

  const grouped = useMemo(() => groupByDate(filtered), [filtered])

  const counts = useMemo((): Record<TimelineCategory, number> => ({
    all:        entries?.length ?? 0,
    order:      entries?.filter((e) => EVENT_CATEGORY[e.event_type] === "order").length      ?? 0,
    payment:    entries?.filter((e) => EVENT_CATEGORY[e.event_type] === "payment").length    ?? 0,
    shipment:   entries?.filter((e) => EVENT_CATEGORY[e.event_type] === "shipment").length   ?? 0,
    production: entries?.filter((e) => EVENT_CATEGORY[e.event_type] === "production").length ?? 0,
  }), [entries])

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Trigger button — matches the style of other header buttons */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
      >
        <Activity className="h-4 w-4" />
        <span className="hidden sm:inline">Timeline</span>
      </button>

      {/* Drawer panel */}
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 sm:max-w-[480px] border-l border-slate-200"
      >
        {/* ── Sticky header ────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-b border-slate-100 bg-white">
          {/* Title row — leaves room for the Sheet's built-in close button (absolute right-4 top-4) */}
          <div className="flex items-start justify-between pl-5 pr-14 pt-5 pb-3">
            <div className="min-w-0">
              <SheetTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <Activity className="h-4 w-4 text-orange-500 flex-shrink-0" />
                Order Timeline
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-xs text-slate-500">
                {orderNumber ? `Order ${orderNumber}` : "Complete lifecycle history"}
              </SheetDescription>
            </div>

            {/* Refresh button */}
            <button
              onClick={() => fetchTimeline(true)}
              disabled={loading}
              title="Refresh timeline"
              className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Filter chips */}
          <div className="px-5 pb-3">
            <FilterChips
              active={category}
              counts={counts}
              onChange={setCategory}
            />
          </div>
        </div>

        {/* ── Progress bar (below header, above scroll area) ─────────── */}
        {entries && entries.length > 0 && !loading && (
          <CompactProgressBar entries={entries} />
        )}

        {/* ── Scrollable timeline body ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loading ? (
            <DrawerSkeleton />
          ) : error ? (
            <DrawerError message={error} onRetry={() => fetchTimeline(true)} />
          ) : filtered.length === 0 ? (
            <DrawerEmpty category={category} />
          ) : (
            <div className="px-5 py-4">
              {grouped.map(({ label, items }) => (
                <div key={label}>
                  {/* Date group separator */}
                  <div className="sticky top-0 z-10 flex items-center gap-2 py-2 bg-white/90 backdrop-blur-sm">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {label}
                    </span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>

                  {/* Events in this date group */}
                  {items.map((entry, idx) => {
                    // isFirst = the very first entry in the entire filtered list
                    const globalIndex = filtered.indexOf(entry)
                    const isGroupLast = idx === items.length - 1

                    return (
                      <TimelineRow
                        key={entry.id}
                        entry={entry}
                        isFirst={globalIndex === 0}
                        isLast={isGroupLast}
                      />
                    )
                  })}

                  {/* Spacer between date groups */}
                  <div className="h-3" />
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
