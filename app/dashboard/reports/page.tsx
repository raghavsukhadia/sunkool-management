"use client"

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  BarChart3,
  RefreshCw,
  Download,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Clock,
  Package,
  Factory,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  Filter,
  Calendar,
  ChevronDown as ChevronDownIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getProductionQueue,
  type ProductionKpiData,
  type ProductionQueueRow,
} from "@/app/actions/production"
import { generateMorningReportPDF } from "@/lib/morning-report-pdf"

// ─── Utility helpers ────────────────────────────────────────────────────────

function getRemainingUntilDone(row: ProductionQueueRow): number {
  return row.remainingUntilDone ?? Math.max(0, row.ordered - (row.producedCompleted ?? 0))
}

/** Total produced = completed + in-progress batches (matches getProducedForDisplay fallback) */
function getProduced(row: ProductionQueueRow): number {
  if (row.producedCompleted != null && row.producedCompleted > 0) return row.producedCompleted
  return Math.max(0, row.ordered - getRemainingUntilDone(row))
}

function getInProgress(row: ProductionQueueRow): number {
  return Math.max(0, row.produced - row.producedCompleted)
}

function getRowStatus(row: ProductionQueueRow): "In Progress" | "Pending" {
  return row.hasInProductionRecord ? "In Progress" : "Pending"
}

function fmtDate(d: string | null): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  })
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: true, timeZone: "Asia/Kolkata",
  })
}

/** Returns "YYYY-MM-DD" for today in IST */
function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
}

function offsetDate(base: string, days: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function startOfMonthIST(): string {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
}

function fmtShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
}

// ─── Types ───────────────────────────────────────────────────────────────────

type SortKey =
  | "orderNumber" | "orderDate" | "customerName"
  | "itemName"    | "ordered"   | "produced"
  | "ip"          | "remaining"

type SortDir = "asc" | "desc"
type StatusFilter = "all" | "in-progress" | "pending"
type ReportTab = "production"

interface DateRange {
  from: string   // "YYYY-MM-DD" or ""
  to:   string
}

type DatePreset = "all" | "today" | "yesterday" | "7d" | "30d" | "month" | "custom"

// ─── DateRangePicker ─────────────────────────────────────────────────────────

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: "all",       label: "All Time"    },
  { key: "today",     label: "Today"       },
  { key: "yesterday", label: "Yesterday"   },
  { key: "7d",        label: "Last 7 Days" },
  { key: "30d",       label: "Last 30 Days"},
  { key: "month",     label: "This Month"  },
  { key: "custom",    label: "Custom…"     },
]

function presetToRange(preset: DatePreset): DateRange {
  const today = todayIST()
  switch (preset) {
    case "today":     return { from: today,              to: today                   }
    case "yesterday": return { from: offsetDate(today,-1), to: offsetDate(today,-1) }
    case "7d":        return { from: offsetDate(today,-6), to: today                }
    case "30d":       return { from: offsetDate(today,-29),to: today                }
    case "month":     return { from: startOfMonthIST(),    to: today                }
    default:          return { from: "",                  to: ""                    }
  }
}

function DateRangePicker({
  value,
  onChange,
}: {
  value: { preset: DatePreset; range: DateRange }
  onChange: (v: { preset: DatePreset; range: DateRange }) => void
}) {
  const [open, setOpen] = useState(false)
  const [localFrom, setLocalFrom] = useState(value.range.from)
  const [localTo,   setLocalTo]   = useState(value.range.to)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const applyPreset = (preset: DatePreset) => {
    if (preset === "custom") {
      setLocalFrom(value.range.from || todayIST())
      setLocalTo(value.range.to   || todayIST())
      onChange({ preset: "custom", range: value.range })
      return
    }
    const range = presetToRange(preset)
    onChange({ preset, range })
    setOpen(false)
  }

  const applyCustom = () => {
    if (!localFrom || !localTo) return
    const from = localFrom <= localTo ? localFrom : localTo
    const to   = localFrom <= localTo ? localTo   : localFrom
    onChange({ preset: "custom", range: { from, to } })
    setOpen(false)
  }

  // Trigger label
  const triggerLabel = (() => {
    const p = value.preset
    if (p === "all")    return "All Time"
    if (p === "today")  return "Today"
    if (p === "yesterday") return "Yesterday"
    if (p === "7d")     return "Last 7 Days"
    if (p === "30d")    return "Last 30 Days"
    if (p === "month")  return "This Month"
    if (p === "custom" && value.range.from && value.range.to)
      return `${fmtShort(value.range.from)} – ${fmtShort(value.range.to)}`
    return "Date Range"
  })()

  const isActive = value.preset !== "all"

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-all",
          isActive
            ? "border-orange-400 bg-orange-50 text-orange-700 ring-2 ring-orange-100"
            : "border-slate-200 bg-slate-50 text-slate-600 hover:border-orange-300 hover:bg-white"
        )}
      >
        <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="max-w-[140px] truncate">{triggerLabel}</span>
        {isActive && (
          <button
            onClick={e => { e.stopPropagation(); onChange({ preset: "all", range: { from: "", to: "" } }) }}
            className="ml-0.5 rounded text-orange-400 hover:text-orange-700"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        <ChevronDownIcon className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[300px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          {/* Header */}
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Filter by Order Date</p>
          </div>

          {/* Presets */}
          <div className="p-3">
            <div className="grid grid-cols-3 gap-1.5">
              {PRESETS.filter(p => p.key !== "custom").map(preset => (
                <button
                  key={preset.key}
                  onClick={() => applyPreset(preset.key)}
                  className={cn(
                    "rounded-lg px-2 py-2 text-[11px] font-semibold transition-all",
                    value.preset === preset.key
                      ? "bg-orange-500 text-white shadow-sm"
                      : "bg-slate-50 text-slate-600 hover:bg-orange-50 hover:text-orange-700"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="mx-4 border-t border-slate-100" />

          {/* Custom range */}
          <div className="p-4">
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Custom Range</p>
            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">From</label>
                <input
                  type="date"
                  value={localFrom}
                  max={localTo || undefined}
                  onChange={e => {
                    setLocalFrom(e.target.value)
                    onChange({ preset: "custom", range: { from: e.target.value, to: localTo } })
                  }}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[12px] text-slate-700 transition focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">To</label>
                <input
                  type="date"
                  value={localTo}
                  min={localFrom || undefined}
                  onChange={e => {
                    setLocalTo(e.target.value)
                    onChange({ preset: "custom", range: { from: localFrom, to: e.target.value } })
                  }}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[12px] text-slate-700 transition focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
              </div>
            </div>
            <button
              onClick={applyCustom}
              disabled={!localFrom || !localTo}
              className="mt-3 w-full rounded-xl bg-orange-500 py-2 text-[12px] font-bold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-40"
            >
              Apply Range
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function RemainingBadge({ value }: { value: number }) {
  const cls =
    value === 0
      ? "text-green-700 bg-green-50 ring-green-200"
      : value > 100
      ? "text-red-700 bg-red-50 ring-red-200"
      : value > 20
      ? "text-amber-700 bg-amber-50 ring-amber-200"
      : "text-slate-700 bg-slate-50 ring-slate-200"
  return (
    <span className={cn("inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[11px] font-bold ring-1", cls)}>
      {value.toLocaleString()}
    </span>
  )
}

function StatusBadge({ status }: { status: "In Progress" | "Pending" }) {
  return status === "In Progress" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700 ring-1 ring-blue-200">
      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
      In Progress
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      Pending
    </span>
  )
}

function KpiCard({
  label, value, sub, accentBar, iconBg, iconText, icon: Icon,
}: {
  label: string
  value: string | number
  sub: string
  accentBar: string
  iconBg: string
  iconText: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={cn("h-1 w-full", accentBar)} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 leading-snug">{label}</p>
          <div className={cn("flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg", iconBg)}>
            <Icon className={cn("h-3.5 w-3.5", iconText)} />
          </div>
        </div>
        <div className="mt-2.5 text-[28px] font-bold leading-none text-slate-900 tabular-nums">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        <p className="mt-1.5 text-[10.5px] text-slate-400">{sub}</p>
      </div>
    </div>
  )
}

function SortButton({
  col, sortKey, sortDir, onSort, children,
}: {
  col: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSort: (k: SortKey) => void
  children: React.ReactNode
}) {
  const active = sortKey === col
  return (
    <button
      onClick={() => onSort(col)}
      className={cn(
        "flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide transition-colors",
        active ? "text-orange-400" : "text-white/60 hover:text-white"
      )}
    >
      {children}
      {active
        ? sortDir === "asc"
          ? <ChevronUp className="h-3 w-3" />
          : <ChevronDown className="h-3 w-3" />
        : <ArrowUpDown className="h-3 w-3 opacity-30" />
      }
    </button>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ReportsPage() {
  // ── Data ─────────────────────────────────────────────────────────────────
  const [rows, setRows]         = useState<ProductionQueueRow[]>([])
  const [kpiData, setKpiData]   = useState<ProductionKpiData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError]       = useState<string | null>(null)

  // ── UI ────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]           = useState<ReportTab>("production")
  const [search, setSearch]                 = useState("")
  const deferredSearch                      = useDeferredValue(search)
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>("all")
  const [customerFilter, setCustomerFilter] = useState("all")
  const [dateFilter, setDateFilter]         = useState<{ preset: DatePreset; range: DateRange }>({
    preset: "all", range: { from: "", to: "" },
  })
  const [sortKey, setSortKey]   = useState<SortKey>("orderNumber")
  const [sortDir, setSortDir]   = useState<SortDir>("asc")
  const [exporting, setExporting] = useState(false)
  const [countdown, setCountdown] = useState(60)

  const countdownRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout>  | null>(null)

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const result = await getProductionQueue()
      if (result.success) {
        setRows(result.data.rows)
        setKpiData(result.data.kpiData)
        setLastUpdated(new Date())
      } else {
        setError("Failed to load production data.")
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // ── Auto-refresh ──────────────────────────────────────────────────────────
  const resetAutoRefresh = useCallback(() => {
    if (countdownRef.current)    clearInterval(countdownRef.current)
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    setCountdown(60)
    countdownRef.current = setInterval(() =>
      setCountdown(p => (p <= 1 ? 60 : p - 1)), 1000)
    refreshTimerRef.current = setTimeout(() =>
      fetchData(true).then(() => resetAutoRefresh()), 60_000)
  }, [fetchData])

  useEffect(() => {
    fetchData(false).then(() => resetAutoRefresh())
    return () => {
      if (countdownRef.current)    clearInterval(countdownRef.current)
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [fetchData, resetAutoRefresh])

  const handleManualRefresh = () => fetchData(true).then(() => resetAutoRefresh())

  // ── Derived lists ─────────────────────────────────────────────────────────
  const customers = useMemo(
    () => Array.from(new Set(rows.map(r => r.customerName))).sort(),
    [rows]
  )

  // ── Filter → sort pipeline ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let out = rows

    // Text search
    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase()
      out = out.filter(r =>
        r.orderNumber.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.itemName.toLowerCase().includes(q)
      )
    }

    // Status
    if (statusFilter === "in-progress") out = out.filter(r => r.hasInProductionRecord)
    if (statusFilter === "pending")     out = out.filter(r => !r.hasInProductionRecord)

    // Customer
    if (customerFilter !== "all") out = out.filter(r => r.customerName === customerFilter)

    // Date range — slice to "YYYY-MM-DD" because orderDate is a full ISO timestamp
    const { from, to } = dateFilter.range
    if (from) out = out.filter(r => { const d = r.orderDate?.slice(0, 10); return !!d && d >= from })
    if (to)   out = out.filter(r => { const d = r.orderDate?.slice(0, 10); return !!d && d <= to  })

    return out
  }, [rows, deferredSearch, statusFilter, customerFilter, dateFilter])

  const sorted = useMemo(() => {
    const out = [...filtered]
    out.sort((a, b) => {
      let av: string | number, bv: string | number
      switch (sortKey) {
        case "orderNumber":  av = a.orderNumber;           bv = b.orderNumber;           break
        case "orderDate":    av = a.orderDate ?? "";       bv = b.orderDate ?? "";       break
        case "customerName": av = a.customerName;          bv = b.customerName;          break
        case "itemName":     av = a.itemName;              bv = b.itemName;              break
        case "ordered":      av = a.ordered;               bv = b.ordered;               break
        case "produced":     av = getProduced(a);          bv = getProduced(b);          break
        case "ip":           av = getInProgress(a);        bv = getInProgress(b);        break
        case "remaining":    av = getRemainingUntilDone(a);bv = getRemainingUntilDone(b);break
        default:             av = a.orderNumber;           bv = b.orderNumber
      }
      let cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" })
      return sortDir === "asc" ? cmp : -cmp
    })
    return out
  }, [filtered, sortKey, sortDir])

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(k); setSortDir("asc") }
  }

  // ── Stats (from filtered+sorted rows — matches what's visible in table) ───
  const stats = useMemo(() => ({
    totalOrders:  new Set(sorted.map(r => r.orderId)).size,
    totalItems:   sorted.length,
    pendingUnits: sorted.filter(r => !r.hasInProductionRecord && r.remainingUntilDone > 0)
                        .reduce((s, r) => s + r.remainingUntilDone, 0),
    inProdUnits:  sorted.filter(r => r.hasInProductionRecord)
                        .reduce((s, r) => s + r.remainingUntilDone, 0),
    produced:     sorted.reduce((s, r) => s + getProduced(r), 0),          // ← producedCompleted
    totalRem:     sorted.reduce((s, r) => s + r.remainingUntilDone, 0),
  }), [sorted])

  const hasFilters =
    !!search || statusFilter !== "all" ||
    customerFilter !== "all" || dateFilter.preset !== "all"

  const clearFilters = () => {
    setSearch(""); setStatusFilter("all")
    setCustomerFilter("all")
    setDateFilter({ preset: "all", range: { from: "", to: "" } })
  }

  // ── Export PDF ────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    setExporting(true)
    try {
      let logoDataUrl: string | undefined
      try {
        const res = await fetch("/images/logo.png")
        if (res.ok) {
          const blob = await res.blob()
          logoDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload  = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
        }
      } catch { /* logo not critical */ }
      const { blob, filename } = generateMorningReportPDF(sorted, logoDataUrl, kpiData ?? undefined)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 shadow-sm shadow-orange-200">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Reports</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">Live production analytics — auto-refreshes every 60 s</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Countdown ring */}
          {!loading && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <div className="relative flex h-6 w-6 items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
                  <circle
                    cx="12" cy="12" r="10" fill="none" stroke="#f97316" strokeWidth="2.5"
                    strokeDasharray={`${(countdown / 60) * 62.8} 62.8`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="relative text-[8px] font-bold text-orange-500">{countdown}</span>
              </div>
              <span className="text-[11px] font-medium text-slate-500">auto-refresh</span>
            </div>
          )}

          {lastUpdated && (
            <div className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500 shadow-sm sm:flex">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              Updated {fmtTime(lastUpdated)}
            </div>
          )}

          <button
            onClick={handleManualRefresh}
            disabled={refreshing || loading}
            title="Refresh now"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", (refreshing || loading) && "animate-spin")} />
          </button>

          <button
            onClick={handleExportPDF}
            disabled={exporting || loading || sorted.length === 0}
            className="flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-500 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-orange-600 active:scale-95 disabled:opacity-50"
          >
            {exporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export PDF
          </button>
        </div>
      </div>

      {/* ── Report type tabs ──────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {(
          [
            { key: "production", label: "Production", icon: Factory,    live: true  },
            { key: "sales",      label: "Sales",      icon: TrendingUp, live: false },
            { key: "inventory",  label: "Inventory",  icon: Package,    live: false },
          ] as const
        ).map(tab => (
          <button
            key={tab.key}
            onClick={() => tab.live && setActiveTab(tab.key as ReportTab)}
            disabled={!tab.live}
            className={cn(
              "flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition-all",
              activeTab === tab.key
                ? "bg-orange-500 text-white shadow-sm"
                : tab.live
                ? "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                : "cursor-not-allowed text-slate-300"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {!tab.live && (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Soon
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Production tab ────────────────────────────────────────────────── */}
      {activeTab === "production" && (
        <div className="space-y-5">

          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KpiCard label="Total Orders"    value={stats.totalOrders}  sub="Unique orders in view"      accentBar="bg-slate-500"  iconBg="bg-slate-50"  iconText="text-slate-500"  icon={BarChart3}    />
            <KpiCard label="Total Items"     value={stats.totalItems}   sub="Line items matching filters" accentBar="bg-indigo-500" iconBg="bg-indigo-50" iconText="text-indigo-500" icon={Package}      />
            <KpiCard label="Pending Units"   value={stats.pendingUnits} sub="Awaiting production"         accentBar="bg-amber-500"  iconBg="bg-amber-50"  iconText="text-amber-500"  icon={Clock}        />
            <KpiCard label="In Production"   value={stats.inProdUnits}  sub="Active batch units"          accentBar="bg-blue-500"   iconBg="bg-blue-50"   iconText="text-blue-500"   icon={Factory}      />
            <KpiCard label="Produced"        value={stats.produced}     sub="Completed batch qty"         accentBar="bg-green-500"  iconBg="bg-green-50"  iconText="text-green-500"  icon={CheckCircle2} />
            <KpiCard label="Total Remaining" value={stats.totalRem}     sub="Units until done"            accentBar="bg-orange-500" iconBg="bg-orange-50" iconText="text-orange-500" icon={AlertCircle}  />
          </div>

          {/* Filter toolbar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2.5">

              {/* Search */}
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search order, customer, item…"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-8 text-[13px] text-slate-800 placeholder-slate-400 transition focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Status pills */}
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                {([
                  { key: "all",         label: "All"         },
                  { key: "in-progress", label: "In Progress" },
                  { key: "pending",     label: "Pending"     },
                ] as { key: StatusFilter; label: string }[]).map(s => (
                  <button
                    key={s.key}
                    onClick={() => setStatusFilter(s.key)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all",
                      statusFilter === s.key
                        ? "bg-white text-orange-600 shadow-sm ring-1 ring-slate-200"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Customer */}
              <select
                value={customerFilter}
                onChange={e => setCustomerFilter(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-700 transition focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
              >
                <option value="all">All Customers</option>
                {customers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              {/* Date range picker */}
              <DateRangePicker value={dateFilter} onChange={setDateFilter} />

              {/* Clear all */}
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-semibold text-red-600 transition hover:bg-red-100"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear All
                </button>
              )}

              {/* Row count */}
              <div className="ml-auto flex items-center gap-1.5 text-[12px] text-slate-500">
                <Filter className="h-3.5 w-3.5" />
                <span>
                  <span className="font-semibold text-slate-800">{sorted.length}</span> of {rows.length} items
                </span>
              </div>
            </div>

            {/* Active filter chips */}
            {hasFilters && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Active:</span>
                {search && (
                  <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                    Search: "{search}"
                    <button onClick={() => setSearch("")}><X className="h-3 w-3 text-slate-400 hover:text-slate-600" /></button>
                  </span>
                )}
                {statusFilter !== "all" && (
                  <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                    {statusFilter === "in-progress" ? "In Progress" : "Pending"}
                    <button onClick={() => setStatusFilter("all")}><X className="h-3 w-3 text-blue-400 hover:text-blue-700" /></button>
                  </span>
                )}
                {customerFilter !== "all" && (
                  <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700">
                    {customerFilter}
                    <button onClick={() => setCustomerFilter("all")}><X className="h-3 w-3 text-indigo-400 hover:text-indigo-700" /></button>
                  </span>
                )}
                {dateFilter.preset !== "all" && (
                  <span className="flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-medium text-orange-700">
                    <Calendar className="h-3 w-3" />
                    {dateFilter.preset === "custom" && dateFilter.range.from
                      ? `${fmtShort(dateFilter.range.from)} – ${fmtShort(dateFilter.range.to)}`
                      : PRESETS.find(p => p.key === dateFilter.preset)?.label}
                    <button onClick={() => setDateFilter({ preset: "all", range: { from: "", to: "" } })}>
                      <X className="h-3 w-3 text-orange-400 hover:text-orange-700" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-24">
                <RefreshCw className="h-8 w-8 animate-spin text-orange-400" />
                <p className="text-sm font-medium text-slate-500">Loading production data…</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center gap-3 py-24">
                <AlertCircle className="h-8 w-8 text-red-400" />
                <p className="text-sm text-red-500">{error}</p>
                <button onClick={() => fetchData(false)} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600">
                  Retry
                </button>
              </div>
            ) : sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-24">
                <CheckCircle2 className="h-10 w-10 text-green-400" />
                <p className="text-base font-semibold text-slate-700">No items match your filters</p>
                <p className="text-sm text-slate-400">Try adjusting the search, status, or date filter.</p>
                {hasFilters && (
                  <button onClick={clearFilters} className="mt-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#1e293b]">
                      <th className="w-10 py-3.5 pl-4 text-center text-[10px] font-semibold uppercase tracking-widest text-white/40">#</th>
                      <th className="py-3.5 pl-3 pr-2 text-left"><SortButton col="orderNumber"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Order #</SortButton></th>
                      <th className="py-3.5 px-2 text-left">       <SortButton col="orderDate"    sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Date</SortButton></th>
                      <th className="py-3.5 px-2 text-left">       <SortButton col="customerName" sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Customer</SortButton></th>
                      <th className="py-3.5 px-2 text-left">       <SortButton col="itemName"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Item</SortButton></th>
                      <th className="py-3.5 px-2 text-center text-[11px] font-semibold uppercase tracking-wide text-white/60">Batch</th>
                      <th className="py-3.5 px-2 text-right">      <SortButton col="ordered"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Ordered</SortButton></th>
                      <th className="py-3.5 px-2 text-right">      <SortButton col="produced"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Produced</SortButton></th>
                      <th className="py-3.5 px-2 text-right">      <SortButton col="ip"           sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>IP</SortButton></th>
                      <th className="py-3.5 px-2 text-right">      <SortButton col="remaining"    sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>Remaining</SortButton></th>
                      <th className="py-3.5 px-4 text-center text-[11px] font-semibold uppercase tracking-wide text-white/60">Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {sorted.map((row, idx) => {
                      const produced  = getProduced(row)         // producedCompleted — matches PDF
                      const ip        = getInProgress(row)
                      const remaining = getRemainingUntilDone(row)
                      const status    = getRowStatus(row)
                      const batch     = row.activeBatchLabels?.length
                        ? row.activeBatchLabels.join(", ")
                        : row.completedBatchLabels?.length
                        ? row.completedBatchLabels.join(", ")
                        : "—"

                      return (
                        <tr
                          key={`${row.orderId}-${row.itemId}`}
                          className={cn(
                            "group border-b border-slate-100 transition-colors last:border-b-0 hover:bg-orange-50",
                            idx % 2 === 0 ? "bg-white" : "bg-orange-50/30"
                          )}
                        >
                          <td className="py-3 pl-4 text-center text-[11px] font-medium text-slate-400">{idx + 1}</td>

                          <td className="py-3 pl-3 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="h-4 w-[3px] rounded-r-full bg-orange-400" />
                              <span className="text-[12px] font-bold text-orange-600">{row.orderNumber}</span>
                            </div>
                          </td>

                          <td className="whitespace-nowrap py-3 px-2 text-[11px] text-slate-500">{fmtDate(row.orderDate)}</td>

                          <td className="max-w-[150px] py-3 px-2">
                            <span className="block truncate text-[12px] font-medium text-slate-800">{row.customerName}</span>
                          </td>

                          <td className="max-w-[170px] py-3 px-2">
                            <span className="block truncate text-[12px] text-slate-700">{row.itemName}</span>
                          </td>

                          <td className="py-3 px-2 text-center">
                            {batch !== "—" ? (
                              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                {batch}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-300">—</span>
                            )}
                          </td>

                          <td className="py-3 px-2 text-right text-[12px] font-medium text-slate-700">
                            {row.ordered.toLocaleString()}
                          </td>

                          <td className="py-3 px-2 text-right text-[12px] font-semibold">
                            {produced > 0
                              ? <span className="text-green-700">{produced.toLocaleString()}</span>
                              : <span className="font-normal text-slate-300">—</span>
                            }
                          </td>

                          <td className="py-3 px-2 text-right text-[12px] font-semibold">
                            {ip > 0
                              ? <span className="text-blue-600">{ip.toLocaleString()}</span>
                              : <span className="font-normal text-slate-300">—</span>
                            }
                          </td>

                          <td className="py-3 px-2 text-right"><RemainingBadge value={remaining} /></td>

                          <td className="py-3 px-4 text-center"><StatusBadge status={status} /></td>
                        </tr>
                      )
                    })}
                  </tbody>

                  {/* Totals footer */}
                  <tfoot>
                    <tr className="bg-[#1e293b]">
                      <td colSpan={6} className="py-3.5 pl-5 text-[11px] font-bold uppercase tracking-widest text-white/50">
                        Totals — {sorted.length} items
                      </td>
                      <td className="py-3.5 px-2 text-right text-[13px] font-bold text-white">
                        {sorted.reduce((s, r) => s + r.ordered, 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-2 text-right text-[13px] font-bold text-green-400">
                        {stats.produced.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-2 text-right text-[13px] font-bold text-blue-400">
                        {sorted.reduce((s, r) => s + getInProgress(r), 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-2 text-right text-[13px] font-bold text-orange-400">
                        {stats.totalRem.toLocaleString()}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Bottom bar */}
          {!loading && sorted.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm">
              <div className="flex items-center gap-3 text-[12px] text-slate-500">
                <span>
                  <span className="font-semibold text-slate-800">{sorted.length}</span> items across{" "}
                  <span className="font-semibold text-slate-800">{stats.totalOrders}</span> orders
                </span>
                {hasFilters && (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-600">
                    FILTERED
                  </span>
                )}
              </div>
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-[12px] font-semibold text-orange-600 transition hover:bg-orange-500 hover:text-white disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                {exporting ? "Generating…" : "Download PDF"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
