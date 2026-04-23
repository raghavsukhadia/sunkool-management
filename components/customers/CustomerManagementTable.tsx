"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
  AlertCircle, ArrowDown, ArrowUp, ArrowUpDown,
  Bookmark, ChevronDown, Columns3, Download, Filter, Plus, Search, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getCustomersWithStats } from "@/app/actions/customers"
import type { CustomerWithStats } from "@/app/actions/customers"
import { AdvancedFiltersPanel } from "@/components/customers/AdvancedFiltersPanel"
import { BulkActionsBar } from "@/components/customers/BulkActionsBar"
import { generateMockCustomers } from "@/components/customers/mockData"
import type {
  AdvancedFilters,
  ColumnKey,
  CustomerRow,
  CustomerStatusTag,
  SortKey,
  SortRule,
} from "@/components/customers/types"
import {
  applyFilters,
  applyMultiSort,
  buildCustomerRowsFromLive,
  COLUMN_LABELS,
  DEFAULT_ADVANCED_FILTERS,
  DEFAULT_PRIMARY_SORT,
  DEFAULT_SECONDARY_SORT,
  formatCurrency,
  formatDate,
  getActiveFilterTags,
} from "@/components/customers/utils"
import { CUSTOMER_STATUS_CLASS } from "@/components/customers/statusStyles"

interface Props {
  enableVirtualization?: boolean
  virtualizationThreshold?: number
}

type SegmentKey = "all" | "highValue" | "atRisk" | "inactive" | "new" | string

interface CustomSegment {
  id: string
  name: string
  status: "all" | CustomerStatusTag
  advanced: AdvancedFilters
}

const PRESETS_STORAGE_KEY = "customer-table-custom-presets"
const SEGMENTS_STORAGE_KEY = "customer-custom-segments"

const SEGMENT_LABELS: Record<string, string> = {
  all: "All Customers",
  highValue: "High Value",
  atRisk: "At Risk (Overdue)",
  inactive: "Inactive",
  new: "New Customers",
}

const COLUMN_ORDER: ColumnKey[] = [
  "name", "phone", "orderFrequency", "totalOrders",
  "totalValue", "unpaidAmount", "lastOrderDate", "status",
]

const DEFAULT_COLUMNS: Record<ColumnKey, boolean> = {
  name: true, phone: true, orderFrequency: true, totalOrders: true,
  totalValue: true, unpaidAmount: true, lastOrderDate: true, status: true,
}

type FrequencyLabel = "Weekly" | "Monthly" | "Rare" | "No Orders"

function getOrderFrequency(row: CustomerRow): { label: FrequencyLabel; sub: string; cls: string; dot: string } {
  if (row.totalOrders === 0) {
    return { label: "No Orders", sub: "0 orders", cls: "text-slate-500 bg-slate-100 border-slate-200", dot: "bg-slate-300" }
  }
  const ageWeeks = Math.max(1, (Date.now() - new Date(row.createdAt).getTime()) / (7 * 86400000))
  const perWeek = row.totalOrders / ageWeeks
  if (perWeek >= 0.8) {
    return { label: "Weekly", sub: `~${row.totalOrders} orders`, cls: "text-emerald-700 bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" }
  }
  if (perWeek >= 0.2) {
    return { label: "Monthly", sub: `~${row.totalOrders} orders`, cls: "text-blue-700 bg-blue-50 border-blue-200", dot: "bg-blue-400" }
  }
  return { label: "Rare", sub: `${row.totalOrders} total`, cls: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-400" }
}

function readCustomSegments(): CustomSegment[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(SEGMENTS_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CustomSegment[]) : []
  } catch { return [] }
}

function writeCustomSegments(items: CustomSegment[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(SEGMENTS_STORAGE_KEY, JSON.stringify(items))
}

function SortHeader({
  label, column, primary, onClick,
}: {
  label: string; column: SortKey; primary: SortRule; onClick: (column: SortKey) => void
}) {
  const active = primary.key === column
  const Icon = !active ? ArrowUpDown : primary.direction === "asc" ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={() => onClick(column)}
      className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-sk-text-3 hover:text-sk-text-1"
    >
      {label}
      <Icon className={`h-3 w-3 ${active ? "text-sk-primary" : ""}`} />
    </button>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-sk-border bg-sk-card-bg p-4">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="h-11 animate-pulse rounded-md bg-sk-page-bg" />
      ))}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-sk-border bg-sk-card-bg p-10 text-center">
      <p className="text-sm text-sk-text-2">{text}</p>
    </div>
  )
}

export function CustomerManagementTable({
  enableVirtualization = false,
  virtualizationThreshold = 200,
}: Props) {
  const router = useRouter()

  const [rows, setRows] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const [status, setStatus] = useState<"all" | CustomerStatusTag>("all")
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [advanced, setAdvanced] = useState<AdvancedFilters>(DEFAULT_ADVANCED_FILTERS)

  const [sortPrimary, setSortPrimary] = useState<SortRule>(DEFAULT_PRIMARY_SORT)
  const [sortSecondary, setSortSecondary] = useState<SortRule>(DEFAULT_SECONDARY_SORT)

  const [columns, setColumns] = useState<Record<ColumnKey, boolean>>(DEFAULT_COLUMNS)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [lastDeleted, setLastDeleted] = useState<CustomerRow[]>([])
  const [toastOpen, setToastOpen] = useState(false)
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null)

  const [activePresetId, setActivePresetId] = useState<string | null>(null)
  const [activeSegment, setActiveSegment] = useState<SegmentKey>("all")
  const [customSegments, setCustomSegments] = useState<CustomSegment[]>([])
  const [saveSegmentOpen, setSaveSegmentOpen] = useState(false)
  const [saveSegmentName, setSaveSegmentName] = useState("")

  useEffect(() => {
    setCustomSegments(readCustomSegments())
  }, [])

  // Close command search on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    let ignore = false
    async function load() {
      setLoading(true)
      setError(null)
      const result = await getCustomersWithStats()
      if (ignore) return
      if (result.success && result.data) {
        setRows(buildCustomerRowsFromLive(result.data as CustomerWithStats[]))
      } else {
        setRows(generateMockCustomers(220))
        setError("Live data unavailable. Showing mock data.")
      }
      setLoading(false)
    }
    load()
    return () => {
      ignore = true
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  // ── Derived data ────────────────────────────────────────────────────────────

  const insights = useMemo(() => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

    const overdueRows = rows.filter(r => r.unpaidAmount > 0)

    const sorted = [...rows].sort((a, b) => b.totalValue - a.totalValue)
    const top20Count = Math.max(1, Math.ceil(rows.length * 0.2))
    const hvThreshold = sorted[Math.min(top20Count - 1, sorted.length - 1)]?.totalValue ?? 0
    const highValueRows = rows.filter(r => r.totalValue >= hvThreshold && r.totalValue > 0)

    const inactiveRows = rows.filter(r => !r.lastOrderDate || r.lastOrderDate < thirtyDaysAgo)
    const recentRows = rows.filter(r => r.lastOrderDate && r.lastOrderDate >= sevenDaysAgo)

    return { overdue: overdueRows, highValue: highValueRows, hvThreshold, inactive: inactiveRows, recent: recentRows, thirtyDaysAgo, sevenDaysAgo }
  }, [rows])

  const filteredRows = useMemo(() => applyFilters(rows, search, status, advanced), [rows, search, status, advanced])
  const sortedRows = useMemo(() => applyMultiSort(filteredRows, sortPrimary, sortSecondary), [filteredRows, sortPrimary, sortSecondary])
  const selectedRows = useMemo(() => sortedRows.filter(r => selectedIds.has(r.id)), [sortedRows, selectedIds])
  const allVisibleSelected = sortedRows.length > 0 && sortedRows.every(r => selectedIds.has(r.id))
  const activeFilterTags = useMemo(() => getActiveFilterTags(search, status, advanced), [search, status, advanced])

  const commandResults = useMemo(() => {
    if (!search.trim() || search.length < 1) return []
    const term = search.toLowerCase()
    return rows.filter(r =>
      r.name.toLowerCase().includes(term) ||
      (r.phone ?? "").includes(term) ||
      (r.email ?? "").toLowerCase().includes(term)
    ).slice(0, 6)
  }, [rows, search])

  const showCommandDropdown = searchFocused && commandResults.length > 0

  // ── Actions ─────────────────────────────────────────────────────────────────

  const applyInsightFilter = (type: "overdue" | "highValue" | "inactive" | "recentlyActive") => {
    setSearch("")
    setStatus("all")
    setActiveSegment("all")
    setActivePresetId(null)
    if (type === "overdue") {
      setAdvanced({ ...DEFAULT_ADVANCED_FILTERS, unpaidMode: "has" })
    } else if (type === "highValue") {
      setAdvanced({ ...DEFAULT_ADVANCED_FILTERS, minValue: String(Math.floor(insights.hvThreshold)) })
    } else if (type === "inactive") {
      setAdvanced({ ...DEFAULT_ADVANCED_FILTERS, lastOrderTo: insights.thirtyDaysAgo })
    } else {
      setAdvanced({ ...DEFAULT_ADVANCED_FILTERS, lastOrderFrom: insights.sevenDaysAgo })
    }
  }

  const applySegment = (key: SegmentKey) => {
    setSearch("")
    setActivePresetId(null)
    setActiveSegment(key)
    if (key === "all") {
      setStatus("all")
      setAdvanced(DEFAULT_ADVANCED_FILTERS)
    } else if (key === "highValue") {
      setStatus("all")
      setAdvanced({ ...DEFAULT_ADVANCED_FILTERS, minValue: String(Math.floor(insights.hvThreshold)) })
    } else if (key === "atRisk") {
      setStatus("all")
      setAdvanced({ ...DEFAULT_ADVANCED_FILTERS, unpaidMode: "has" })
    } else if (key === "inactive") {
      setStatus("all")
      setAdvanced({ ...DEFAULT_ADVANCED_FILTERS, lastOrderTo: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) })
    } else if (key === "new") {
      setStatus("New Customer")
      setAdvanced(DEFAULT_ADVANCED_FILTERS)
    } else {
      const custom = customSegments.find(s => s.id === key)
      if (custom) { setStatus(custom.status); setAdvanced(custom.advanced) }
    }
  }

  const deleteCustomSegment = (id: string) => {
    const updated = customSegments.filter(s => s.id !== id)
    setCustomSegments(updated)
    writeCustomSegments(updated)
    if (activeSegment === id) {
      setActiveSegment("all")
      setStatus("all")
      setAdvanced(DEFAULT_ADVANCED_FILTERS)
    }
  }

  const handleSaveSegment = () => {
    if (!saveSegmentName.trim()) return
    const seg: CustomSegment = { id: `custom-${Date.now()}`, name: saveSegmentName.trim(), status, advanced }
    const updated = [...customSegments, seg]
    setCustomSegments(updated)
    writeCustomSegments(updated)
    setSaveSegmentOpen(false)
    setSaveSegmentName("")
    setActiveSegment(seg.id)
  }

  const handleHeaderSort = (column: SortKey) => {
    setSortPrimary(prev => {
      if (prev.key === column) return { ...prev, direction: prev.direction === "asc" ? "desc" : "asc" }
      setSortSecondary(ps => (ps.key === column ? DEFAULT_SECONDARY_SORT : prev))
      return { key: column, direction: "desc" }
    })
  }

  const toggleSelectAll = () => {
    const next = new Set(selectedIds)
    if (allVisibleSelected) { sortedRows.forEach(r => next.delete(r.id)) }
    else { sortedRows.forEach(r => next.add(r.id)) }
    setSelectedIds(next)
  }

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedIds(next)
  }

  const removeFilterTag = (tag: string) => {
    if (tag.startsWith("Search:")) setSearch("")
    if (tag.startsWith("Status:")) setStatus("all")
    if (tag.startsWith("Last order from:")) setAdvanced(p => ({ ...p, lastOrderFrom: "" }))
    if (tag.startsWith("Last order to:")) setAdvanced(p => ({ ...p, lastOrderTo: "" }))
    if (tag === "Has unpaid" || tag === "No unpaid") setAdvanced(p => ({ ...p, unpaidMode: "all" }))
    if (tag.startsWith("Min orders:")) setAdvanced(p => ({ ...p, minOrders: "" }))
    if (tag.startsWith("Min value:")) setAdvanced(p => ({ ...p, minValue: "" }))
    if (tag.startsWith("Max value:")) setAdvanced(p => ({ ...p, maxValue: "" }))
    if (tag.startsWith("Phone prefix:")) setAdvanced(p => ({ ...p, phonePrefix: "" }))
    if (tag === "Has email" || tag === "No email") setAdvanced(p => ({ ...p, hasEmail: "all" }))
    setActivePresetId(null)
    setActiveSegment("all")
  }

  const handleExportExcel = async (rowsToExport: CustomerRow[]) => {
    if (rowsToExport.length === 0) return

    const XLSX = await import("xlsx-js-style")

    const C = {
      brandDark:  "1E3A5F",
      brandLight: "E8F0F8",
      white:      "FFFFFF",
      lightGray:  "F4F6F9",
      borderCol:  "C5D3E0",
      textDark:   "0D1B2A",
      textMuted:  "4A6080",
      secInfo:    "1E5799",
      secContact: "276749",
      secNotes:   "7B3F00",
      secStats:   "6B2D8B",
      secStatus:  "8B3A1E",
      green:      "166534",
      red:        "991B1B",
    }

    const COLS = [
      { label: "SR #",            width: 6,  group: "info"    },
      { label: "Customer Name",   width: 28, group: "info"    },
      { label: "Customer Since",  width: 16, group: "info"    },
      { label: "Phone",           width: 15, group: "contact" },
      { label: "Email",           width: 32, group: "contact" },
      { label: "Address",         width: 36, group: "contact" },
      { label: "Contact Person",  width: 20, group: "contact" },
      { label: "Notes",           width: 40, group: "notes"   },
      { label: "Total Orders",    width: 14, group: "stats"   },
      { label: "Total Value (₹)", width: 20, group: "stats"   },
      { label: "Unpaid (₹)",      width: 18, group: "stats"   },
      { label: "Last Order Date", width: 18, group: "stats"   },
      { label: "Status",          width: 18, group: "status"  },
    ]
    const numCols = COLS.length

    const colLetter = (i: number): string => {
      if (i < 26) return String.fromCharCode(65 + i)
      return String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26))
    }

    const groupColor: Record<string, string> = {
      info:    C.secInfo,
      contact: C.secContact,
      notes:   C.secNotes,
      stats:   C.secStats,
      status:  C.secStatus,
    }
    const groupLabel: Record<string, string> = {
      info:    "CUSTOMER INFORMATION",
      contact: "CONTACT & LOCATION",
      notes:   "NOTES",
      stats:   "BUSINESS STATISTICS",
      status:  "STATUS",
    }

    const border = {
      top:    { style: "thin", color: { rgb: C.borderCol } },
      bottom: { style: "thin", color: { rgb: C.borderCol } },
      left:   { style: "thin", color: { rgb: C.borderCol } },
      right:  { style: "thin", color: { rgb: C.borderCol } },
    }

    const ws: Record<string, unknown> = {}

    ws["A1"] = {
      v: "SUNKOOL MANAGEMENT  —  Customer Export",
      t: "s",
      s: {
        font: { bold: true, sz: 16, color: { rgb: C.white }, name: "Calibri" },
        fill: { patternType: "solid", fgColor: { rgb: C.brandDark } },
        alignment: { horizontal: "center", vertical: "center" },
      },
    }

    const totalValue  = rowsToExport.reduce((s, r) => s + r.totalValue,   0)
    const totalUnpaid = rowsToExport.reduce((s, r) => s + r.unpaidAmount, 0)
    const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
    ws["A2"] = {
      v: [
        `Generated: ${new Date().toLocaleString("en-IN")}`,
        `Customers: ${rowsToExport.length}`,
        `Total Lifetime Value: ${fmt(totalValue)}`,
        `Total Unpaid: ${fmt(totalUnpaid)}`,
      ].join("     |     "),
      t: "s",
      s: {
        font: { sz: 10, color: { rgb: C.textMuted }, name: "Calibri" },
        fill: { patternType: "solid", fgColor: { rgb: C.lightGray } },
        alignment: { horizontal: "center", vertical: "center" },
      },
    }

    const groupFirstCol: Record<string, number> = {}
    const groupLastCol:  Record<string, number> = {}
    COLS.forEach((col, i) => {
      if (groupFirstCol[col.group] === undefined) groupFirstCol[col.group] = i
      groupLastCol[col.group] = i
    })
    COLS.forEach((col, i) => {
      const isFirst = groupFirstCol[col.group] === i
      ws[`${colLetter(i)}3`] = {
        v: isFirst ? groupLabel[col.group] : "",
        t: "s",
        s: {
          font: { bold: true, sz: 9, color: { rgb: C.white }, name: "Calibri" },
          fill: { patternType: "solid", fgColor: { rgb: groupColor[col.group] } },
          alignment: { horizontal: "center", vertical: "center" },
          border,
        },
      }
    })

    COLS.forEach((col, i) => {
      ws[`${colLetter(i)}4`] = {
        v: col.label,
        t: "s",
        s: {
          font: { bold: true, sz: 10, color: { rgb: C.white }, name: "Calibri" },
          fill: { patternType: "solid", fgColor: { rgb: groupColor[col.group] } },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border,
        },
      }
    })

    rowsToExport.forEach((row, idx) => {
      const r = idx + 5
      const isAlt = idx % 2 === 1
      const fillBg = isAlt ? C.brandLight : C.white
      const base = {
        font:      { sz: 10, name: "Calibri", color: { rgb: C.textDark } },
        fill:      { patternType: "solid", fgColor: { rgb: fillBg } },
        alignment: { vertical: "center", wrapText: true },
        border,
      }
      const sCenter = { ...base, alignment: { ...base.alignment, horizontal: "center" } }
      const sBold   = { ...base, font: { ...base.font, bold: true } }
      const sRight  = { ...base, alignment: { ...base.alignment, horizontal: "right" } }
      const sGreen  = { ...base, font: { ...base.font, bold: true, color: { rgb: C.green } }, alignment: { ...base.alignment, horizontal: "right" } }
      const sRed    = { ...base, font: { ...base.font, bold: true, color: { rgb: C.red   } }, alignment: { ...base.alignment, horizontal: "right" } }

      const cells: Array<Record<string, unknown>> = [
        { v: idx + 1,                                                  t: "n", s: sCenter },
        { v: row.name,                                                 t: "s", s: sBold   },
        { v: formatDate(row.createdAt),                                t: "s", s: sCenter },
        { v: row.phone         ?? "—",                                 t: "s", s: base    },
        { v: row.email         ?? "—",                                 t: "s", s: base    },
        { v: row.address       ?? "—",                                 t: "s", s: base    },
        { v: row.contactPerson ?? "—",                                 t: "s", s: base    },
        { v: row.notes         ?? "—",                                 t: "s", s: base    },
        { v: row.totalOrders,                                          t: "n", s: sCenter },
        { v: row.totalValue,   t: "n", z: '"₹"#,##0.00',              s: sGreen          },
        row.unpaidAmount > 0
          ? { v: row.unpaidAmount, t: "n", z: '"₹"#,##0.00',          s: sRed            }
          : { v: "—",              t: "s",                             s: sRight          },
        { v: formatDate(row.lastOrderDate),                            t: "s", s: sCenter },
        { v: row.status,                                               t: "s", s: sCenter },
      ]
      cells.forEach((cell, ci) => {
        ws[`${colLetter(ci)}${r}`] = cell
      })
    })

    const footerRow = rowsToExport.length + 5
    const footerBase = {
      font:      { bold: true, sz: 10, name: "Calibri", color: { rgb: C.white } },
      fill:      { patternType: "solid", fgColor: { rgb: C.brandDark } },
      alignment: { vertical: "center", horizontal: "center" },
      border,
    }
    const footerAmt   = { ...footerBase, alignment: { ...footerBase.alignment, horizontal: "right" } }
    const footerGreen = { ...footerAmt,  font: { ...footerAmt.font, color: { rgb: "A7F3D0" } } }
    const footerRed   = { ...footerAmt,  font: { ...footerAmt.font, color: { rgb: "FCA5A5" } } }
    COLS.forEach((_, i) => {
      const col = colLetter(i)
      if      (i === 0)  ws[`${col}${footerRow}`] = { v: "TOTALS",                                                      t: "s", s: footerBase }
      else if (i === 8)  ws[`${col}${footerRow}`] = { v: rowsToExport.reduce((s, r) => s + r.totalOrders, 0),           t: "n", s: footerAmt   }
      else if (i === 9)  ws[`${col}${footerRow}`] = { v: totalValue,  t: "n", z: '"₹"#,##0.00',                                s: footerGreen }
      else if (i === 10) ws[`${col}${footerRow}`] = { v: totalUnpaid, t: "n", z: '"₹"#,##0.00',                                s: footerRed   }
      else               ws[`${col}${footerRow}`] = { v: "",                                                             t: "s", s: footerBase }
    })

    const lastRow = footerRow
    const lastCol = colLetter(numCols - 1)
    ws["!ref"]        = `A1:${lastCol}${lastRow}`
    ws["!merges"]     = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } },
      ...Object.keys(groupFirstCol).map(g => ({
        s: { r: 2, c: groupFirstCol[g] },
        e: { r: 2, c: groupLastCol[g]  },
      })),
      { s: { r: footerRow - 1, c: 0 }, e: { r: footerRow - 1, c: 7 } },
    ]
    ws["!cols"]       = COLS.map(c => ({ wch: c.width }))
    ws["!rows"]       = [{ hpt: 40 }, { hpt: 22 }, { hpt: 20 }, { hpt: 36 }]
    ws["!freeze"]     = { xSplit: 2, ySplit: 4 }
    ws["!autofilter"] = { ref: `A4:${lastCol}4` }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Customers")
    XLSX.writeFile(wb, `sunkool-customers-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const handleAddTag = () => {
    const tag = window.prompt("Add tag to selected customers:")
    if (!tag?.trim()) return
    const cleanTag = tag.trim()
    setRows(prev => prev.map(r => {
      if (!selectedIds.has(r.id) || r.extraTags.includes(cleanTag)) return r
      return { ...r, extraTags: [...r.extraTags, cleanTag] }
    }))
  }

  const handleDeleteSelected = () => {
    const toDelete = rows.filter(r => selectedIds.has(r.id))
    if (!toDelete.length) return
    setLastDeleted(toDelete)
    setRows(prev => prev.filter(r => !selectedIds.has(r.id)))
    setSelectedIds(new Set())
    setConfirmDeleteOpen(false)
    setToastOpen(true)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => { setToastOpen(false); setLastDeleted([]) }, 7000)
  }

  const undoDelete = () => {
    if (!lastDeleted.length) return
    setRows(prev => [...lastDeleted, ...prev])
    setLastDeleted([])
    setToastOpen(false)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  }

  // ── Virtualizer ─────────────────────────────────────────────────────────────
  const parentRef = useRef<HTMLDivElement | null>(null)
  const shouldVirtualize = enableVirtualization && sortedRows.length >= virtualizationThreshold
  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? sortedRows.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 54,
    overscan: 8,
  })
  const virtualItems = shouldVirtualize ? rowVirtualizer.getVirtualItems() : []

  // ── Active segment label ─────────────────────────────────────────────────────
  const activeSegmentLabel = SEGMENT_LABELS[activeSegment] ?? customSegments.find(s => s.id === activeSegment)?.name ?? "All Customers"

  // ── Row renderer (shared) ────────────────────────────────────────────────────
  const renderRow = (row: CustomerRow) => {
    const initials = row.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
    return (
      <tr
        key={row.id}
        className="cursor-pointer transition-colors hover:bg-sk-primary-tint"
        onClick={() => router.push(`/dashboard/customers/${row.id}`)}
      >
        <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelectOne(row.id)} aria-label={`Select ${row.name}`} />
        </td>
        {columns.name && (
          <td className="px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sk-primary-tint text-[11px] font-bold text-sk-primary-dk">
                {initials}
              </div>
              <div>
                <p className="font-medium text-sk-text-1">{row.name}</p>
                {row.extraTags.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {row.extraTags.map(tag => (
                      <span key={tag} className="rounded-full border border-sk-primary/20 bg-sk-primary-tint px-2 py-0.5 text-[10px] font-medium text-sk-primary-dk">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </td>
        )}
        {columns.phone && <td className="px-4 py-3 text-sk-text-2">{row.phone ?? "-"}</td>}
        {columns.orderFrequency && (() => {
          const freq = getOrderFrequency(row)
          return (
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${freq.cls}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${freq.dot}`} />
                  {freq.label}
                </span>
                <span className="text-[11px] text-sk-text-3">{freq.sub}</span>
              </div>
            </td>
          )
        })()}
        {columns.totalOrders && <td className="px-4 py-3 text-sk-text-2">{row.totalOrders}</td>}
        {columns.totalValue && <td className="px-4 py-3 font-medium text-sk-text-1">{formatCurrency(row.totalValue)}</td>}
        {columns.unpaidAmount && (
          <td className="px-4 py-3">
            <span className={row.unpaidAmount > 0 ? "font-semibold text-red-600" : "text-sk-text-3"}>
              {row.unpaidAmount > 0 ? formatCurrency(row.unpaidAmount) : "—"}
            </span>
          </td>
        )}
        {columns.lastOrderDate && <td className="px-4 py-3 text-sk-text-2">{formatDate(row.lastOrderDate)}</td>}
        {columns.status && (
          <td className="px-4 py-3">
            <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${CUSTOMER_STATUS_CLASS[row.status]}`}>
              {row.status}
            </span>
          </td>
        )}
      </tr>
    )
  }

  // ── JSX ──────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 lg:p-6">
      <div className="space-y-4">

      {/* ── Action Insights ── */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-sk-text-1">Action Insights</h2>
          <span className="text-xs text-sk-text-3">— click any card to filter</span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

          {/* Overdue */}
          <button
            type="button"
            onClick={() => applyInsightFilter("overdue")}
            className="group rounded-xl border border-red-200 bg-red-50 p-4 text-left transition-all hover:border-red-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <div className="flex items-start justify-between gap-1">
              <span className="text-xl leading-none">⚠️</span>
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">Urgent</span>
            </div>
            <p className="mt-2.5 text-2xl font-bold text-red-700">{insights.overdue.length}</p>
            <p className="text-[11px] font-semibold text-red-600">Overdue Payments</p>
            <p className="mt-2 text-[10px] font-semibold text-red-500 group-hover:underline">Collect now →</p>
          </button>

          {/* High Value */}
          <button
            type="button"
            onClick={() => applyInsightFilter("highValue")}
            className="group rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left transition-all hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <div className="flex items-start justify-between gap-1">
              <span className="text-xl leading-none">💰</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Top 20%</span>
            </div>
            <p className="mt-2.5 text-2xl font-bold text-emerald-700">{insights.highValue.length}</p>
            <p className="text-[11px] font-semibold text-emerald-600">High Value Customers</p>
            <p className="mt-2 text-[10px] font-semibold text-emerald-500 group-hover:underline">View →</p>
          </button>

          {/* Inactive */}
          <button
            type="button"
            onClick={() => applyInsightFilter("inactive")}
            className="group rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition-all hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <div className="flex items-start justify-between gap-1">
              <span className="text-xl leading-none">💤</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">30 days</span>
            </div>
            <p className="mt-2.5 text-2xl font-bold text-slate-700">{insights.inactive.length}</p>
            <p className="text-[11px] font-semibold text-slate-600">Inactive Customers</p>
            <p className="mt-2 text-[10px] font-semibold text-slate-500 group-hover:underline">No orders in 30 days →</p>
          </button>

          {/* Recently Active */}
          <button
            type="button"
            onClick={() => applyInsightFilter("recentlyActive")}
            className="group rounded-xl border border-orange-200 bg-orange-50 p-4 text-left transition-all hover:border-orange-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            <div className="flex items-start justify-between gap-1">
              <span className="text-xl leading-none">🔥</span>
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">This week</span>
            </div>
            <p className="mt-2.5 text-2xl font-bold text-orange-700">{insights.recent.length}</p>
            <p className="text-[11px] font-semibold text-orange-600">Recently Active</p>
            <p className="mt-2 text-[10px] font-semibold text-orange-500 group-hover:underline">Follow up opportunity →</p>
          </button>

        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="space-y-3 rounded-xl border border-sk-border bg-sk-card-bg p-3 shadow-sm">

        {/* Row 1: Command Search + controls + CTA */}
        <div className="flex flex-wrap items-center gap-2">

          {/* Command Search */}
          <div ref={searchContainerRef} className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sk-text-3" />
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setActivePresetId(null); setActiveSegment("all") }}
              onFocus={() => setSearchFocused(true)}
              placeholder="Search name, phone, email..."
              className="pl-9 pr-4"
            />

            {/* Command dropdown */}
            {showCommandDropdown && (
              <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[340px] overflow-hidden rounded-xl border border-sk-border bg-sk-card-bg shadow-xl">
                {commandResults.map(r => {
                  const initials = r.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
                  return (
                    <div key={r.id} className="flex items-center gap-3 border-b border-sk-border px-3 py-2.5 last:border-0 hover:bg-sk-primary-tint">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sk-primary-tint text-[11px] font-bold text-sk-primary-dk">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-sk-text-1">{r.name}</p>
                        <p className="truncate text-xs text-sk-text-3">{r.phone ?? r.email ?? "—"}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onMouseDown={e => { e.preventDefault(); router.push(`/dashboard/customers/${r.id}`) }}
                          className="rounded-md bg-sk-primary px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-sk-primary-dk"
                        >
                          View
                        </button>
                        {r.phone && (
                          <a
                            href={`tel:${r.phone}`}
                            onMouseDown={e => e.preventDefault()}
                            className="rounded-md border border-sk-border px-2.5 py-1 text-[10px] font-semibold text-sk-text-2 hover:bg-sk-page-bg"
                          >
                            Call
                          </a>
                        )}
                        <button
                          type="button"
                          onMouseDown={e => { e.preventDefault(); router.push(`/dashboard/orders/new?customerId=${r.id}`) }}
                          className="rounded-md border border-sk-border px-2.5 py-1 text-[10px] font-semibold text-sk-text-2 hover:bg-sk-page-bg"
                        >
                          Order
                        </button>
                      </div>
                    </div>
                  )
                })}
                <div className="bg-sk-page-bg px-3 py-1.5 text-center text-[10px] text-sk-text-3">
                  {commandResults.length} quick results · press Enter to search all
                </div>
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setAdvancedOpen(v => !v)}
            className={advancedOpen ? "border-sk-primary/40 bg-sk-primary-tint text-sk-primary" : ""}
          >
            <Filter className="mr-1.5 h-4 w-4" />
            Advanced
            <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline">
                <Columns3 className="mr-1.5 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUMN_ORDER.map(col => (
                <DropdownMenuCheckboxItem
                  key={col}
                  checked={columns[col]}
                  onCheckedChange={checked => setColumns(prev => ({ ...prev, [col]: Boolean(checked) }))}
                >
                  {COLUMN_LABELS[col]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            variant="outline"
            onClick={() => handleExportExcel(selectedIds.size > 0 ? selectedRows : sortedRows)}
            disabled={sortedRows.length === 0}
            title={selectedIds.size > 0 ? `Export ${selectedIds.size} selected` : `Export all ${sortedRows.length} visible`}
          >
            <Download className="mr-1.5 h-4 w-4" />
            {selectedIds.size > 0 ? `Export (${selectedIds.size})` : "Export Excel"}
          </Button>

          {/* Primary CTA — prominent */}
          <Button
            type="button"
            onClick={() => router.push("/dashboard/management/customers")}
            className="ml-auto bg-sk-primary px-5 text-white shadow-sm hover:bg-sk-primary-dk"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Customer
          </Button>
        </div>

        {/* Row 2: Smart Segments */}
        <div className="flex flex-wrap items-center gap-2 border-t border-sk-border pt-3">
          <span className="text-xs font-medium text-sk-text-3">Segment:</span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="min-w-[170px] justify-between text-sm">
                {activeSegmentLabel}
                <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel className="text-xs text-sk-text-3">Built-in</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(["all", "highValue", "atRisk", "inactive", "new"] as SegmentKey[]).map(key => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => applySegment(key)}
                  className={activeSegment === key ? "bg-sk-primary-tint font-medium text-sk-primary-dk" : ""}
                >
                  {SEGMENT_LABELS[key]}
                </DropdownMenuItem>
              ))}
              {customSegments.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-sk-text-3">Custom</DropdownMenuLabel>
                  {customSegments.map(s => (
                    <DropdownMenuItem
                      key={s.id}
                      onSelect={() => applySegment(s.id)}
                      className={`pr-1 ${activeSegment === s.id ? "bg-sk-primary-tint font-medium text-sk-primary-dk" : ""}`}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="flex-1 truncate">{s.name}</span>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); deleteCustomSegment(s.id) }}
                          className="shrink-0 rounded p-0.5 text-sk-text-3 hover:bg-red-50 hover:text-red-500"
                          title="Remove segment"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSaveSegmentOpen(true)}
            className="text-xs text-sk-text-2 hover:text-sk-primary"
          >
            <Bookmark className="mr-1 h-3.5 w-3.5" />
            Save Segment
          </Button>
        </div>

        {/* Row 3: Active filter tags */}
        {activeFilterTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-sk-border pt-2">
            {activeFilterTags.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => removeFilterTag(tag)}
                className="inline-flex items-center gap-1 rounded-full border border-sk-border bg-sk-page-bg px-2 py-0.5 text-xs text-sk-text-2 hover:bg-sk-primary-tint hover:text-sk-primary-dk"
              >
                {tag}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Advanced filters */}
      {advancedOpen && (
        <AdvancedFiltersPanel
          value={advanced}
          onChange={next => { setAdvanced(next); setActivePresetId(null); setActiveSegment("all") }}
          onReset={() => { setAdvanced(DEFAULT_ADVANCED_FILTERS); setActivePresetId(null) }}
        />
      )}

      <BulkActionsBar
        selectedCount={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        onExport={() => handleExportExcel(selectedRows)}
        onAddTag={handleAddTag}
        onDelete={() => setConfirmDeleteOpen(true)}
      />

      </div>{/* end space-y-4 */}

      {/* Table */}
      <div>
      {loading ? (
        <LoadingSkeleton />
      ) : sortedRows.length === 0 ? (
        <EmptyState text={rows.length === 0 ? "No customer data available." : "No customers match your filters."} />
      ) : (
        <div className="rounded-xl border border-sk-border bg-sk-card-bg">
          <div className="overflow-visible" ref={parentRef} style={{ maxHeight: shouldVirtualize ? 620 : undefined }}>
            <table className="w-full text-sm">
              <thead className="z-20 bg-sk-card-bg [&_th]:sticky [&_th]:top-16 [&_th]:z-20 [&_th]:bg-sk-card-bg">
                <tr className="border-b border-sk-border">
                  <th className="w-10 px-3 py-3 text-left">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} aria-label="Select all" />
                  </th>
                  {columns.name && <th className="px-4 py-3 text-left"><SortHeader label="Name" column="name" primary={sortPrimary} onClick={handleHeaderSort} /></th>}
                  {columns.phone && <th className="px-4 py-3 text-left"><SortHeader label="Phone" column="phone" primary={sortPrimary} onClick={handleHeaderSort} /></th>}
                  {columns.orderFrequency && (
                    <th className="px-4 py-3 text-left">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">🔁 Order Frequency</span>
                        <span className="text-[10px] font-normal normal-case tracking-normal text-sk-text-3">Weekly · Monthly · Rare</span>
                      </div>
                    </th>
                  )}
                  {columns.totalOrders && <th className="px-4 py-3 text-left"><SortHeader label="Orders" column="totalOrders" primary={sortPrimary} onClick={handleHeaderSort} /></th>}
                  {columns.totalValue && <th className="px-4 py-3 text-left"><SortHeader label="Total Value" column="totalValue" primary={sortPrimary} onClick={handleHeaderSort} /></th>}
                  {columns.unpaidAmount && <th className="px-4 py-3 text-left"><SortHeader label="Unpaid" column="unpaidAmount" primary={sortPrimary} onClick={handleHeaderSort} /></th>}
                  {columns.lastOrderDate && <th className="px-4 py-3 text-left"><SortHeader label="Last Order" column="lastOrderDate" primary={sortPrimary} onClick={handleHeaderSort} /></th>}
                  {columns.status && <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">Status</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-sk-border">
                {shouldVirtualize ? (
                  <>
                    {virtualItems.length > 0 && virtualItems[0].start > 0 && (
                      <tr><td colSpan={9} style={{ height: virtualItems[0].start }} /></tr>
                    )}
                    {virtualItems.map(vi => renderRow(sortedRows[vi.index]))}
                    {virtualItems.length > 0 && virtualItems[virtualItems.length - 1].end < rowVirtualizer.getTotalSize() && (
                      <tr><td colSpan={9} style={{ height: rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end }} /></tr>
                    )}
                  </>
                ) : (
                  sortedRows.map(row => renderRow(row))
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-sk-border px-4 py-2 text-xs text-sk-text-3">
            Showing {sortedRows.length} of {rows.length} customers
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      </div>{/* end mt-2 table wrapper */}

      {/* Delete confirm dialog */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete selected customers?</DialogTitle>
            <DialogDescription>This removes selected rows from the table. You can undo for a short time.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button>
            <Button className="bg-red-600 text-white hover:bg-red-700" onClick={handleDeleteSelected}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save segment dialog */}
      <Dialog open={saveSegmentOpen} onOpenChange={setSaveSegmentOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save Custom Segment</DialogTitle>
            <DialogDescription>Save the current filters as a reusable segment.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={saveSegmentName}
              onChange={e => setSaveSegmentName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSaveSegment() }}
              placeholder="Segment name..."
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveSegmentOpen(false)}>Cancel</Button>
            <Button
              className="bg-sk-primary text-white hover:bg-sk-primary-dk"
              onClick={handleSaveSegment}
              disabled={!saveSegmentName.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Undo toast */}
      {toastOpen && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-sk-border bg-sk-card-bg px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            <p className="text-sm text-sk-text-2">Deleted {lastDeleted.length} customer(s)</p>
            <Button size="sm" variant="outline" onClick={undoDelete}>Undo</Button>
          </div>
        </div>
      )}
    </div>
  )
}
