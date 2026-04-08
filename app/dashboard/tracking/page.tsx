"use client"

import { useState, useEffect, useCallback, useDeferredValue } from "react"
import {
  Truck,
  Package,
  PackageCheck,
  Clock,
  Search,
  ExternalLink,
  RefreshCw,
  Loader2,
  X,
  AlertTriangle,
  SlidersHorizontal,
  ChevronDown,
  Download,
} from "lucide-react"
import XLSX from "xlsx-js-style"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getCourierCompanies } from "@/app/actions/management"
import {
  getShipmentsDashboard,
  getShipmentSummary,
} from "@/app/actions/tracking"
import {
  type ShipmentRow,
  type ShipmentSummary,
  type ShipmentFilters,
  type ShipmentStatus,
  SHIPMENT_STATUS_LABELS,
} from "@/app/actions/tracking-types"
import { getOrdersExportData } from "@/app/actions/orders"
import { ShipmentDetailDrawer } from "@/components/tracking/ShipmentDetailDrawer"
import { cn } from "@/lib/utils"

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return "—"
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return "—"
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

// ── Simplified status display ──────────────────────────────────────────────
// Internal DB statuses are grouped into 3 user-facing labels.

type SimpleStatus = "ready" | "picked_up" | "delivered" | "other"

function simplify(status: string): SimpleStatus {
  if (["pending", "ready"].includes(status))                          return "ready"
  if (["picked_up", "in_transit", "out_for_delivery"].includes(status)) return "picked_up"
  if (status === "delivered")                                           return "delivered"
  return "other"
}

const SIMPLE_BADGE: Record<SimpleStatus, string> = {
  ready:     "bg-amber-50  text-amber-800  border-amber-200",
  picked_up: "bg-blue-50   text-blue-700   border-blue-200",
  delivered: "bg-green-50  text-green-800  border-green-200",
  other:     "bg-slate-100 text-slate-600  border-slate-200",
}

const SIMPLE_LABEL: Record<SimpleStatus, string> = {
  ready:     "Ready",
  picked_up: "Picked Up",
  delivered: "Delivered",
  other:     "",           // filled dynamically
}

// Override labels for "other" category (failures, RTO, etc.)
const OTHER_LABELS: Record<string, string> = {
  failed_delivery: "Failed Delivery",
  rto_initiated:   "RTO Initiated",
  returned:        "Returned",
  cancelled:       "Cancelled",
}

const OTHER_BADGE: Record<string, string> = {
  failed_delivery: "bg-red-50    text-red-800    border-red-200",
  rto_initiated:   "bg-orange-100 text-orange-800 border-orange-300",
  returned:        "bg-purple-50  text-purple-700 border-purple-200",
  cancelled:       "bg-slate-100  text-slate-500  border-slate-200",
}

function StatusBadge({ status }: { status: string }) {
  const s = simplify(status)
  const cls   = s === "other" ? (OTHER_BADGE[status]  ?? SIMPLE_BADGE.other) : SIMPLE_BADGE[s]
  const label = s === "other" ? (OTHER_LABELS[status] ?? status)             : SIMPLE_LABEL[s]
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>
      {label}
    </span>
  )
}

// ── Status filter options (simplified) ──────────────────────────────────────

const STATUS_FILTER_OPTIONS = [
  { value: "all",       label: "All Statuses",  dbStatuses: null },
  { value: "ready",     label: "Ready",          dbStatuses: ["pending", "ready"] },
  { value: "picked_up", label: "Picked Up",      dbStatuses: ["picked_up", "in_transit", "out_for_delivery"] },
  { value: "delivered", label: "Delivered",      dbStatuses: ["delivered"] },
] as const

type StatusFilterValue = typeof STATUS_FILTER_OPTIONS[number]["value"]

// ── Summary card ───────────────────────────────────────────────────────────

function SummaryCard({
  label, value, icon: Icon, color, accentBorder, activeColor, onClick, active,
}: {
  label:        string
  value:        number
  icon:         React.ElementType
  color:        string
  accentBorder: string   // e.g. "border-l-blue-500"
  activeColor:  string   // e.g. "text-blue-600"
  onClick:      () => void
  active:       boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex w-full flex-col gap-2 rounded-xl border border-l-4 p-4 text-left transition-all duration-150",
        "hover:shadow-md",
        accentBorder,
        active
          ? "bg-sk-primary/5 shadow-sm"
          : "border-sk-border bg-white hover:bg-slate-50",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-sk-text-2">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <span className={cn("text-2xl font-bold", active ? activeColor : "text-sk-text-1")}>
        {value}
      </span>
    </button>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function TrackingCommandCenter() {
  const [shipments,  setShipments]  = useState<ShipmentRow[]>([])
  const [summary,    setSummary]    = useState<ShipmentSummary | null>(null)
  const [couriers,   setCouriers]   = useState<{ id: string; name: string }[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)

  // Filters
  const [search,    setSearch]    = useState("")
  const [courier,   setCourier]   = useState("all")
  const [status,    setStatus]    = useState<StatusFilterValue>("all")
  const [dateFrom,  setDateFrom]  = useState("")
  const [dateTo,    setDateTo]    = useState("")

  // Active KPI card filter — "active" is the default on mount
  const [cardFilter, setCardFilter] = useState<string | null>("active")

  // Collapsible filter panel
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Drawer
  const [selected,   setSelected]   = useState<ShipmentRow | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Selection for export
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set())
  const [exportLoading,  setExportLoading]  = useState(false)

  const deferredSearch = useDeferredValue(search)

  // Load couriers once
  useEffect(() => {
    getCourierCompanies().then((res) => {
      if (res.success && res.data) {
        setCouriers(res.data.map((c: any) => ({ id: c.id, name: c.name })))
      }
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const filters: ShipmentFilters = {
      courier_id: courier !== "all" ? courier : undefined,
      date_from:  dateFrom || undefined,
      date_to:    dateTo   || undefined,
      search:     deferredSearch || undefined,
      // status filtering is handled client-side (grouped statuses)
    }

    const [shipmentsRes, summaryRes] = await Promise.all([
      getShipmentsDashboard(filters),
      getShipmentSummary(),
    ])

    if (!shipmentsRes.success) {
      setError(shipmentsRes.error ?? "Failed to load shipments.")
    } else {
      setShipments(shipmentsRes.data ?? [])
    }

    if (summaryRes.success && summaryRes.data) {
      setSummary(summaryRes.data)
    }

    setLoading(false)
  }, [courier, dateFrom, dateTo, deferredSearch])

  useEffect(() => { void load() }, [load])

  const openDrawer = (row: ShipmentRow) => {
    setSelected(row)
    setDrawerOpen(true)
  }

  const clearFilters = () => {
    setSearch("")
    setCourier("all")
    setStatus("all")
    setDateFrom("")
    setDateTo("")
    setCardFilter("active") // reset to default, not null
  }

  // ── Selection helpers ────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const someSelected = selectedIds.size > 0

  // ── Excel Export ─────────────────────────────────────────────────────────

  const handleExport = async () => {
    const rows = displayedShipments.filter((r) => selectedIds.has(r.dispatch_id))
    if (rows.length === 0) return

    setExportLoading(true)
    try {
      const orderIds = rows.map((r) => r.order_id)
      const res = await getOrdersExportData(orderIds)
      const orderDataMap = new Map((res.data ?? []).map((o) => [o.orderId, o]))

      // ── Build structured data ──────────────────────────────────────────────
      const dataRows = rows.map((row, idx) => {
        const od = orderDataMap.get(row.order_id)
        const rawItems = od?.item_details ?? ""
        const itemsFormatted = rawItems
          ? rawItems.split(", ").map((i: string) => `• ${i}`).join("\n")
          : "—"
        return {
          sr:        idx + 1,
          order:     row.order_number,
          so:        row.sales_order_number ?? "—",
          invoice:   od?.invoice_number ?? "—",
          orderDate: od?.created_at ?? "—",
          customer:  row.customer_name,
          phone:     row.customer_phone ?? "—",
          address:   od?.ship_to ?? "—",
          items:     itemsFormatted,
          itemLines: rawItems ? rawItems.split(", ").length : 1,
          courier:   row.courier_name,
          tracking:  row.tracking_id ?? "—",
          statusKey: row.shipment_status,
          status:    SHIPMENT_STATUS_LABELS[row.shipment_status as ShipmentStatus] ?? row.shipment_status,
          dispatch:  formatDate(row.dispatch_date),
          eta:       formatDate(row.estimated_delivery),
          overdue:   row.is_delayed,
          location:  row.current_location ?? "—",
        }
      })

      // ── Column definitions ─────────────────────────────────────────────────
      const COLS = [
        { h: "#",             w: 5  },
        { h: "Order #",       w: 14 },
        { h: "Sales Order #", w: 16 },
        { h: "Invoice #",     w: 14 },
        { h: "Order Date",    w: 18 },
        { h: "Customer",      w: 26 },
        { h: "Phone",         w: 15 },
        { h: "Ship To",       w: 32 },
        { h: "Items",         w: 40 },
        { h: "Courier",       w: 18 },
        { h: "Tracking ID",   w: 24 },
        { h: "Status",        w: 20 },
        { h: "Dispatch Date", w: 16 },
        { h: "ETA",           w: 16 },
        { h: "Overdue",       w: 10 },
        { h: "Location",      w: 24 },
      ] as const
      const NC = COLS.length

      // ── Colour palette ─────────────────────────────────────────────────────
      const P = {
        titleBg:  "1E293B",  // dark navy
        titleFg:  "FFFFFF",
        subtleBg: "334155",
        subtleFg: "F1F5F9",
        infoBg:   "F8FAFC",
        infoFg:   "64748B",
        hdrBg:    "F59E0B",  // amber
        hdrFg:    "1C1917",
        hdrBdr:   "D97706",
        rowA:     "FFFBEB",  // warm cream (even)
        rowB:     "FFFFFF",  // white (odd)
        cellBdr:  "E2E8F0",
        // Status fills & fonts
        sta: {
          pending:          { bg: "FEF3C7", fg: "92400E" },
          ready:            { bg: "FEF3C7", fg: "92400E" },
          picked_up:        { bg: "DBEAFE", fg: "1E40AF" },
          in_transit:       { bg: "DBEAFE", fg: "1E40AF" },
          out_for_delivery: { bg: "E0F2FE", fg: "075985" },
          delivered:        { bg: "D1FAE5", fg: "065F46" },
          failed_delivery:  { bg: "FEE2E2", fg: "991B1B" },
          rto_initiated:    { bg: "FFEDD5", fg: "9A3412" },
          returned:         { bg: "EDE9FE", fg: "5B21B6" },
          cancelled:        { bg: "F3F4F6", fg: "6B7280" },
        } as Record<string, { bg: string; fg: string }>,
        overdueCell: { bg: "FEE2E2", fg: "B91C1C" },
        okCell:      { bg: "D1FAE5", fg: "065F46" },
      }

      // ── Style factories ────────────────────────────────────────────────────
      const thin = (rgb: string) => ({ style: "thin" as const, color: { rgb } })
      const med  = (rgb: string) => ({ style: "medium" as const, color: { rgb } })

      const allBorders = (c: string) => ({ top: thin(c), bottom: thin(c), left: thin(c), right: thin(c) })
      const hdrBorders = () => ({
        top:    med(P.hdrBdr),
        bottom: med(P.hdrBdr),
        left:   thin(P.hdrBdr),
        right:  thin(P.hdrBdr),
      })
      const outerBorder = () => ({
        top: med("94A3B8"), bottom: med("94A3B8"), left: med("94A3B8"), right: med("94A3B8"),
      })

      const ws: Record<string, any> = {}
      const put = (r: number, c: number, v: any, s: any, t?: string) => {
        ws[XLSX.utils.encode_cell({ r, c })] = {
          v,
          t: t ?? (typeof v === "number" ? "n" : "s"),
          s,
        }
      }

      // ── Row 0 — Title ──────────────────────────────────────────────────────
      for (let c = 0; c < NC; c++) {
        put(0, c, c === 0 ? "SUNKOOL MANAGEMENT SYSTEM" : "", {
          fill: { fgColor: { rgb: P.titleBg } },
          font: { bold: true, sz: 16, color: { rgb: P.titleFg }, name: "Calibri" },
          alignment: { horizontal: "center", vertical: "center" },
          border: outerBorder(),
        })
      }

      // ── Row 1 — Subtitle ──────────────────────────────────────────────────
      for (let c = 0; c < NC; c++) {
        put(1, c, c === 0 ? "Shipment Tracking Report" : "", {
          fill: { fgColor: { rgb: P.subtleBg } },
          font: { bold: true, sz: 11, color: { rgb: P.subtleFg }, name: "Calibri" },
          alignment: { horizontal: "center", vertical: "center" },
          border: outerBorder(),
        })
      }

      // ── Row 2 — Metadata ──────────────────────────────────────────────────
      const now = new Date()
      const metaText =
        `Generated: ${now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}` +
        `   •   ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` +
        `   |   Shipments Exported: ${dataRows.length}` +
        `   |   Delivered: ${dataRows.filter(r => r.statusKey === "delivered").length}` +
        `   |   In Transit: ${dataRows.filter(r => ["picked_up","in_transit","out_for_delivery"].includes(r.statusKey)).length}` +
        `   |   Overdue: ${dataRows.filter(r => r.overdue).length}`

      for (let c = 0; c < NC; c++) {
        put(2, c, c === 0 ? metaText : "", {
          fill: { fgColor: { rgb: P.infoBg } },
          font: { italic: true, sz: 9, color: { rgb: P.infoFg }, name: "Calibri" },
          alignment: { horizontal: c === 0 ? "left" : "center", vertical: "center" },
          border: { bottom: thin("CBD5E1") },
        })
      }

      // ── Row 3 — Column Headers ────────────────────────────────────────────
      for (let c = 0; c < NC; c++) {
        put(3, c, COLS[c].h, {
          fill: { fgColor: { rgb: P.hdrBg } },
          font: { bold: true, sz: 10, color: { rgb: P.hdrFg }, name: "Calibri" },
          alignment: { horizontal: "center", vertical: "center" },
          border: hdrBorders(),
        })
      }

      // ── Rows 4+ — Data ───────────────────────────────────────────────────
      const DR = 4
      dataRows.forEach((row, ri) => {
        const r = DR + ri
        const bg = ri % 2 === 0 ? P.rowA : P.rowB
        const base = (extra?: Partial<{ horizontal: string; vertical: string; wrapText: boolean }>) => ({
          fill: { fgColor: { rgb: bg } },
          font: { sz: 9, name: "Calibri", color: { rgb: "374151" } },
          alignment: { horizontal: "left", vertical: "center", wrapText: false, ...extra },
          border: allBorders(P.cellBdr),
        })

        const vals = [
          row.sr,       // 0  — #
          row.order,    // 1  — Order #
          row.so,       // 2  — Sales Order #
          row.invoice,  // 3  — Invoice #
          row.orderDate,// 4  — Order Date
          row.customer, // 5  — Customer
          row.phone,    // 6  — Phone
          row.address,  // 7  — Ship To
          row.items,    // 8  — Items
          row.courier,  // 9  — Courier
          row.tracking, // 10 — Tracking ID
          row.status,   // 11 — Status
          row.dispatch, // 12 — Dispatch Date
          row.eta,      // 13 — ETA
          row.overdue ? "YES" : "No",  // 14 — Overdue
          row.location, // 15 — Location
        ]

        vals.forEach((val, c) => {
          let style: any

          if (c === 0) {
            // Sr. — centered, bold
            style = { ...base({ horizontal: "center" }), font: { sz: 9, bold: true, name: "Calibri", color: { rgb: "374151" } } }
          } else if (c === 8) {
            // Items — top-align + wrap
            style = base({ horizontal: "left", vertical: "top", wrapText: true })
          } else if (c === 11) {
            // Status — color-coded chip look
            const sc = P.sta[row.statusKey] ?? { bg: bg, fg: "374151" }
            style = {
              fill:      { fgColor: { rgb: sc.bg } },
              font:      { bold: true, sz: 9, name: "Calibri", color: { rgb: sc.fg } },
              alignment: { horizontal: "center", vertical: "center" },
              border:    allBorders(P.cellBdr),
            }
          } else if (c === 14) {
            // Overdue — red/green
            const sc = row.overdue ? P.overdueCell : P.okCell
            style = {
              fill:      { fgColor: { rgb: sc.bg } },
              font:      { bold: true, sz: 9, name: "Calibri", color: { rgb: sc.fg } },
              alignment: { horizontal: "center", vertical: "center" },
              border:    allBorders(P.cellBdr),
            }
          } else if (c === 1 || c === 10) {
            // Order # and Tracking — monospaced feel, slightly bold
            style = { ...base(), font: { sz: 9, bold: true, name: "Courier New", color: { rgb: "1E40AF" } } }
          } else {
            style = base()
          }

          put(r, c, val, style, typeof val === "number" ? "n" : "s")
        })
      })

      // ── Summary footer row ────────────────────────────────────────────────
      const sumR = DR + dataRows.length + 1
      const sumText =
        `Total Exported: ${dataRows.length}` +
        `   |   ✓ Delivered: ${dataRows.filter(r => r.statusKey === "delivered").length}` +
        `   |   ↑ In Transit: ${dataRows.filter(r => ["picked_up","in_transit","out_for_delivery"].includes(r.statusKey)).length}` +
        `   |   ⚠ Overdue: ${dataRows.filter(r => r.overdue).length}` +
        `   |   ✗ Failed/RTO: ${dataRows.filter(r => ["failed_delivery","rto_initiated","returned"].includes(r.statusKey)).length}`

      for (let c = 0; c < NC; c++) {
        put(sumR, c, c === 0 ? sumText : "", {
          fill: { fgColor: { rgb: P.titleBg } },
          font: { bold: true, sz: 9, color: { rgb: P.titleFg }, name: "Calibri" },
          alignment: { horizontal: c === 0 ? "left" : "center", vertical: "center" },
          border: { top: med("94A3B8") },
        })
      }

      // ── Worksheet settings ────────────────────────────────────────────────
      ws["!ref"]    = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: sumR, c: NC - 1 })
      ws["!cols"]   = COLS.map(col => ({ wch: col.w }))
      ws["!rows"]   = [
        { hpt: 32 },  // title
        { hpt: 24 },  // subtitle
        { hpt: 18 },  // metadata
        { hpt: 24 },  // headers
        ...dataRows.map(row => ({ hpt: Math.max(18, row.itemLines * 14 + 4) })),
        { hpt: 6  },  // spacer
        { hpt: 20 },  // summary
      ]
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: NC - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: NC - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: NC - 1 } },
        { s: { r: sumR, c: 0 }, e: { r: sumR, c: NC - 1 } },
      ]

      // ── Write file ────────────────────────────────────────────────────────
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Shipments")
      XLSX.writeFile(wb, `sunkool-shipments-${now.toISOString().slice(0, 10)}.xlsx`)
    } finally {
      setExportLoading(false)
    }
  }

  // "active" card is the default — don't count it as an active filter
  const filterCount = [!!search, courier !== "all", status !== "all", !!dateFrom, !!dateTo].filter(Boolean).length
  const hasActiveFilters = filterCount > 0 || (cardFilter !== null && cardFilter !== "active")

  // Card click — toggle between the clicked filter and the "active" default
  const handleCardClick = (filterKey: string) => {
    setCardFilter((prev) => (prev === filterKey ? "active" : filterKey))
    setStatus("all")
  }

  // ── Client-side filter chain ─────────────────────────────────────────────

  // 1. Apply simplified status dropdown filter
  const statusOption = STATUS_FILTER_OPTIONS.find((o) => o.value === status)
  const afterStatus = statusOption?.dbStatuses
    ? shipments.filter((r) => (statusOption.dbStatuses as readonly string[]).includes(r.shipment_status))
    : shipments

  // 2. Apply KPI card filter
  const displayedShipments = cardFilter
    ? afterStatus.filter((r) => {
        if (cardFilter === "active")       return ["pending","ready","picked_up","in_transit","out_for_delivery"].includes(r.shipment_status)
        if (cardFilter === "in_transit")   return ["picked_up","in_transit","out_for_delivery"].includes(r.shipment_status)
        if (cardFilter === "delivery_due") return r.is_delayed || r.is_stuck
        if (cardFilter === "delivered")    return r.shipment_status === "delivered"
        return true
      })
    : afterStatus

  const allVisibleSelected =
    displayedShipments.length > 0 &&
    displayedShipments.every((r) => selectedIds.has(r.dispatch_id))

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(displayedShipments.map((r) => r.dispatch_id)))
    }
  }

  return (
    <div className="space-y-5">

      {/* ── 4 KPI Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label="Active Shipments"
          value={summary?.total_active ?? 0}
          icon={Package}
          color="bg-blue-100 text-blue-600"
          accentBorder="border-l-blue-500"
          activeColor="text-blue-600"
          onClick={() => handleCardClick("active")}
          active={cardFilter === "active"}
        />
        <SummaryCard
          label="In Transit"
          value={summary?.in_transit ?? 0}
          icon={Truck}
          color="bg-indigo-100 text-indigo-600"
          accentBorder="border-l-indigo-500"
          activeColor="text-indigo-600"
          onClick={() => handleCardClick("in_transit")}
          active={cardFilter === "in_transit"}
        />
        <SummaryCard
          label="Delivery Due"
          value={summary?.delivery_due ?? 0}
          icon={Clock}
          color="bg-amber-100 text-amber-600"
          accentBorder="border-l-amber-500"
          activeColor="text-amber-600"
          onClick={() => handleCardClick("delivery_due")}
          active={cardFilter === "delivery_due"}
        />
        <SummaryCard
          label="Delivered"
          value={summary?.delivered ?? 0}
          icon={PackageCheck}
          color="bg-green-100 text-green-600"
          accentBorder="border-l-green-500"
          activeColor="text-green-600"
          onClick={() => handleCardClick("delivered")}
          active={cardFilter === "delivered"}
        />
      </div>

      {/* ── Main card ── */}
      <Card className="border-sk-border bg-white">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-sk-border bg-[#fcf7f2] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-sk-text-1">All Shipments</h2>
            <p className="text-xs text-sk-text-2">
              {loading ? "Loading…" : `${displayedShipments.length} shipment${displayedShipments.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 gap-1.5 text-xs text-sk-text-2 hover:text-sk-text-1">
                <X className="h-3.5 w-3.5" /> Clear filters
              </Button>
            )}
            {/* Export button — visible when rows are selected */}
            {someSelected && (
              <Button
                size="sm"
                onClick={() => void handleExport()}
                disabled={exportLoading}
                className="h-8 gap-1.5 bg-green-600 text-xs text-white hover:bg-green-700"
              >
                {exportLoading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Download className="h-3.5 w-3.5" />
                }
                Export ({selectedIds.size})
              </Button>
            )}
            {/* Filters toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen((v) => !v)}
              className={cn(
                "h-8 gap-1.5 border-sk-border text-xs",
                filtersOpen && "bg-sk-primary/5 border-sk-primary text-sk-primary",
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {filterCount > 0 && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sk-primary px-1 text-[10px] font-bold text-white">
                  {filterCount}
                </span>
              )}
              <ChevronDown className={cn("h-3 w-3 transition-transform", filtersOpen && "rotate-180")} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="h-8 gap-1.5 border-sk-border text-xs">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ── Smart Filters (collapsible) ── */}
        {filtersOpen && (
          <div className="grid grid-cols-2 gap-2 border-b border-sk-border bg-sk-page-bg/50 px-5 py-3 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center">
            {/* Search */}
            <div className="relative col-span-2 sm:col-span-3 lg:flex-1 lg:min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sk-text-3" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Order #, sales order, tracking ID, customer…"
                className="h-9 border-sk-border bg-white pl-8 text-sm focus-visible:ring-sk-primary"
              />
            </div>

            {/* Status (simplified) */}
            <Select value={status} onValueChange={(v) => {
              setStatus(v as StatusFilterValue)
              // restore the default card when clearing the status dropdown
              setCardFilter(v === "all" ? "active" : null)
            }}>
              <SelectTrigger className="h-9 border-sk-border bg-white text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Courier */}
            <Select value={courier} onValueChange={(v) => { setCourier(v); setCardFilter(null) }}>
              <SelectTrigger className="h-9 border-sk-border bg-white text-sm">
                <SelectValue placeholder="Courier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Couriers</SelectItem>
                {couriers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date From */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-sk-text-3 pl-0.5">Dispatch From</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 border-sk-border bg-white text-sm"
              />
            </div>

            {/* Date To */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-sk-text-3 pl-0.5">Dispatch To</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 border-sk-border bg-white text-sm"
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-5 mt-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-sk-text-3">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Loading shipments…</span>
            </div>
          ) : displayedShipments.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Package className="h-10 w-10 text-sk-text-3" />
              <p className="text-sm font-medium text-sk-text-1">No shipments found</p>
              <p className="text-sm text-sk-text-2">
                {hasActiveFilters ? "Try adjusting your filters." : "Shipments will appear here once orders are dispatched."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table
                  overflow-x:clip keeps content inside without creating a scroll
                  container — the only way sticky <th> works with the page scroll. */}
              <div className="hidden md:block" style={{ overflowX: "clip" }}>
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col style={{ width: 44  }} />  {/* Checkbox      */}
                    <col style={{ width: 108 }} />  {/* Order #       */}
                    <col style={{ width: 124 }} />  {/* Sales Order # */}
                    <col style={{ width: 168 }} />  {/* Customer      */}
                    <col style={{ width: 116 }} />  {/* Courier       */}
                    <col style={{ width: 148 }} />  {/* Tracking ID   */}
                    <col style={{ width: 116 }} />  {/* Status        */}
                    <col style={{ width: 108 }} />  {/* Dispatched    */}
                    <col style={{ width: 108 }} />  {/* ETA           */}
                    <col style={{ width: 68  }} />  {/* View          */}
                  </colgroup>
                  <thead>
                    <tr className="text-left">
                      <th className="sticky top-[68px] z-10 border-b border-sk-border bg-sk-page-bg px-3 py-3">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 cursor-pointer rounded border-sk-border accent-sk-primary"
                          title="Select all"
                        />
                      </th>
                      <th className="sticky top-[68px] z-10 border-b border-sk-border bg-sk-page-bg px-5 py-3 text-xs font-semibold text-sk-text-2">Order #</th>
                      <th className="sticky top-[68px] z-10 border-b border-sk-border bg-sk-page-bg px-4 py-3 text-xs font-semibold text-sk-text-2">Sales Order #</th>
                      <th className="sticky top-[68px] z-10 border-b border-sk-border bg-sk-page-bg px-4 py-3 text-xs font-semibold text-sk-text-2">Customer</th>
                      <th className="sticky top-[68px] z-10 border-b border-sk-border bg-sk-page-bg px-4 py-3 text-xs font-semibold text-sk-text-2">Courier</th>
                      <th className="sticky top-[68px] z-10 border-b border-sk-border bg-sk-page-bg px-4 py-3 text-xs font-semibold text-sk-text-2">Tracking ID</th>
                      <th className="sticky top-[68px] z-10 border-b border-sk-border bg-sk-page-bg px-4 py-3 text-xs font-semibold text-sk-text-2">Status</th>
                      <th className="sticky top-[68px] z-10 border-b border-sk-border bg-sk-page-bg px-4 py-3 text-xs font-semibold text-sk-text-2">Dispatched</th>
                      <th className="sticky top-[68px] z-10 border-b border-sk-border bg-sk-page-bg px-4 py-3 text-xs font-semibold text-sk-text-2">ETA</th>
                      <th className="sticky top-[68px] z-10 border-b border-sk-border bg-sk-page-bg px-4 py-3 text-xs font-semibold text-sk-text-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sk-border">
                    {displayedShipments.map((row) => (
                      <tr
                        key={row.dispatch_id}
                        onClick={() => openDrawer(row)}
                        className={cn(
                          "cursor-pointer transition-colors",
                          selectedIds.has(row.dispatch_id)
                            ? "bg-green-50 hover:bg-green-100/70"
                            : "hover:bg-sk-page-bg/60",
                        )}
                      >
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.dispatch_id)}
                            onChange={() => toggleSelect(row.dispatch_id)}
                            className="h-4 w-4 cursor-pointer rounded border-sk-border accent-sk-primary"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <span className="block truncate font-mono text-sm font-medium text-sk-text-1">
                            #{row.order_number}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {row.sales_order_number ? (
                            <span className="block truncate font-mono text-sm text-sk-text-2">{row.sales_order_number}</span>
                          ) : (
                            <span className="text-xs text-sk-text-3">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="block truncate text-sk-text-1">{row.customer_name}</span>
                          {row.customer_phone && (
                            <span className="block truncate text-xs text-sk-text-3">{row.customer_phone}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="block truncate text-sk-text-1">{row.courier_name}</span>
                        </td>
                        <td className="px-4 py-3">
                          {row.tracking_id ? (
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className="truncate font-mono text-xs text-sk-text-1">{row.tracking_id}</span>
                              {row.tracking_url && (
                                <a
                                  href={row.tracking_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 text-sk-primary hover:text-sk-primary-dk"
                                  title="Track on courier site"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-sk-text-3">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={row.shipment_status} />
                        </td>
                        <td className="px-4 py-3 text-sm text-sk-text-2">
                          {formatDate(row.dispatch_date)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {row.estimated_delivery ? (
                            <span className={row.is_delayed ? "font-medium text-red-600" : "text-sk-text-2"}>
                              {formatDate(row.estimated_delivery)}
                            </span>
                          ) : (
                            <span className="text-xs text-sk-text-3">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openDrawer(row)}
                            className="h-7 border-sk-border text-xs"
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y divide-sk-border md:hidden">
                {displayedShipments.map((row) => (
                  <div
                    key={row.dispatch_id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-4 transition-colors",
                      selectedIds.has(row.dispatch_id) ? "bg-green-50" : "hover:bg-sk-page-bg/60",
                    )}
                  >
                    {/* Checkbox */}
                    <div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.dispatch_id)}
                        onChange={() => toggleSelect(row.dispatch_id)}
                        className="h-4 w-4 cursor-pointer rounded border-sk-border accent-sk-primary"
                      />
                    </div>
                    {/* Card content — tapping opens drawer */}
                    <button
                      onClick={() => openDrawer(row)}
                      className="flex flex-1 flex-col gap-2 text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-sm font-semibold text-sk-text-1">#{row.order_number}</span>
                          {row.sales_order_number && (
                            <span className="ml-2 font-mono text-xs text-sk-text-3">{row.sales_order_number}</span>
                          )}
                          <span className="block text-sm text-sk-text-2">{row.customer_name}</span>
                        </div>
                        <StatusBadge status={row.shipment_status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-sk-text-3">
                        <span>{row.courier_name}</span>
                        {row.tracking_id && <span className="font-mono">{row.tracking_id}</span>}
                        <span>{formatDate(row.dispatch_date)}</span>
                        {row.estimated_delivery && (
                          <span className={row.is_delayed ? "font-medium text-red-600" : ""}>
                            ETA {formatDate(row.estimated_delivery)}
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Detail Drawer ── */}
      <ShipmentDetailDrawer
        shipment={selected}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onUpdated={() => void load()}
      />
    </div>
  )
}
