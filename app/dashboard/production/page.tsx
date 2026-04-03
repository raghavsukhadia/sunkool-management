"use client"

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
// xlsx-js-style loaded dynamically in handleExportExcel for code-splitting
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Package, Clock, CheckCircle, ExternalLink, Printer, Activity, Search, Maximize2, Minimize2, ChevronRight, ChevronDown, ChevronUp, ArrowUpDown, Check, X, FileDown } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  getProductionQueue,
  getProductionRecordsList,
  type ProductionKpiData,
  type ProductionQueueRow,
  type ProductionQueueResult,
} from "@/app/actions/production"
import {
  getStockPrediction,
  getFastSlowMoving,
  getDeadStock,
  type StockPredictionRow,
  type FastSlowRow,
  type DeadStockRow,
} from "@/app/actions/inventory-health"
import { OrderJourneySheet } from "@/components/production/OrderJourneySheet"

/** Remaining (until DONE) — uses `remainingUntilDone` from the server. */
function getRemainingUntilDone(row: ProductionQueueRow): number {
  return row.remainingUntilDone ?? row.remaining
}

/** Produced for display = Ordered − Remaining (until DONE); matches completed batches only. */
function getProducedForDisplay(row: ProductionQueueRow): number {
  if (row.producedCompleted != null) return row.producedCompleted
  return Math.max(0, row.ordered - getRemainingUntilDone(row))
}

/** RP (Requested Production) = quantity allocated in active in-production checklists, not yet completed. */
function getRequestedProduction(row: ProductionQueueRow): number {
  return Math.max(0, row.produced - getProducedForDisplay(row))
}

/**
 * Rows that appear when Production Queue has
 * “Show lines awaiting batch closure (0 remaining until DONE on order)” enabled:
 * full allocation on an open batch; DONE on the order still pending.
 */
function isAwaitingBatchClosureRow(
  row: ProductionQueueRow,
  noProductionOrderIds: Set<string>
): boolean {
  if (noProductionOrderIds.has(row.orderId)) return false
  return !!row.needsBatchClosure
}

/** Remaining qty pill: orange/amber for normal backlog; red only for very large remaining. */
function getRemainingBadgeClass(row: ProductionQueueRow): string {
  const n = getRemainingUntilDone(row)
  if (n === 0) return "bg-slate-100 text-slate-700 border border-slate-200"
  if (n <= 10) return "bg-amber-100 text-amber-800"
  if (n > 200) return "bg-red-100 text-red-700"
  return "bg-orange-100 text-orange-800"
}

function RemainingQuantityDisplay({
  row,
  size = "md",
}: {
  row: ProductionQueueRow
  size?: "sm" | "md"
}) {
  const pill = size === "sm" ? "text-[11px]" : "text-[11px]"
  const n = getRemainingUntilDone(row)

  return (
    <span
      className={cn(
        "inline-flex min-w-[2rem] items-center justify-center rounded-full px-2.5 py-0.5 font-semibold tabular-nums",
        pill,
        getRemainingBadgeClass(row)
      )}
      title="Units left until production is marked DONE on completed batches: ordered minus produced on completed batches only (in-progress allocation does not reduce this)."
    >
      {n}
    </span>
  )
}

function formatActiveBatches(row: ProductionQueueRow): string {
  const labels = row.activeBatchLabels ?? []
  return labels.length ? labels.join(", ") : "—"
}

/** Order column: always show the base order number. Batch labels live in the "Active batch" column. */
function getQueueOrderDisplayLabel(row: ProductionQueueRow): string {
  return row.orderNumber
}

function getQueueOrderNumberClass(row: ProductionQueueRow): string {
  if (getRemainingUntilDone(row) === 0 && !row.needsBatchClosure) {
    return "text-slate-600 hover:text-slate-800"
  }
  return "text-orange-500 hover:text-orange-600"
}

interface ProductionRecord {
  id: string
  production_number: string
  production_type: string
  status: string
  created_at: string
  dispatches: {
    order_id: string
    orders: {
      internal_order_number: string
    }
  }[]
}

type QueueStatusFilter = "All" | "Pending" | "In Progress" | "Completed"
type QueueSortKey = "orderNumber" | "customerName" | "itemName" | "ordered" | "produced" | "remaining"
type QueueSortDirection = "asc" | "desc"
type KpiFilter = "none" | "pending" | "units" | "delayed" | "completedMonth" | "noProduction"

export default function ProductionPage() {
  const [productionRecords, setProductionRecords] = useState<ProductionRecord[]>([])
  const [queueData, setQueueData] = useState<ProductionQueueResult | null>(null)
  const [kpiData, setKpiData] = useState<ProductionKpiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<"pending" | "needed" | "inventory-health">("pending")
  const [inventoryHealthView, setInventoryHealthView] = useState<"stock-prediction" | "fast-slow" | "dead-stock">("stock-prediction")
  const [inventoryHealthDays, setInventoryHealthDays] = useState<7 | 30 | 90>(30)
  const [inventoryHealthSearch, setInventoryHealthSearch] = useState("")
  const [inventoryHealthFilter, setInventoryHealthFilter] = useState<"all" | "needs-action" | "low" | "dead" | "excess" | "fast">("all")
  const [stockPredictionData, setStockPredictionData] = useState<StockPredictionRow[]>([])
  const [fastSlowData, setFastSlowData] = useState<FastSlowRow[]>([])
  const [deadStockData, setDeadStockData] = useState<DeadStockRow[]>([])
  const [inventoryHealthLoading, setInventoryHealthLoading] = useState(false)
  const [isNeededFullscreen, setIsNeededFullscreen] = useState(false)
  const [neededLastUpdated, setNeededLastUpdated] = useState<Date | null>(null)
  const [queueSearch, setQueueSearch] = useState("")
  const [queueStatusFilter, setQueueStatusFilter] = useState<QueueStatusFilter>("All")
  const [queueCustomerFilter, setQueueCustomerFilter] = useState("")
  const [queueItemFilter, setQueueItemFilter] = useState("")
  const [queueCustomerSearch, setQueueCustomerSearch] = useState("")
  const [queueItemSearch, setQueueItemSearch] = useState("")
  const [queueSortKey, setQueueSortKey] = useState<QueueSortKey>("orderNumber")
  const [queueSortDirection, setQueueSortDirection] = useState<QueueSortDirection>("asc")
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>("none")
  const [useDefaultOpenOnlyFilter, setUseDefaultOpenOnlyFilter] = useState(true)
  /** When false (default), hide line items with 0 remaining (fully allocated on an open batch until DONE on the order). */
  const [showLinesAwaitingClosure, setShowLinesAwaitingClosure] = useState(true)
  const [selectedRow, setSelectedRow] = useState<ProductionQueueRow | null>(null)
  const [journeyOpen, setJourneyOpen] = useState(false)
  const neededFullscreenRef = useRef<HTMLDivElement>(null)
  const [checkedItemIds, setCheckedItemIds] = useState<Set<string>>(new Set())

  const loadProductionData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const [queueRes, recordsRes] = await Promise.all([getProductionQueue(), getProductionRecordsList()])
      if (queueRes.success) {
        setQueueData(queueRes.data)
        setKpiData(queueRes.data.kpiData)
      }
      if (recordsRes.success) setProductionRecords(recordsRes.data as ProductionRecord[])
      setNeededLastUpdated(new Date())
    } catch (error) {
      console.error("Error fetching production data:", error)
    } finally {
      if (isManualRefresh) setRefreshing(false)
      else setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProductionData(false)
  }, [loadProductionData])

  useEffect(() => {
    const onFullscreenChange = () => setIsNeededFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [])

  useEffect(() => {
    if (filter !== "inventory-health") return
    const loadHealth = async () => {
      setInventoryHealthLoading(true)
      try {
        const [stockRes, fastRes, deadRes] = await Promise.all([
          getStockPrediction({ days: inventoryHealthDays }),
          getFastSlowMoving({ days: inventoryHealthDays }),
          getDeadStock({ daysNoMovement: inventoryHealthDays }),
        ])
        if (stockRes.success) setStockPredictionData(stockRes.data)
        if (fastRes.success) setFastSlowData(fastRes.data)
        if (deadRes.success) setDeadStockData(deadRes.data)
      } catch (e) {
        console.error("Inventory health load error:", e)
      } finally {
        setInventoryHealthLoading(false)
      }
    }
    loadHealth()
  }, [filter, inventoryHealthDays])

  const inProgressRecords = useMemo(
    () => productionRecords.filter((r) => r.status === "in_production" || r.status === "In Progress"),
    [productionRecords]
  )
  const completedRecords = useMemo(
    () => productionRecords.filter((r) => r.status === "completed" || r.status === "Completed"),
    [productionRecords]
  )

  const uniqueQueueCustomers = useMemo(
    () => Array.from(new Set((queueData?.rows ?? []).map((row) => row.customerName))).sort((a, b) => a.localeCompare(b)),
    [queueData?.rows]
  )
  const uniqueQueueItems = useMemo(
    () => Array.from(new Set((queueData?.rows ?? []).map((row) => row.itemName))).sort((a, b) => a.localeCompare(b)),
    [queueData?.rows]
  )

  const filteredCustomerOptions = useMemo(() => {
    const s = queueCustomerSearch.trim().toLowerCase()
    if (!s) return uniqueQueueCustomers
    return uniqueQueueCustomers.filter((c) => c.toLowerCase().includes(s))
  }, [queueCustomerSearch, uniqueQueueCustomers])

  const filteredItemOptions = useMemo(() => {
    const s = queueItemSearch.trim().toLowerCase()
    if (!s) return uniqueQueueItems
    return uniqueQueueItems.filter((i) => i.toLowerCase().includes(s))
  }, [queueItemSearch, uniqueQueueItems])

  const getQueueRowStatus = (row: ProductionQueueRow): QueueStatusFilter => {
    if (getRemainingUntilDone(row) === 0 && !row.needsBatchClosure) return "Completed"
    if (row.hasInProductionRecord || row.produced > 0) return "In Progress"
    return "Pending"
  }

  const deferredQueueSearch = useDeferredValue(queueSearch)
  const normalizedQueueSearch = useMemo(() => deferredQueueSearch.trim().toLowerCase(), [deferredQueueSearch])
  const pendingOrderIdsSet = useMemo(() => new Set(kpiData?.pendingOrderIds ?? []), [kpiData?.pendingOrderIds])
  const delayedOrderIdsSet = useMemo(() => new Set(kpiData?.delayedOrderIds ?? []), [kpiData?.delayedOrderIds])
  const completedMonthOrderIdsSet = useMemo(
    () => new Set(kpiData?.completedThisMonthOrderIds ?? []),
    [kpiData?.completedThisMonthOrderIds]
  )
  const noProductionOrderIdsSet = useMemo(() => new Set(kpiData?.noProductionOrderIds ?? []), [kpiData?.noProductionOrderIds])

  // Merged inventory health data — combines stock prediction + fast/slow + dead stock into one list
  const mergedInventoryData = useMemo(() => {
    const speedById: Record<string, "Fast" | "Medium" | "Slow"> = {}
    for (const r of fastSlowData) speedById[r.itemId] = r.classification
    const deadById = new Set(deadStockData.map((r) => r.itemId))
    const daysSinceById: Record<string, number | null> = {}
    for (const r of deadStockData) daysSinceById[r.itemId] = r.daysSinceMovement

    return stockPredictionData
      .map((r) => ({
        ...r,
        speed: speedById[r.itemId] ?? null as "Fast" | "Medium" | "Slow" | null,
        isDead: deadById.has(r.itemId),
        daysSinceMovement: daysSinceById[r.itemId] ?? null as number | null,
      }))
      .sort((a, b) => {
        const urgency = (x: typeof a) => {
          if (x.status === "low") return 0
          if (x.isDead && x.currentStock > 0) return 1
          if (x.status === "ok" && x.speed === "Fast") return 2
          if (x.status === "ok") return 3
          if (x.status === "excess") return 4
          return 5
        }
        return urgency(a) - urgency(b)
      })
  }, [stockPredictionData, fastSlowData, deadStockData])

  const invSummary = useMemo(() => ({
    low: mergedInventoryData.filter((r) => r.status === "low").length,
    dead: mergedInventoryData.filter((r) => r.isDead && r.currentStock > 0).length,
    excess: mergedInventoryData.filter((r) => r.status === "excess").length,
    fast: mergedInventoryData.filter((r) => r.speed === "Fast").length,
  }), [mergedInventoryData])

  const filteredInventoryData = useMemo(() => {
    const search = inventoryHealthSearch.trim().toLowerCase()
    return mergedInventoryData.filter((r) => {
      if (search && !r.itemName.toLowerCase().includes(search)) return false
      if (inventoryHealthFilter === "low") return r.status === "low"
      if (inventoryHealthFilter === "dead") return r.isDead && r.currentStock > 0
      if (inventoryHealthFilter === "excess") return r.status === "excess"
      if (inventoryHealthFilter === "fast") return r.speed === "Fast"
      if (inventoryHealthFilter === "needs-action") return r.status === "low" || (r.isDead && r.currentStock > 0)
      return true
    })
  }, [mergedInventoryData, inventoryHealthSearch, inventoryHealthFilter])

  const filteredQueueRows = useMemo(
    () =>
      (queueData?.rows ?? []).filter((row) => {
        const isNoProductionRow = noProductionOrderIdsSet.has(row.orderId)

        // When "Not Started" KPI is active, show only those rows; otherwise show everything.
        if (kpiFilter === "noProduction" && !isNoProductionRow) return false

        if (normalizedQueueSearch) {
          const displayLabel = getQueueOrderDisplayLabel(row)
          const batchHaystack = [...(row.activeBatchLabels ?? []), ...(row.completedBatchLabels ?? [])]
            .join(" ")
            .toLowerCase()
          const matchesSearch = [row.orderNumber, displayLabel, row.customerName, row.itemName].some((value) =>
            value.toLowerCase().includes(normalizedQueueSearch)
          ) || batchHaystack.includes(normalizedQueueSearch)
          if (!matchesSearch) return false
        }

        if (queueCustomerFilter && row.customerName !== queueCustomerFilter) return false
        if (queueItemFilter && row.itemName !== queueItemFilter) return false

        if (kpiFilter !== "noProduction") {
          if (useDefaultOpenOnlyFilter && !showLinesAwaitingClosure && row.remaining === 0 && !isNoProductionRow) {
            return false
          }
          const rowStatus = getQueueRowStatus(row)
          if (queueStatusFilter === "All") {
            if (useDefaultOpenOnlyFilter && rowStatus === "Completed") {
              return false
            }
          } else if (rowStatus !== queueStatusFilter) {
            return false
          }
        }

        if (kpiFilter !== "none" && kpiFilter !== "noProduction") {
          if (
            kpiFilter === "pending" &&
            (!pendingOrderIdsSet.has(row.orderId) || (getRemainingUntilDone(row) <= 0 && !row.needsBatchClosure))
          ) {
            return false
          }
          if (kpiFilter === "units" && getRemainingUntilDone(row) <= 0) return false
          if (kpiFilter === "delayed" && !delayedOrderIdsSet.has(row.orderId)) return false
          if (kpiFilter === "completedMonth" && !completedMonthOrderIdsSet.has(row.orderId)) return false
        }

        return true
      }),
    [
      completedMonthOrderIdsSet,
      delayedOrderIdsSet,
      kpiFilter,
      noProductionOrderIdsSet,
      normalizedQueueSearch,
      pendingOrderIdsSet,
      queueCustomerFilter,
      queueData?.rows,
      queueItemFilter,
      queueStatusFilter,
      showLinesAwaitingClosure,
      useDefaultOpenOnlyFilter,
    ]
  )

  const sortedQueueRows = useMemo(() => {
    const rows = [...filteredQueueRows]
    const getSortValue = (row: ProductionQueueRow) => {
      switch (queueSortKey) {
        case "orderNumber":
          return getQueueOrderDisplayLabel(row)
        case "customerName":
          return row.customerName
        case "itemName":
          return row.itemName
        case "ordered":
          return row.ordered
        case "produced":
          return getProducedForDisplay(row)
        case "remaining":
          return getRemainingUntilDone(row)
      }
    }
    rows.sort((a, b) => {
      const av = getSortValue(a)
      const bv = getSortValue(b)
      let cmp = 0
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv
      } else {
        cmp = String(av).localeCompare(String(bv), undefined, {
          numeric: true,
          sensitivity: "base",
        })
      }
      return queueSortDirection === "asc" ? cmp : -cmp
    })
    return rows
  }, [filteredQueueRows, queueSortDirection, queueSortKey])

  const handleSort = (key: QueueSortKey) => {
    if (queueSortKey === key) {
      setQueueSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      return
    }
    setQueueSortKey(key)
    setQueueSortDirection("asc")
  }

  const hasActiveQueueFilters =
    queueSearch.trim().length > 0 ||
    queueCustomerFilter.length > 0 ||
    queueItemFilter.length > 0 ||
    queueStatusFilter !== "All" ||
    !useDefaultOpenOnlyFilter ||
    showLinesAwaitingClosure

  // Needed: total remaining quantity per item across ALL open order lines — matches the Queue exactly.
  const neededList = useMemo(() => {
    if (!queueData?.rows?.length) return []
    const byName: Record<string, { lineCount: number; remainingQty: number }> = {}
    for (const row of queueData.rows) {
      const remaining = getRemainingUntilDone(row)
      if (remaining <= 0) continue
      const cur = byName[row.itemName] ?? { lineCount: 0, remainingQty: 0 }
      cur.lineCount += 1
      cur.remainingQty += remaining
      byName[row.itemName] = cur
    }
    return Object.entries(byName)
      .map(([itemName, v]) => ({ itemName, lineCount: v.lineCount, remainingQty: v.remainingQty }))
      .sort((a, b) => a.itemName.localeCompare(b.itemName))
  }, [queueData?.rows])

  const neededClosureLineTotal = useMemo(
    () => neededList.reduce((s, r) => s + r.lineCount, 0),
    [neededList]
  )

  const neededRemainingTotal = useMemo(
    () => neededList.reduce((s, r) => s + r.remainingQty, 0),
    [neededList]
  )

  const handleFullscreenNeeded = () => {
    neededFullscreenRef.current?.requestFullscreen()
  }

  const handleExitFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
  }

  const handlePrintNeeded = async () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    // Fetch logo as base64 data URL so it renders in the isolated print window
    let logoHtml = `<div class="brand-text">SUNKOOL</div>`
    try {
      const response = await fetch('/images/logo.png')
      if (response.ok) {
        const blob = await response.blob()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        logoHtml = `<img src="${dataUrl}" alt="Sunkool" class="brand-logo" />`
      }
    } catch {
      // fall back to text brand
    }

    const sorted = [...neededList].sort((a, b) => b.remainingQty - a.remainingQty)
    const totalLines = sorted.reduce((s, r) => s + r.lineCount, 0)
    const totalRemaining = sorted.reduce((s, r) => s + r.remainingQty, 0)
    const now = new Date()
    const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })

    // Split into two columns for paper efficiency
    const mid = Math.ceil(sorted.length / 2)
    const col1 = sorted.slice(0, mid)
    const col2 = sorted.slice(mid)
    const maxRows = Math.max(col1.length, col2.length)

    const tableRows = Array.from({ length: maxRows }, (_, i) => {
      const a = col1[i]
      const b = col2[i]
      const cellA = a
        ? `<td class="sn">${i + 1}</td>
           <td class="item">${escapeHtml(a.itemName)}</td>
           <td class="qty">${a.remainingQty.toLocaleString()}</td>
           <td class="cb">□</td>`
        : `<td colspan="4" class="empty"></td>`
      const cellB = b
        ? `<td class="sn">${mid + i + 1}</td>
           <td class="item">${escapeHtml(b.itemName)}</td>
           <td class="qty">${b.remainingQty.toLocaleString()}</td>
           <td class="cb">□</td>`
        : `<td colspan="4" class="empty"></td>`
      return `<tr>${cellA}<td class="divider"></td>${cellB}</tr>`
    }).join("")

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Production needed – ${dateStr}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4; margin: 14mm 12mm; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 11px; color: #1e293b; background: #fff; }

    /* ── Header ── */
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 2.5px solid #ea580c; margin-bottom: 10px; }
    .brand-logo { height: 36px; width: auto; display: block; }
    .brand-text { font-size: 22px; font-weight: 800; color: #ea580c; letter-spacing: -0.5px; }
    .brand-sub { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-top: 1px; }
    .doc-title { text-align: right; }
    .doc-title h2 { font-size: 15px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 1px; }
    .doc-title p { font-size: 9px; color: #64748b; margin-top: 2px; }

    /* ── Meta row ── */
    .meta { display: flex; gap: 0; margin-bottom: 12px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
    .meta-cell { flex: 1; padding: 7px 12px; border-right: 1px solid #e2e8f0; }
    .meta-cell:last-child { border-right: none; }
    .meta-label { font-size: 8.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; }
    .meta-value { font-size: 13px; font-weight: 700; color: #1e293b; margin-top: 2px; }

    /* ── Table ── */
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #1e293b; color: #fff; }
    thead th { padding: 7px 8px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; }
    th.sn, td.sn { width: 26px; text-align: center; }
    th.item, td.item { text-align: left; padding-left: 10px; }
    th.qty, td.qty { width: 48px; text-align: right; font-weight: 700; color: #ea580c; }
    th.cb, td.cb { width: 28px; text-align: center; font-size: 13px; color: #94a3b8; }
    th.divider, td.divider { width: 10px; background: #f8fafc; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; }
    tbody tr { border-bottom: 1px solid #f1f5f9; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    td { padding: 6px 8px; font-size: 10.5px; color: #334155; }
    td.sn { color: #94a3b8; font-size: 9.5px; }
    td.qty { font-size: 11px; }
    td.empty { background: #fafafa; }

    /* ── Totals ── */
    .totals-row td { border-top: 2px solid #1e293b; font-weight: 700; font-size: 11px; padding: 8px; background: #f1f5f9; }
    .totals-label { text-align: right; text-transform: uppercase; letter-spacing: 0.5px; font-size: 9.5px; color: #64748b; }

    /* ── Footer ── */
    .footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 8.5px; color: #94a3b8; }
    .footer strong { color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${logoHtml}
      <div class="brand-sub">Production Management System</div>
    </div>
    <div class="doc-title">
      <h2>Production Needed</h2>
      <p>Total units to produce per item across all open orders — sorted by remaining quantity</p>
    </div>
  </div>

  <div class="meta">
    <div class="meta-cell"><div class="meta-label">Date</div><div class="meta-value">${dateStr}</div></div>
    <div class="meta-cell"><div class="meta-label">Time</div><div class="meta-value">${timeStr}</div></div>
    <div class="meta-cell"><div class="meta-label">Total Items</div><div class="meta-value">${sorted.length}</div></div>
    <div class="meta-cell"><div class="meta-label">Total lines</div><div class="meta-value">${totalLines.toLocaleString()}</div></div>
    <div class="meta-cell"><div class="meta-label">Total remaining qty</div><div class="meta-value">${totalRemaining.toLocaleString()}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="sn">#</th>
        <th class="item">Item Name</th>
        <th class="qty">Rem. qty</th>
        <th class="cb">✓</th>
        <th class="divider"></th>
        <th class="sn">#</th>
        <th class="item">Item Name</th>
        <th class="qty">Rem. qty</th>
        <th class="cb">✓</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
      <tr class="totals-row">
        <td colspan="2" class="totals-label">Total remaining (until DONE)</td>
        <td class="qty" style="color:#1e293b">${totalRemaining.toLocaleString()}</td>
        <td class="cb"></td>
        <td class="divider"></td>
        <td colspan="3" style="background:#f1f5f9"></td>
        <td class="cb"></td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <span>Printed: <strong>${dateStr}, ${timeStr}</strong></span>
    <span>Sunkool Production Management · Confidential</span>
    <span>Use □ column to mark items as complete</span>
  </div>

  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`)
    printWindow.document.close()
  }

  const handleRowClick = (row: ProductionQueueRow) => {
    setSelectedRow(row)
    setJourneyOpen(true)
  }

  const handleNeededItemClick = (itemName: string) => {
    setFilter("pending")
    setQueueItemFilter(itemName)
    setUseDefaultOpenOnlyFilter(true)
  }

  const handleQueueStatusChange = (value: QueueStatusFilter) => {
    setQueueStatusFilter(value)
    setUseDefaultOpenOnlyFilter(false)
  }

  const handleClearQueueFilters = () => {
    setQueueSearch("")
    setQueueStatusFilter("All")
    setQueueCustomerFilter("")
    setQueueItemFilter("")
    setKpiFilter("none")
    setUseDefaultOpenOnlyFilter(true)
    setShowLinesAwaitingClosure(false)
  }

  const applyKpiFilter = (next: KpiFilter) => {
    setKpiFilter(next)
    setQueueSearch("")
    setQueueCustomerFilter("")
    setQueueItemFilter("")
    setUseDefaultOpenOnlyFilter(false)
    setShowLinesAwaitingClosure(false)
    if (next === "completedMonth") setQueueStatusFilter("Completed")
    else setQueueStatusFilter("All")
  }

  const isAllChecked = sortedQueueRows.length > 0 && sortedQueueRows.every((r) => checkedItemIds.has(r.itemId))
  const isSomeChecked = sortedQueueRows.some((r) => checkedItemIds.has(r.itemId))

  const handleToggleAll = () => {
    if (isAllChecked) {
      setCheckedItemIds(new Set())
    } else {
      setCheckedItemIds(new Set(sortedQueueRows.map((r) => r.itemId)))
    }
  }

  const handleToggleRow = (itemId: string) => {
    setCheckedItemIds((prev) => {
      const next = new Set(prev)
      next.has(itemId) ? next.delete(itemId) : next.add(itemId)
      return next
    })
  }

  const handleExportExcel = async () => {
    const XLSX = await import("xlsx-js-style")

    const rowsToExport = checkedItemIds.size > 0
      ? sortedQueueRows.filter((r) => checkedItemIds.has(r.itemId))
      : sortedQueueRows

    const formatDate = (iso: string | null) =>
      iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"

    // ── Color palette (orange / slate brand) ──────────────────────────
    const C = {
      brandDark:  "1E293B",   // slate-900  — title bar
      brandOrange:"EA580C",   // orange-600 — header bar
      orangeTint: "FFF7ED",   // orange-50  — alt row
      white:      "FFFFFF",
      lightGray:  "F8FAFC",   // slate-50
      border:     "E2E8F0",   // slate-200
      textDark:   "0F172A",   // slate-950
      textMuted:  "64748B",   // slate-500
      green:      "166534",   // green-800 text
      greenBg:    "DCFCE7",   // green-100
      amber:      "92400E",   // amber-800 text
      amberBg:    "FEF3C7",   // amber-100
      blue:       "1E40AF",   // blue-800 text
      blueBg:     "DBEAFE",   // blue-100
    }

    // ── Column definitions ────────────────────────────────────────────
    const COLS = [
      { label: "#",              width: 5  },
      { label: "Order #",        width: 14 },
      { label: "Order Date",     width: 14 },
      { label: "Customer",       width: 24 },
      { label: "Item",           width: 34 },
      { label: "Active Batch",   width: 14 },
      { label: "Ordered",        width: 10 },
      { label: "Produced",       width: 10 },
      { label: "RP",             width: 8  },
      { label: "Remaining",      width: 11 },
      { label: "Status",         width: 13 },
    ]
    const numCols = COLS.length
    const colLetter = (i: number) => String.fromCharCode(65 + i)
    const lastCol = colLetter(numCols - 1)

    // ── Shared border ─────────────────────────────────────────────────
    const border = {
      top:    { style: "thin", color: { rgb: C.border } },
      bottom: { style: "thin", color: { rgb: C.border } },
      left:   { style: "thin", color: { rgb: C.border } },
      right:  { style: "thin", color: { rgb: C.border } },
    }

    // ── Shared styles ─────────────────────────────────────────────────
    const sTitle = {
      font: { bold: true, sz: 14, color: { rgb: C.white }, name: "Calibri" },
      fill: { patternType: "solid", fgColor: { rgb: C.brandDark } },
      alignment: { horizontal: "center", vertical: "center" },
    }
    const sMeta = {
      font: { sz: 9, italic: true, color: { rgb: C.textMuted }, name: "Calibri" },
      fill: { patternType: "solid", fgColor: { rgb: C.lightGray } },
      alignment: { horizontal: "center", vertical: "center" },
    }
    const sHeader = {
      font: { bold: true, sz: 10, color: { rgb: C.white }, name: "Calibri" },
      fill: { patternType: "solid", fgColor: { rgb: C.brandOrange } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border,
    }
    const sData = (alt: boolean) => ({
      font: { sz: 10, name: "Calibri", color: { rgb: C.textDark } },
      fill: { patternType: "solid", fgColor: { rgb: alt ? C.orangeTint : C.white } },
      alignment: { vertical: "center" },
      border,
    })
    const sDataCenter = (alt: boolean) => ({
      ...sData(alt),
      alignment: { horizontal: "center", vertical: "center" },
    })
    const sDataBold = (alt: boolean) => ({
      ...sData(alt),
      font: { sz: 10, name: "Calibri", color: { rgb: C.textDark }, bold: true },
    })
    const sStatus = (status: string, alt: boolean) => {
      const base = sDataCenter(alt)
      if (status === "Completed")  return { ...base, font: { ...base.font, bold: true, color: { rgb: C.green  } }, fill: { patternType: "solid", fgColor: { rgb: C.greenBg  } } }
      if (status === "In Progress") return { ...base, font: { ...base.font, bold: true, color: { rgb: C.blue  } }, fill: { patternType: "solid", fgColor: { rgb: C.blueBg  } } }
      return { ...base, font: { ...base.font, bold: true, color: { rgb: C.amber } }, fill: { patternType: "solid", fgColor: { rgb: C.amberBg } } }
    }
    const sRemaining = (val: number, alt: boolean) => {
      const base = sDataCenter(alt)
      const color = val === 0 ? C.green : val > 100 ? "991B1B" : val > 20 ? "92400E" : C.textDark
      return { ...base, font: { ...base.font, bold: val > 0, color: { rgb: color } } }
    }

    // ── Build worksheet ───────────────────────────────────────────────
    const ws: Record<string, unknown> = {}

    const totalRemaining = rowsToExport.reduce((s, r) => s + getRemainingUntilDone(r), 0)
    const totalOrdered   = rowsToExport.reduce((s, r) => s + r.ordered, 0)
    const exportedAt     = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })

    // Row 1 — Title (merged across all columns)
    ws["A1"] = { v: "SUNKOOL — Production Queue", t: "s", s: sTitle }

    // Row 2 — Meta
    ws["A2"] = {
      v: `Exported: ${exportedAt}   |   Rows: ${rowsToExport.length}   |   Total Ordered: ${totalOrdered.toLocaleString()}   |   Total Remaining: ${totalRemaining.toLocaleString()}`,
      t: "s", s: sMeta,
    }

    // Row 3 — Orange divider bar
    ws["A3"] = { v: "", t: "s", s: { fill: { patternType: "solid", fgColor: { rgb: C.brandOrange } } } }

    // Row 4 — Column headers
    COLS.forEach((col, i) => {
      ws[`${colLetter(i)}4`] = { v: col.label, t: "s", s: sHeader }
    })

    // Rows 5+ — Data
    rowsToExport.forEach((row, idx) => {
      const r    = idx + 5
      const alt  = idx % 2 === 1
      const status = getQueueRowStatus(row)
      const remaining = getRemainingUntilDone(row)
      const rp = getRequestedProduction(row)

      ws[`A${r}`] = { v: idx + 1,                         t: "n", s: sDataCenter(alt) }
      ws[`B${r}`] = { v: getQueueOrderDisplayLabel(row),   t: "s", s: sDataBold(alt)  }
      ws[`C${r}`] = { v: formatDate(row.orderDate),         t: "s", s: sDataCenter(alt) }
      ws[`D${r}`] = { v: row.customerName,                 t: "s", s: sData(alt)      }
      ws[`E${r}`] = { v: row.itemName,                     t: "s", s: sData(alt)      }
      ws[`F${r}`] = { v: formatActiveBatches(row),         t: "s", s: sDataCenter(alt) }
      ws[`G${r}`] = { v: row.ordered,                      t: "n", s: sDataCenter(alt) }
      ws[`H${r}`] = { v: getProducedForDisplay(row),       t: "n", s: sDataCenter(alt) }
      ws[`I${r}`] = { v: rp > 0 ? rp : "—",               t: rp > 0 ? "n" : "s", s: sDataCenter(alt) }
      ws[`J${r}`] = { v: remaining,                        t: "n", s: sRemaining(remaining, alt) }
      ws[`K${r}`] = { v: status,                           t: "s", s: sStatus(status, alt) }
    })

    // ── Totals row ────────────────────────────────────────────────────
    const tr = rowsToExport.length + 5
    const sTotals = {
      font: { bold: true, sz: 10, name: "Calibri", color: { rgb: C.white } },
      fill: { patternType: "solid", fgColor: { rgb: C.brandDark } },
      alignment: { horizontal: "center", vertical: "center" },
      border,
    }
    const sTotalsLabel = { ...sTotals, alignment: { horizontal: "right", vertical: "center" } }
    for (let i = 0; i < numCols; i++) ws[`${colLetter(i)}${tr}`] = { v: "", t: "s", s: sTotals }
    ws[`D${tr}`] = { v: "TOTALS",                 t: "s", s: sTotalsLabel }
    ws[`G${tr}`] = { v: totalOrdered,              t: "n", s: sTotals }
    ws[`J${tr}`] = { v: totalRemaining,            t: "n", s: sTotals }

    // ── Worksheet metadata ────────────────────────────────────────────
    ws["!ref"] = `A1:${lastCol}${tr}`

    // Merge title + meta + divider rows across all columns
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },  // title
      { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } },  // meta
      { s: { r: 2, c: 0 }, e: { r: 2, c: numCols - 1 } },  // divider
    ]

    ws["!cols"] = COLS.map((c) => ({ wch: c.width }))

    // Row heights
    ws["!rows"] = [
      { hpt: 28 },  // title
      { hpt: 18 },  // meta
      { hpt: 4  },  // divider
      { hpt: 22 },  // headers
      ...rowsToExport.map(() => ({ hpt: 18 })),
      { hpt: 20 },  // totals
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Production Queue")
    XLSX.writeFile(wb, `sunkool-production-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function escapeHtml(s: string) {
    const div = { textContent: s }
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  }

  const todayLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date())


  return (
    <div className="space-y-5 bg-[#F1F5F9] pb-3 lg:space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm lg:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0F172A]">Production</h1>
          <p className="mt-1 text-xs text-slate-400">{todayLabel}</p>
        </div>

      </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <button
          type="button"
          onClick={() => applyKpiFilter("noProduction")}
          className={cn(
            "overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all hover:shadow-md",
            kpiFilter === "noProduction" ? "border-red-400 ring-2 ring-red-200" : "border-slate-200 hover:border-red-200"
          )}
        >
          <div className="h-[3px] w-full bg-red-500"></div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Not Started</p>
            <div className="mt-2 text-4xl font-semibold leading-none text-slate-900">{kpiData?.noProductionOrdersCount ?? 0}</div>
            <p className="mt-2 text-xs text-slate-500">New orders awaiting production</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => applyKpiFilter("pending")}
          className={cn(
            "overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all hover:shadow-md",
            kpiFilter === "pending" ? "border-orange-400 ring-2 ring-orange-200" : "border-slate-200 hover:border-orange-200"
          )}
        >
          <div className="h-[3px] w-full bg-orange-500"></div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Pending</p>
            <div className="mt-2 text-4xl font-semibold leading-none text-slate-900">{kpiData?.pendingOrdersCount ?? 0}</div>
            <p className="mt-2 text-xs text-slate-500">Orders currently in production</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => applyKpiFilter("delayed")}
          className={cn(
            "overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all hover:shadow-md",
            kpiFilter === "delayed" ? "border-violet-400 ring-2 ring-violet-200" : "border-slate-200 hover:border-violet-200"
          )}
        >
          <div className="h-[3px] w-full bg-violet-500"></div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Production Delayed</p>
            <div className="mt-2 text-4xl font-semibold leading-none text-slate-900">{kpiData?.productionDelayedCount ?? 0}</div>
            <p className="mt-2 text-xs text-slate-500">No production action for 5 days</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => applyKpiFilter("completedMonth")}
          className={cn(
            "overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all hover:shadow-md",
            kpiFilter === "completedMonth" ? "border-green-400 ring-2 ring-green-200" : "border-slate-200 hover:border-green-200"
          )}
        >
          <div className="h-[3px] w-full bg-green-600"></div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Completed</p>
            <div className="mt-2 text-4xl font-semibold leading-none text-slate-900">{kpiData?.completedThisMonthCount ?? 0}</div>
            <p className="mt-2 text-xs text-slate-500">Production completed this month</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => applyKpiFilter("units")}
          className={cn(
            "overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all hover:shadow-md",
            kpiFilter === "units" ? "border-cyan-400 ring-2 ring-cyan-200" : "border-slate-200 hover:border-cyan-200"
          )}
        >
          <div className="h-[3px] w-full bg-cyan-600"></div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Total Units to Produce</p>
            <div className="mt-2 text-4xl font-semibold leading-none text-slate-900">{kpiData?.totalUnitsToProduce ?? 0}</div>
            <p className="mt-2 text-xs text-slate-500">Remaining across all items</p>
          </div>
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex overflow-x-auto">
          {[
            { key: "pending" as const, icon: Clock, label: "Production Queue", count: sortedQueueRows.length, tabTitle: undefined as string | undefined },
            {
              key: "needed" as const,
              icon: Package,
              label: "Needed",
              count: neededRemainingTotal,
              tabTitle: undefined as string | undefined,
            },
            { key: "inventory-health" as const, icon: Activity, label: "Inventory Health", count: null as number | null, tabTitle: undefined as string | undefined },
          ].map(({ key, icon: Icon, label, count, tabTitle }) => (
            <button
              key={key}
              type="button"
              title={tabTitle}
              onClick={() => setFilter(key)}
              className={cn(
                "relative flex shrink-0 items-center gap-2 px-5 py-4 text-[13px] font-medium transition-colors focus:outline-none",
                filter === key
                  ? "text-orange-500"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {count !== null && (
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none",
                  filter === key
                    ? "bg-orange-100 text-orange-600"
                    : "bg-slate-100 text-slate-500"
                )}>
                  {typeof count === "number" ? count.toLocaleString() : count}
                </span>
              )}
              {/* Active underline */}
              {filter === key && (
                <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-t-full bg-orange-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content based on filter */}
      {loading ? (
        <Card className="rounded-xl border-slate-200">
          <CardContent className="py-8">
            <p className="text-center text-slate-500">Loading production data...</p>
          </CardContent>
        </Card>
      ) : filter === "pending" ? (
        <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-200 bg-white px-5 py-4">
            <div className="flex flex-col gap-3 lg:gap-4">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-900">Production queue – complete orders, item-wise</CardTitle>
                <p className="mt-1 text-xs text-slate-500">
                  <span className="font-medium text-slate-600">Remaining</span> is units left until batches are marked DONE: ordered minus produced on{" "}
                  <span className="font-medium text-slate-600">completed</span> batches only. Produced = Ordered − Remaining (until DONE).
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                    placeholder="Search by order, customer, or item"
                    className="h-9 rounded-lg border-slate-200 bg-white pl-9 text-sm placeholder:text-slate-400 focus-visible:border-orange-500 focus-visible:ring-[3px] focus-visible:ring-orange-500/15"
                  />
                </div>

                <select
                  value={queueStatusFilter}
                  onChange={(e) => handleQueueStatusChange(e.target.value as QueueStatusFilter)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-orange-500 focus:outline-none focus:ring-[3px] focus:ring-orange-500/15 lg:w-[150px]"
                >
                  <option value="All">All</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>

                <div className="flex flex-col gap-1.5 lg:w-[190px]">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-9 w-full justify-between rounded-lg border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 hover:bg-white"
                      >
                        <span className="truncate">{queueCustomerFilter || "All customers"}</span>
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[300px] rounded-xl border border-slate-200 p-0">
                      <div className="border-b border-slate-100 p-2">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            value={queueCustomerSearch}
                            onChange={(e) => setQueueCustomerSearch(e.target.value)}
                            placeholder="Search customers..."
                            className="h-10 rounded-xl border-slate-200 pl-9 text-sm focus-visible:ring-orange-500/20"
                          />
                        </div>
                      </div>
                      <div className="max-h-64 overflow-y-auto p-1">
                        <DropdownMenuItem
                          onClick={() => setQueueCustomerFilter("")}
                          className="flex items-center justify-between rounded-md px-3 py-2 text-sm"
                        >
                          <span>All customers</span>
                          {!queueCustomerFilter ? <Check className="h-4 w-4 text-orange-500" /> : null}
                        </DropdownMenuItem>
                        {filteredCustomerOptions.map((customer) => (
                          <DropdownMenuItem
                            key={customer}
                            onClick={() => setQueueCustomerFilter(customer)}
                            className="flex items-center justify-between rounded-md px-3 py-2 text-sm"
                          >
                            <span className="truncate">{customer}</span>
                            {queueCustomerFilter === customer ? <Check className="h-4 w-4 text-orange-500" /> : null}
                          </DropdownMenuItem>
                        ))}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex flex-col gap-1.5 lg:w-[190px]">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-9 w-full justify-between rounded-lg border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 hover:bg-white"
                      >
                        <span className="truncate">{queueItemFilter || "All items"}</span>
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[300px] rounded-xl border border-slate-200 p-0">
                      <div className="border-b border-slate-100 p-2">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            value={queueItemSearch}
                            onChange={(e) => setQueueItemSearch(e.target.value)}
                            placeholder="Search items..."
                            className="h-10 rounded-xl border-slate-200 pl-9 text-sm focus-visible:ring-orange-500/20"
                          />
                        </div>
                      </div>
                      <div className="max-h-64 overflow-y-auto p-1">
                        <DropdownMenuItem
                          onClick={() => setQueueItemFilter("")}
                          className="flex items-center justify-between rounded-md px-3 py-2 text-sm"
                        >
                          <span>All items</span>
                          {!queueItemFilter ? <Check className="h-4 w-4 text-orange-500" /> : null}
                        </DropdownMenuItem>
                        {filteredItemOptions.map((item) => (
                          <DropdownMenuItem
                            key={item}
                            onClick={() => setQueueItemFilter(item)}
                            className="flex items-center justify-between rounded-md px-3 py-2 text-sm"
                          >
                            <span className="truncate">{item}</span>
                            {queueItemFilter === item ? <Check className="h-4 w-4 text-orange-500" /> : null}
                          </DropdownMenuItem>
                        ))}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {hasActiveQueueFilters ? (
                  <Button
                    variant="outline"
                    onClick={handleClearQueueFilters}
                    className="h-9 gap-1 rounded-lg border-slate-200 text-xs text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear filters
                  </Button>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
                <label
                  htmlFor="show-awaiting-closure"
                  className="flex cursor-pointer items-center gap-2 text-xs text-slate-600"
                >
                  <input
                    id="show-awaiting-closure"
                    type="checkbox"
                    checked={showLinesAwaitingClosure}
                    onChange={(e) => setShowLinesAwaitingClosure(e.target.checked)}
                    className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-orange-500"
                  />
                  <span>Show lines awaiting batch closure (0 remaining until DONE on order)</span>
                </label>
              </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!filteredQueueRows.length ? (
              <div className="py-12 text-center">
                <CheckCircle className="mx-auto mb-3 h-12 w-12 text-green-500" />
                <p className="text-slate-500">{queueData?.rows?.length ? "No queue rows match your search and filters" : "No orders in production"}</p>
                <p className="mt-1 text-sm text-slate-400">Only started production orders appear here with item-wise details.</p>
              </div>
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="space-y-3 p-4 lg:hidden">
                  {sortedQueueRows.map((row) => {
                    return (
                    <button
                      key={row.itemId}
                      type="button"
                      onClick={() => handleRowClick(row)}
                      className="block w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-orange-200 hover:bg-orange-50/40 hover:shadow-md active:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className={cn("truncate text-sm font-semibold", getQueueOrderNumberClass(row))}>
                            {getQueueOrderDisplayLabel(row)}
                          </p>
                          {(row.activeBatchLabels?.length ?? 0) > 0 ? (
                            <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
                              Batch: {formatActiveBatches(row)}
                            </p>
                          ) : null}
                          <p className="mt-0.5 truncate text-sm text-slate-600">{row.customerName}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-slate-800">{row.itemName}</p>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span>Ordered: {row.ordered}</span>
                            <span>Produced: {getProducedForDisplay(row)}</span>
                            {getRequestedProduction(row) > 0 && (
                              <span className="flex items-center gap-1">
                                RP:&nbsp;
                                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                  {getRequestedProduction(row)}
                                </span>
                              </span>
                            )}
                            <span className="font-semibold text-slate-700">Remaining:</span>
                            <RemainingQuantityDisplay row={row} size="sm" />
                          </div>
                        </div>
                        <Link
                          href={`/dashboard/orders/${row.orderId}`}
                          onClick={(event) => event.stopPropagation()}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors hover:border-orange-500 hover:bg-orange-50 hover:text-orange-500"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </button>
                  )})}
                </div>

                {/* Desktop: table */}
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full">
                    <thead className="border-b-2 border-slate-200 bg-slate-50/80">
                      <tr>
                        <th className="h-10 w-10 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isAllChecked}
                            ref={(el) => { if (el) el.indeterminate = isSomeChecked && !isAllChecked }}
                            onChange={handleToggleAll}
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-orange-500"
                          />
                        </th>
                        <th className="h-10 px-4 text-left text-[11px] font-medium uppercase tracking-[0.07em] text-slate-500">
                          <button type="button" onClick={() => handleSort("orderNumber")} className="inline-flex items-center gap-1 hover:text-slate-700">
                            Order #
                            {queueSortKey === "orderNumber" ? (
                              queueSortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
                            )}
                          </button>
                        </th>
                        <th className="h-10 max-w-[140px] px-3 text-left text-[11px] font-medium uppercase tracking-[0.07em] text-slate-500">
                          Active batch
                        </th>
                        <th className="h-10 px-4 text-left text-[11px] font-medium uppercase tracking-[0.07em] text-slate-500">
                          <button type="button" onClick={() => handleSort("customerName")} className="inline-flex items-center gap-1 hover:text-slate-700">
                            Customer
                            {queueSortKey === "customerName" ? (
                              queueSortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
                            )}
                          </button>
                        </th>
                        <th className="h-10 px-4 text-left text-[11px] font-medium uppercase tracking-[0.07em] text-slate-500">Order Date</th>
                        <th className="h-10 px-4 text-left text-[11px] font-medium uppercase tracking-[0.07em] text-slate-500">
                          <button type="button" onClick={() => handleSort("itemName")} className="inline-flex items-center gap-1 hover:text-slate-700">
                            Item
                            {queueSortKey === "itemName" ? (
                              queueSortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
                            )}
                          </button>
                        </th>
                        <th className="h-10 px-4 text-center text-[11px] font-medium uppercase tracking-[0.07em] text-slate-500">
                          <button
                            type="button"
                            onClick={() => handleSort("ordered")}
                            className="mx-auto inline-flex items-center gap-1 hover:text-slate-700"
                          >
                            Ordered
                            {queueSortKey === "ordered" ? (
                              queueSortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
                            )}
                          </button>
                        </th>
                        <th className="h-10 px-4 text-center text-[11px] font-medium uppercase tracking-[0.07em] text-slate-500">
                          <button
                            type="button"
                            onClick={() => handleSort("produced")}
                            title="Produced on completed batches = Ordered − Remaining (until DONE)."
                            className="mx-auto inline-flex items-center gap-1 hover:text-slate-700"
                          >
                            Produced
                            {queueSortKey === "produced" ? (
                              queueSortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
                            )}
                          </button>
                        </th>
                        <th className="h-10 px-4 text-center text-[11px] font-medium uppercase tracking-[0.07em] text-slate-500">
                          <span
                            title="Requested Production — quantity allocated in active (in-production) checklists, not yet completed."
                            className="mx-auto inline-flex cursor-default items-center gap-1"
                          >
                            RP
                          </span>
                        </th>
                        <th className="h-10 px-4 text-center text-[11px] font-medium uppercase tracking-[0.07em] text-slate-500">
                          <button
                            type="button"
                            onClick={() => handleSort("remaining")}
                            title="Ordered minus produced on completed batches only. In-progress batches do not reduce this until marked DONE."
                            className="mx-auto inline-flex items-center gap-1 hover:text-slate-700"
                          >
                            Remaining
                            {queueSortKey === "remaining" ? (
                              queueSortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
                            )}
                          </button>
                        </th>
                        <th className="h-10 w-20 px-4 text-center text-[11px] font-medium uppercase tracking-[0.07em] text-slate-500">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedQueueRows.map((row, index) => {
                        const isFirstInGroup = index === 0 || sortedQueueRows[index - 1].orderId !== row.orderId

                        return (
                          <tr
                            key={row.itemId}
                            onClick={() => handleRowClick(row)}
                            className={cn(
                              "h-12 cursor-pointer border-b border-slate-100 text-[13px] text-slate-900 transition-colors hover:bg-orange-50/70",
                              checkedItemIds.has(row.itemId) ? "bg-orange-50/60" : index % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"
                            )}
                          >
                            <td className="px-3 py-0 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={checkedItemIds.has(row.itemId)}
                                onChange={() => handleToggleRow(row.itemId)}
                                className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-orange-500"
                              />
                            </td>
                            <td className={cn(
                              "px-4 py-0",
                              isFirstInGroup ? "border-l-[3px] border-l-orange-500" : "border-l-[3px] border-l-orange-200"
                            )}>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleRowClick(row)
                                }}
                                className={cn("inline-flex items-center text-xs font-medium", getQueueOrderNumberClass(row))}
                              >
                                {getQueueOrderDisplayLabel(row)}
                              </button>
                            </td>
                            <td className="max-w-[140px] truncate px-3 py-0 text-[12px] text-slate-600" title={formatActiveBatches(row)}>
                              {formatActiveBatches(row)}
                            </td>
                            <td className="max-w-[180px] truncate px-4 py-0 text-[13px] text-slate-600">{row.customerName}</td>
                            <td className="whitespace-nowrap px-4 py-0 text-[12px] text-slate-400">
                              {row.orderDate ? new Date(row.orderDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                            </td>
                            <td className="max-w-[240px] px-4 py-0 text-[13px] font-medium text-slate-900">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="truncate">{row.itemName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-0 text-center text-[13px] font-medium text-slate-900">{row.ordered}</td>
                            <td
                              className="px-4 py-0 text-center text-[13px] font-medium tabular-nums text-slate-700"
                              title="Completed batches only: Ordered − Remaining (until DONE)."
                            >
                              {getProducedForDisplay(row)}
                            </td>
                            <td className="px-4 py-0 text-center" title="Requested Production — quantity in active in-production checklists, not yet completed.">
                              {getRequestedProduction(row) > 0 ? (
                                <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-blue-700">
                                  {getRequestedProduction(row)}
                                </span>
                              ) : (
                                <span className="text-[12px] text-slate-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-0 text-center">
                              <RemainingQuantityDisplay row={row} />
                            </td>
                            <td className="px-4 py-0 text-center">
                              <Link
                                href={`/dashboard/orders/${row.orderId}`}
                                onClick={(event) => event.stopPropagation()}
                                title="Open order"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-all hover:border-orange-500 hover:bg-orange-50 hover:text-orange-500"
                              >
                                <ExternalLink className="h-[13px] w-[13px]" />
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  <div className="flex items-center justify-between border-t-2 border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-400">
                      Showing {sortedQueueRows.length} of {queueData?.rows.length ?? 0} items
                      {checkedItemIds.size > 0 && <span className="ml-2 font-medium text-orange-500">· {checkedItemIds.size} selected</span>}
                    </p>
                    <button
                      type="button"
                      onClick={handleExportExcel}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-green-300 hover:bg-green-50 hover:text-green-700"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      {checkedItemIds.size > 0 ? `Export ${checkedItemIds.size} rows` : "Export all"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : filter === "needed" ? (
        <div
          ref={neededFullscreenRef}
          className={cn(
            "rounded-2xl border border-slate-200 bg-white shadow-sm",
            isNeededFullscreen && "flex flex-col border-0 bg-[#F1F5F9]"
          )}
        >
          {/* Header */}
          <div className={cn(
            "flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4",
            isNeededFullscreen && "bg-white px-8 py-5 shadow-sm"
          )}>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-[16px] font-semibold text-slate-900">Production Needed</h2>
                <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[12px] font-semibold text-orange-600">
                  {neededList.length} items
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Total units still to produce across all open orders —{" "}
                <span className="font-medium text-slate-600">
                  {neededRemainingTotal.toLocaleString()} units remaining
                </span>{" "}
                across {neededClosureLineTotal.toLocaleString()} order line{neededClosureLineTotal === 1 ? "" : "s"} ·{" "}
                {neededList.length} item type{neededList.length === 1 ? "" : "s"}
                {neededLastUpdated && <span className="ml-2">· Updated {neededLastUpdated.toLocaleTimeString()}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <button
                type="button"
                onClick={handlePrintNeeded}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-600 shadow-sm transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
              >
                <Printer className="h-4 w-4" />
                Print production list
              </button>
              <button
                type="button"
                onClick={isNeededFullscreen ? handleExitFullscreen : handleFullscreenNeeded}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                aria-label={isNeededFullscreen ? "Exit fullscreen" : "View fullscreen"}
              >
                {isNeededFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                {isNeededFullscreen ? "Exit" : "Fullscreen"}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className={cn(
            "p-4",
            isNeededFullscreen && "flex-1 overflow-y-auto px-8 py-6"
          )}>
            {neededList.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle className="mx-auto mb-3 h-12 w-12 text-green-400" />
                <p className="font-medium text-slate-600">All clear!</p>
                <p className="mt-1 text-sm text-slate-400">No remaining production across all open orders.</p>
              </div>
            ) : (
              (() => {
                const sorted = [...neededList].sort((a, b) => b.remainingQty - a.remainingQty)
                const mid = Math.ceil(sorted.length / 2)
                const col1 = sorted.slice(0, mid)
                const col2 = sorted.slice(mid)

                const renderCol = (rows: { itemName: string; lineCount: number; remainingQty: number }[], offset: number) => (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-slate-200 bg-slate-50">
                          <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400 w-8">#</th>
                          <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">Item</th>
                          <th
                            className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400 w-32"
                            title="Sum of remaining quantity (until DONE) across all open order lines for this item"
                          >
                            Remaining qty
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(({ itemName, remainingQty }, i) => {
                          const rank = offset + i + 1
                          const isHigh = remainingQty >= 100
                          const isMed = remainingQty >= 25 && remainingQty < 100
                          return (
                            <tr
                              key={itemName}
                              onClick={() => handleNeededItemClick(itemName)}
                              className={cn(
                                "cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-orange-50/60",
                                i % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                              )}
                            >
                              <td className="px-4 py-3 text-[11px] text-slate-300 font-medium">{rank}</td>
                              <td className="px-4 py-3">
                                <span className="text-[13px] font-medium text-slate-800">{itemName}</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={cn(
                                  "inline-flex items-center rounded-full px-3 py-1 text-[13px] font-bold",
                                  isHigh ? "bg-red-100 text-red-700"
                                    : isMed ? "bg-amber-100 text-amber-700"
                                      : "bg-slate-100 text-slate-600"
                                )}>
                                  {remainingQty.toLocaleString()}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )

                return (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {renderCol(col1, 0)}
                    {col2.length > 0 && renderCol(col2, mid)}
                  </div>
                )
              })()
            )}
          </div>

          {/* Footer summary */}
          {neededList.length > 0 && (
            <div className={cn(
              "flex items-center justify-between border-t border-slate-200 bg-slate-50/80 px-5 py-3 print:hidden",
              isNeededFullscreen && "px-8"
            )}>
              <p className="text-xs text-slate-400">
                Sorted by remaining quantity (until DONE) · Click an item to open the queue filtered to that SKU
              </p>
              <p className="text-xs font-semibold text-slate-600">
                Total: {neededRemainingTotal.toLocaleString()} units · {neededClosureLineTotal.toLocaleString()} order line{neededClosureLineTotal === 1 ? "" : "s"} · {neededList.length} item type{neededList.length === 1 ? "" : "s"}
              </p>
            </div>
          )}
        </div>
      ) : filter === "inventory-health" ? (
        <div className="space-y-4">
          {/* Header */}
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-[17px] font-semibold text-[#0F172A]">Inventory Intelligence</h2>
                <p className="mt-0.5 text-xs text-slate-400">What needs your attention — sorted by urgency</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Period:</span>
                {([7, 30, 90] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setInventoryHealthDays(d)}
                    className={cn(
                      "h-8 rounded-lg px-3 text-[13px] font-medium transition-colors",
                      inventoryHealthDays === d
                        ? "bg-orange-500 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:text-orange-500"
                    )}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
          </div>

          {inventoryHealthLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
              <Activity className="mx-auto mb-3 h-8 w-8 animate-pulse text-slate-300" />
              <p className="text-sm text-slate-400">Analysing your inventory...</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setInventoryHealthFilter(inventoryHealthFilter === "low" ? "all" : "low")}
                  className={cn(
                    "rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:shadow-md",
                    inventoryHealthFilter === "low" ? "border-red-400 ring-2 ring-red-100" : "border-slate-200 hover:border-red-200"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Low Stock</p>
                    <span className="text-lg">🔴</span>
                  </div>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{invSummary.low}</p>
                  <p className="mt-1 text-[11px] text-slate-500">items running low — produce soon</p>
                </button>

                <button
                  type="button"
                  onClick={() => setInventoryHealthFilter(inventoryHealthFilter === "dead" ? "all" : "dead")}
                  className={cn(
                    "rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:shadow-md",
                    inventoryHealthFilter === "dead" ? "border-amber-400 ring-2 ring-amber-100" : "border-slate-200 hover:border-amber-200"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Not Moving</p>
                    <span className="text-lg">📦</span>
                  </div>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{invSummary.dead}</p>
                  <p className="mt-1 text-[11px] text-slate-500">items with stock but no sales</p>
                </button>

                <button
                  type="button"
                  onClick={() => setInventoryHealthFilter(inventoryHealthFilter === "fast" ? "all" : "fast")}
                  className={cn(
                    "rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:shadow-md",
                    inventoryHealthFilter === "fast" ? "border-green-400 ring-2 ring-green-100" : "border-slate-200 hover:border-green-200"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Fast Moving</p>
                    <span className="text-lg">🚀</span>
                  </div>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{invSummary.fast}</p>
                  <p className="mt-1 text-[11px] text-slate-500">top selling items — keep stocked</p>
                </button>

                <button
                  type="button"
                  onClick={() => setInventoryHealthFilter(inventoryHealthFilter === "excess" ? "all" : "excess")}
                  className={cn(
                    "rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:shadow-md",
                    inventoryHealthFilter === "excess" ? "border-slate-500 ring-2 ring-slate-100" : "border-slate-200 hover:border-slate-400"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Overstocked</p>
                    <span className="text-lg">⚠️</span>
                  </div>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{invSummary.excess}</p>
                  <p className="mt-1 text-[11px] text-slate-500">items with excess inventory</p>
                </button>
              </div>

              {/* Filter + Search bar */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {(["all", "needs-action", "low", "dead", "fast", "excess"] as const).map((f) => {
                      const labels: Record<typeof f, string> = {
                        "all": "All items",
                        "needs-action": `⚠️ Needs Action (${invSummary.low + invSummary.dead})`,
                        "low": `🔴 Low Stock (${invSummary.low})`,
                        "dead": `📦 Not Moving (${invSummary.dead})`,
                        "fast": `🚀 Fast Moving (${invSummary.fast})`,
                        "excess": `Overstocked (${invSummary.excess})`,
                      }
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setInventoryHealthFilter(f)}
                          className={cn(
                            "h-7 rounded-full px-3 text-[12px] font-medium transition-colors",
                            inventoryHealthFilter === f
                              ? "bg-orange-500 text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          )}
                        >
                          {labels[f]}
                        </button>
                      )
                    })}
                  </div>
                  <div className="relative lg:w-56">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      value={inventoryHealthSearch}
                      onChange={(e) => setInventoryHealthSearch(e.target.value)}
                      placeholder="Search item..."
                      className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-[13px] text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/15"
                    />
                  </div>
                </div>

                {/* Table */}
                {filteredInventoryData.length === 0 ? (
                  <div className="py-14 text-center">
                    <CheckCircle className="mx-auto mb-3 h-10 w-10 text-green-400" />
                    <p className="text-sm font-medium text-slate-600">All clear!</p>
                    <p className="mt-1 text-xs text-slate-400">No items match this filter.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b-2 border-slate-100 bg-slate-50/60">
                        <tr>
                          <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Item</th>
                          <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">Stock Level</th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400">In Hand</th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sold ({inventoryHealthDays}d)</th>
                          <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">Weeks Left</th>
                          <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">Speed</th>
                          <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInventoryData.map((r, i) => {
                          const weeksBarWidth = r.weeksOfStock != null
                            ? Math.min(100, Math.round((r.weeksOfStock / 8) * 100))
                            : r.currentStock > 0 ? 100 : 0
                          const barColor = r.status === "low"
                            ? "bg-red-400"
                            : r.status === "excess"
                              ? "bg-slate-300"
                              : r.weeksOfStock != null && r.weeksOfStock < 4
                                ? "bg-amber-400"
                                : "bg-green-400"

                          const actionLabel = r.status === "low"
                            ? { text: "Produce Now", cls: "bg-red-100 text-red-700" }
                            : r.isDead && r.currentStock > 0
                              ? { text: "Investigate", cls: "bg-amber-100 text-amber-700" }
                              : r.status === "excess"
                                ? { text: "Overstocked", cls: "bg-slate-100 text-slate-600" }
                                : r.speed === "Fast"
                                  ? { text: "Keep Stocked", cls: "bg-green-100 text-green-700" }
                                  : { text: "—", cls: "text-slate-300" }

                          const weeksLabel = r.weeksOfStock != null
                            ? `${r.weeksOfStock}w`
                            : r.currentStock > 0 ? "∞" : "0"
                          const weeksCls = r.status === "low"
                            ? "bg-red-100 text-red-700 font-semibold"
                            : r.weeksOfStock != null && r.weeksOfStock < 4
                              ? "bg-amber-100 text-amber-700"
                              : r.status === "excess"
                                ? "bg-slate-100 text-slate-500"
                                : "bg-green-100 text-green-700"

                          return (
                            <tr
                              key={r.itemId}
                              className={cn(
                                "border-b border-slate-100 text-[13px] transition-colors hover:bg-orange-50/40",
                                i % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                              )}
                            >
                              <td className={cn(
                                "px-5 py-3 font-medium text-slate-900",
                                r.status === "low" ? "border-l-[3px] border-l-red-400" : "border-l-[3px] border-l-transparent"
                              )}>
                                {r.itemName}
                                {r.isDead && r.currentStock > 0 && (
                                  <span className="ml-2 text-[10px] font-medium text-amber-500">
                                    {r.daysSinceMovement != null ? `${r.daysSinceMovement}d no sales` : "no movement"}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="mx-auto w-24">
                                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                                    <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${weeksBarWidth}%` }} />
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-slate-800">{r.currentStock.toLocaleString()}</td>
                              <td className="px-4 py-3 text-right text-slate-500">{r.demandInPeriod > 0 ? r.demandInPeriod : "—"}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px]", weeksCls)}>
                                  {weeksLabel}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {r.speed ? (
                                  <span className={cn(
                                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                                    r.speed === "Fast" ? "bg-green-100 text-green-700"
                                      : r.speed === "Slow" ? "bg-amber-100 text-amber-700"
                                        : "bg-slate-100 text-slate-500"
                                  )}>
                                    {r.speed}
                                  </span>
                                ) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium", actionLabel.cls)}>
                                  {actionLabel.text}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
                      <p className="text-xs text-slate-400">
                        Showing {filteredInventoryData.length} of {mergedInventoryData.length} items · Period: last {inventoryHealthDays} days
                        {invSummary.low > 0 && (
                          <span className="ml-3 font-medium text-red-500">{invSummary.low} item{invSummary.low > 1 ? "s" : ""} need production attention</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
      <OrderJourneySheet open={journeyOpen} onOpenChange={setJourneyOpen} row={selectedRow} />
    </div>
  )
}

