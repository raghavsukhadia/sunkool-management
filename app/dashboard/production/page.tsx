"use client"

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
// xlsx-js-style loaded dynamically in handleExportExcel for code-splitting
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Package, Clock, CheckCircle, ExternalLink, Printer, Search, Maximize2, Minimize2, ChevronRight, ChevronDown, ChevronUp, ArrowUpDown, Check, X, FileDown, Factory, Layers } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  getProductionQueue,
  getProductionRecordsList,
  type ProductionKpiData,
  type ProductionQueueRow,
  type ProductionQueueResult,
} from "@/app/actions/production"
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
  const [filter, setFilter] = useState<"pending" | "needed" | "under-production" | "nfp">("pending")
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
  /** When false, hide line items with 0 remaining until DONE (fully allocated on an open batch awaiting closure). */
  const [showLinesAwaitingClosure, setShowLinesAwaitingClosure] = useState(true)
  const [nfpSearch, setNfpSearch] = useState("")
  const [nfpSortKey, setNfpSortKey] = useState<"itemName" | "inProductionQty" | "remainingQty" | "sum">("sum")
  const [nfpSortDir, setNfpSortDir] = useState<"asc" | "desc">("desc")
  const [nfpStatusFilter, setNfpStatusFilter] = useState<"all" | "in-production-only" | "remaining-only" | "both">("all")
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
          // Hide awaiting-closure rows (remainingUntilDone === 0 but batch still open) when checkbox is off
          if (!showLinesAwaitingClosure && row.remainingUntilDone === 0 && !isNoProductionRow) {
            return false
          }
          const rowStatus = getQueueRowStatus(row)
          if (queueStatusFilter !== "All" && rowStatus !== queueStatusFilter) {
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
    kpiFilter !== "none" ||
    !showLinesAwaitingClosure

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

  // Under Production: items currently active in an in-production batch.
  const underProductionList = useMemo(() => {
    if (!queueData?.rows?.length) return []
    const byName: Record<string, {
      orderCount: number
      inProductionQty: number
      batches: Set<string>
      customers: Set<string>
    }> = {}
    for (const row of queueData.rows) {
      if (!row.hasInProductionRecord) continue
      const rp = getRequestedProduction(row)
      const cur = byName[row.itemName] ?? { orderCount: 0, inProductionQty: 0, batches: new Set(), customers: new Set() }
      cur.orderCount += 1
      cur.inProductionQty += rp
      for (const b of row.activeBatchLabels) cur.batches.add(b)
      cur.customers.add(row.customerName)
      byName[row.itemName] = cur
    }
    return Object.entries(byName)
      .map(([itemName, v]) => ({
        itemName,
        orderCount: v.orderCount,
        inProductionQty: v.inProductionQty,
        batches: Array.from(v.batches).sort(),
        customers: Array.from(v.customers).sort(),
      }))
      .sort((a, b) => b.inProductionQty - a.inProductionQty)
  }, [queueData?.rows])

  const underProductionTotalQty = useMemo(
    () => underProductionList.reduce((s, r) => s + r.inProductionQty, 0),
    [underProductionList]
  )

  // NFP: per-item breakdown of In Production + Remaining = Total Need.
  // Computed directly from queue rows for accuracy (no double-counting).
  const nfpList = useMemo(() => {
    if (!queueData?.rows?.length) return []
    const byName: Record<string, {
      inProductionQty: number
      remainingQty: number
      batches: Set<string>
      orderLines: number
    }> = {}
    for (const row of queueData.rows) {
      const rp  = getRequestedProduction(row)
      const rem = getRemainingUntilDone(row)
      if (rp <= 0 && rem <= 0) continue
      if (!byName[row.itemName]) byName[row.itemName] = { inProductionQty: 0, remainingQty: 0, batches: new Set(), orderLines: 0 }
      const cur = byName[row.itemName]
      cur.inProductionQty += rp
      cur.remainingQty    += rem
      cur.orderLines      += 1
      for (const b of row.activeBatchLabels) cur.batches.add(b)
    }
    return Object.entries(byName).map(([itemName, v]) => ({
      itemName,
      inProductionQty: v.inProductionQty,
      remainingQty:    v.remainingQty,
      sum:             v.inProductionQty + v.remainingQty,
      batches:         Array.from(v.batches).sort(),
      orderLines:      v.orderLines,
    }))
  }, [queueData?.rows])

  const filteredSortedNfpList = useMemo(() => {
    const search = nfpSearch.trim().toLowerCase()
    let rows = nfpList.filter((r) => {
      if (search && !r.itemName.toLowerCase().includes(search)) return false
      if (nfpStatusFilter === "in-production-only") return r.inProductionQty > 0 && r.remainingQty === 0
      if (nfpStatusFilter === "remaining-only")     return r.remainingQty > 0 && r.inProductionQty === 0
      if (nfpStatusFilter === "both")               return r.inProductionQty > 0 && r.remainingQty > 0
      return true
    })
    rows = [...rows].sort((a, b) => {
      let cmp = 0
      if (nfpSortKey === "itemName")        cmp = a.itemName.localeCompare(b.itemName, undefined, { sensitivity: "base" })
      else if (nfpSortKey === "inProductionQty") cmp = a.inProductionQty - b.inProductionQty
      else if (nfpSortKey === "remainingQty")    cmp = a.remainingQty - b.remainingQty
      else                                       cmp = a.sum - b.sum
      return nfpSortDir === "asc" ? cmp : -cmp
    })
    return rows
  }, [nfpList, nfpSearch, nfpStatusFilter, nfpSortKey, nfpSortDir])

  const nfpTotals = useMemo(() => ({
    inProduction: filteredSortedNfpList.reduce((s, r) => s + r.inProductionQty, 0),
    remaining:    filteredSortedNfpList.reduce((s, r) => s + r.remainingQty, 0),
    sum:          filteredSortedNfpList.reduce((s, r) => s + r.sum, 0),
  }), [filteredSortedNfpList])

  const handleNfpSort = (key: typeof nfpSortKey) => {
    if (nfpSortKey === key) { setNfpSortDir((d) => d === "asc" ? "desc" : "asc"); return }
    setNfpSortKey(key)
    setNfpSortDir("desc")
  }

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
  }

  const handleUnderProductionItemClick = (itemName: string) => {
    setFilter("pending")
    setQueueItemFilter(itemName)
    setQueueStatusFilter("In Progress")
  }

  const handlePrintUnderProduction = async () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

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
    } catch { /* fall back to text */ }

    const sorted = [...underProductionList]
    const totalQty = sorted.reduce((s, r) => s + r.inProductionQty, 0)
    const totalOrders = sorted.reduce((s, r) => s + r.orderCount, 0)
    const now = new Date()
    const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })

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
           <td class="qty">${a.inProductionQty > 0 ? a.inProductionQty.toLocaleString() : "—"}</td>
           <td class="batch">${escapeHtml(a.batches.join(", ") || "—")}</td>`
        : `<td colspan="4" class="empty"></td>`
      const cellB = b
        ? `<td class="sn">${mid + i + 1}</td>
           <td class="item">${escapeHtml(b.itemName)}</td>
           <td class="qty">${b.inProductionQty > 0 ? b.inProductionQty.toLocaleString() : "—"}</td>
           <td class="batch">${escapeHtml(b.batches.join(", ") || "—")}</td>`
        : `<td colspan="4" class="empty"></td>`
      return `<tr>${cellA}<td class="divider"></td>${cellB}</tr>`
    }).join("")

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Under Production – ${dateStr}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4; margin: 14mm 12mm; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 11px; color: #1e293b; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 2.5px solid #2563eb; margin-bottom: 10px; }
    .brand-logo { height: 36px; width: auto; display: block; }
    .brand-text { font-size: 22px; font-weight: 800; color: #2563eb; letter-spacing: -0.5px; }
    .brand-sub { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-top: 1px; }
    .doc-title { text-align: right; }
    .doc-title h2 { font-size: 15px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 1px; }
    .doc-title p { font-size: 9px; color: #64748b; margin-top: 2px; }
    .meta { display: flex; gap: 0; margin-bottom: 12px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
    .meta-cell { flex: 1; padding: 7px 12px; border-right: 1px solid #e2e8f0; }
    .meta-cell:last-child { border-right: none; }
    .meta-label { font-size: 8.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; }
    .meta-value { font-size: 13px; font-weight: 700; color: #1e293b; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #1e3a8a; color: #fff; }
    thead th { padding: 7px 8px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; }
    th.sn, td.sn { width: 26px; text-align: center; }
    th.item, td.item { text-align: left; padding-left: 10px; }
    th.qty, td.qty { width: 52px; text-align: right; font-weight: 700; color: #2563eb; }
    th.batch, td.batch { width: 80px; text-align: left; padding-left: 8px; font-size: 9.5px; color: #64748b; }
    th.divider, td.divider { width: 10px; background: #f8fafc; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; }
    tbody tr { border-bottom: 1px solid #f1f5f9; }
    tbody tr:nth-child(even) { background: #f0f9ff; }
    td { padding: 6px 8px; font-size: 10.5px; color: #334155; }
    td.sn { color: #94a3b8; font-size: 9.5px; }
    td.qty { font-size: 11px; }
    td.empty { background: #fafafa; }
    .totals-row td { border-top: 2px solid #1e293b; font-weight: 700; font-size: 11px; padding: 8px; background: #f1f5f9; }
    .totals-label { text-align: right; text-transform: uppercase; letter-spacing: 0.5px; font-size: 9.5px; color: #64748b; }
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
      <h2>Under Production</h2>
      <p>Items currently active in production batches — sorted by in-production quantity</p>
    </div>
  </div>
  <div class="meta">
    <div class="meta-cell"><div class="meta-label">Date</div><div class="meta-value">${dateStr}</div></div>
    <div class="meta-cell"><div class="meta-label">Time</div><div class="meta-value">${timeStr}</div></div>
    <div class="meta-cell"><div class="meta-label">Total Items</div><div class="meta-value">${sorted.length}</div></div>
    <div class="meta-cell"><div class="meta-label">Total Order Lines</div><div class="meta-value">${totalOrders.toLocaleString()}</div></div>
    <div class="meta-cell"><div class="meta-label">Total Units In Prod.</div><div class="meta-value">${totalQty.toLocaleString()}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="sn">#</th>
        <th class="item">Item Name</th>
        <th class="qty">In Prod.</th>
        <th class="batch">Active Batch</th>
        <th class="divider"></th>
        <th class="sn">#</th>
        <th class="item">Item Name</th>
        <th class="qty">In Prod.</th>
        <th class="batch">Active Batch</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
      <tr class="totals-row">
        <td colspan="2" class="totals-label">Total units in production</td>
        <td class="qty" style="color:#1e293b">${totalQty.toLocaleString()}</td>
        <td class="batch"></td>
        <td class="divider"></td>
        <td colspan="3" style="background:#f1f5f9"></td>
        <td class="batch"></td>
      </tr>
    </tbody>
  </table>
  <div class="footer">
    <span>Printed: <strong>${dateStr}, ${timeStr}</strong></span>
    <span>Sunkool Production Management · Confidential</span>
    <span>Active items currently being produced</span>
  </div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`)
    printWindow.document.close()
  }

  const handleNfpItemClick = (itemName: string) => {
    setFilter("pending")
    setQueueItemFilter(itemName)
    setQueueStatusFilter("All")
  }

  const handlePrintNfp = async () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    let logoHtml = `<div class="brand-text">SUNKOOL</div>`
    try {
      const res = await fetch('/images/logo.png')
      if (res.ok) {
        const blob = await res.blob()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        logoHtml = `<img src="${dataUrl}" alt="Sunkool" class="brand-logo" />`
      }
    } catch { /* fall back to text */ }

    const rows  = filteredSortedNfpList
    const totalIP  = rows.reduce((s, r) => s + r.inProductionQty, 0)
    const totalRem = rows.reduce((s, r) => s + r.remainingQty, 0)
    const totalSum = rows.reduce((s, r) => s + r.sum, 0)
    const now = new Date()
    const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })

    const tableRows = rows.map((r, i) => {
      const ipPct  = r.sum > 0 ? Math.round((r.inProductionQty / r.sum) * 100) : 0
      const remPct = 100 - ipPct
      const statusLabel = r.inProductionQty > 0 && r.remainingQty > 0
        ? "Mixed" : r.inProductionQty > 0 ? "In Prod." : "Pending"
      const statusColor = r.inProductionQty > 0 && r.remainingQty > 0
        ? "#7c3aed" : r.inProductionQty > 0 ? "#16a34a" : "#dc2626"
      return `<tr>
        <td class="sn">${i + 1}</td>
        <td class="item">
          <div>${escapeHtml(r.itemName)}</div>
          <div class="bar-wrap">
            <div class="bar-ip"  style="width:${ipPct}%"></div>
            <div class="bar-rem" style="width:${remPct}%"></div>
          </div>
        </td>
        <td class="ip">${r.inProductionQty > 0 ? r.inProductionQty.toLocaleString() : "—"}</td>
        <td class="rem">${r.remainingQty > 0 ? r.remainingQty.toLocaleString() : "—"}</td>
        <td class="sum">${r.sum.toLocaleString()}</td>
        <td class="batch">${escapeHtml(r.batches.join(", ") || "—")}</td>
        <td class="status" style="color:${statusColor}">${statusLabel}</td>
      </tr>`
    }).join("")

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>NFP – Need for Production – ${dateStr}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    @page{size:A4;margin:12mm 10mm}
    body{font-family:'Segoe UI',system-ui,sans-serif;font-size:10px;color:#1e293b;background:#fff}
    .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:9px;border-bottom:2.5px solid #7c3aed;margin-bottom:9px}
    .brand-logo{height:34px;width:auto;display:block}
    .brand-text{font-size:20px;font-weight:800;color:#7c3aed;letter-spacing:-0.5px}
    .brand-sub{font-size:8.5px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-top:1px}
    .doc-title{text-align:right}
    .doc-title h2{font-size:14px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:1px}
    .doc-title p{font-size:8.5px;color:#64748b;margin-top:2px}
    .meta{display:flex;gap:0;margin-bottom:10px;border:1px solid #e2e8f0;border-radius:5px;overflow:hidden}
    .meta-cell{flex:1;padding:6px 10px;border-right:1px solid #e2e8f0}
    .meta-cell:last-child{border-right:none}
    .ml{font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8}
    .mv{font-size:12px;font-weight:700;color:#1e293b;margin-top:2px}
    .mv.ip{color:#16a34a}.mv.rem{color:#dc2626}.mv.sum{color:#7c3aed}
    table{width:100%;border-collapse:collapse}
    thead tr{background:#4c1d95;color:#fff}
    thead th{padding:6px 7px;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}
    th.sn,td.sn{width:22px;text-align:center}
    th.item,td.item{text-align:left;padding-left:8px;min-width:140px}
    th.ip,td.ip{width:52px;text-align:right;color:#16a34a;font-weight:700}
    th.rem,td.rem{width:52px;text-align:right;color:#dc2626;font-weight:700}
    th.sum,td.sum{width:52px;text-align:right;color:#7c3aed;font-weight:800}
    th.batch,td.batch{width:70px;text-align:left;padding-left:6px;font-size:8.5px;color:#64748b}
    th.status,td.status{width:46px;text-align:center;font-size:8px;font-weight:700}
    tbody tr{border-bottom:1px solid #f1f5f9}
    tbody tr:nth-child(even){background:#faf5ff}
    td{padding:5px 7px;font-size:9.5px;color:#334155}
    td.sn{color:#94a3b8;font-size:9px}
    .bar-wrap{display:flex;height:3px;border-radius:2px;overflow:hidden;margin-top:3px;background:#f1f5f9}
    .bar-ip{background:#16a34a}
    .bar-rem{background:#dc2626}
    .totals-row td{border-top:2px solid #4c1d95;font-weight:700;font-size:10px;padding:7px;background:#f5f3ff}
    .footer{margin-top:12px;padding-top:7px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:8px;color:#94a3b8}
    .footer strong{color:#64748b}
    .legend{display:flex;gap:12px;font-size:8px;margin-bottom:8px;align-items:center}
    .dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:3px}
  </style>
</head>
<body>
  <div class="header">
    <div>${logoHtml}<div class="brand-sub">Production Management System</div></div>
    <div class="doc-title">
      <h2>NFP — Need for Production</h2>
      <p>In Production + Remaining = Total need per item across all open orders</p>
    </div>
  </div>
  <div class="meta">
    <div class="meta-cell"><div class="ml">Date</div><div class="mv">${dateStr}</div></div>
    <div class="meta-cell"><div class="ml">Time</div><div class="mv">${timeStr}</div></div>
    <div class="meta-cell"><div class="ml">Items</div><div class="mv">${rows.length}</div></div>
    <div class="meta-cell"><div class="ml">In Production</div><div class="mv ip">${totalIP.toLocaleString()}</div></div>
    <div class="meta-cell"><div class="ml">Remaining</div><div class="mv rem">${totalRem.toLocaleString()}</div></div>
    <div class="meta-cell"><div class="ml">Total NFP</div><div class="mv sum">${totalSum.toLocaleString()}</div></div>
  </div>
  <div class="legend">
    <span><span class="dot" style="background:#16a34a"></span>In Production</span>
    <span><span class="dot" style="background:#dc2626"></span>Remaining (not yet started)</span>
    <span><span class="dot" style="background:#7c3aed"></span>NFP Total</span>
    <span style="color:#94a3b8;margin-left:4px">· Mini bar = production progress split per item</span>
  </div>
  <table>
    <thead>
      <tr>
        <th class="sn">#</th>
        <th class="item">Item Name</th>
        <th class="ip">In Prod.</th>
        <th class="rem">Remaining</th>
        <th class="sum">NFP Total</th>
        <th class="batch">Active Batch</th>
        <th class="status">Status</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
      <tr class="totals-row">
        <td></td><td style="text-align:right;font-size:8.5px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Totals</td>
        <td class="ip">${totalIP.toLocaleString()}</td>
        <td class="rem">${totalRem.toLocaleString()}</td>
        <td class="sum">${totalSum.toLocaleString()}</td>
        <td></td><td></td>
      </tr>
    </tbody>
  </table>
  <div class="footer">
    <span>Printed: <strong>${dateStr}, ${timeStr}</strong></span>
    <span>Sunkool Production Management · Confidential</span>
    <span>NFP = Need for Production per item type</span>
  </div>
  <script>window.onload=()=>{window.print()}</script>
</body>
</html>`)
    printWindow.document.close()
  }

  const handleQueueStatusChange = (value: QueueStatusFilter) => {
    setQueueStatusFilter(value)
  }

  const handleClearQueueFilters = () => {
    setQueueSearch("")
    setQueueStatusFilter("All")
    setQueueCustomerFilter("")
    setQueueItemFilter("")
    setKpiFilter("none")
    setShowLinesAwaitingClosure(true)
  }

  const applyKpiFilter = (next: KpiFilter) => {
    setKpiFilter(next)
    setQueueSearch("")
    setQueueCustomerFilter("")
    setQueueItemFilter("")
    setShowLinesAwaitingClosure(true)
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
      <div className="sticky top-[68px] z-20 rounded-2xl border border-slate-200 bg-white shadow-sm">
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
            {
              key: "under-production" as const,
              icon: Factory,
              label: "Under Production",
              count: underProductionList.length,
              tabTitle: undefined as string | undefined,
            },
            {
              key: "nfp" as const,
              icon: Layers,
              label: "NFP",
              count: nfpList.length,
              tabTitle: "Need for Production — In Production + Remaining per item" as string | undefined,
            },
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
      ) : filter === "under-production" ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-[16px] font-semibold text-slate-900">Under Production</h2>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[12px] font-semibold text-blue-600">
                  {underProductionList.length} items
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Items currently active in production batches —{" "}
                <span className="font-medium text-slate-600">
                  {underProductionTotalQty.toLocaleString()} units in production
                </span>{" "}
                across {underProductionList.reduce((s, r) => s + r.orderCount, 0).toLocaleString()} order line{underProductionList.reduce((s, r) => s + r.orderCount, 0) === 1 ? "" : "s"} ·{" "}
                {underProductionList.length} item type{underProductionList.length === 1 ? "" : "s"}
                {neededLastUpdated && <span className="ml-2">· Updated {neededLastUpdated.toLocaleTimeString()}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <button
                type="button"
                onClick={handlePrintUnderProduction}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-600 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
              >
                <Printer className="h-4 w-4" />
                Print list
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            {underProductionList.length === 0 ? (
              <div className="py-16 text-center">
                <Factory className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                <p className="font-medium text-slate-600">Nothing in production</p>
                <p className="mt-1 text-sm text-slate-400">No items currently have active production batches.</p>
              </div>
            ) : (
              (() => {
                const mid = Math.ceil(underProductionList.length / 2)
                const col1 = underProductionList.slice(0, mid)
                const col2 = underProductionList.slice(mid)

                const renderCol = (
                  rows: { itemName: string; inProductionQty: number; batches: string[]; orderCount: number; customers: string[] }[],
                  offset: number
                ) => (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-slate-200 bg-slate-50">
                          <th className="w-8 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">#</th>
                          <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">Item</th>
                          <th className="w-28 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">Batch</th>
                          <th className="w-32 px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">In Prod. Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(({ itemName, inProductionQty, batches, orderCount }, i) => (
                          <tr
                            key={itemName}
                            onClick={() => handleUnderProductionItemClick(itemName)}
                            className={cn(
                              "cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-blue-50/60",
                              i % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                            )}
                          >
                            <td className="px-4 py-3 text-[11px] font-medium text-slate-300">{offset + i + 1}</td>
                            <td className="px-4 py-3">
                              <span className="text-[13px] font-medium text-slate-800">{itemName}</span>
                              {orderCount > 1 && (
                                <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                                  {orderCount} orders
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {batches.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {batches.map((b) => (
                                    <span key={b} className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                                      {b}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={cn(
                                "inline-flex items-center rounded-full px-3 py-1 text-[13px] font-bold",
                                inProductionQty >= 100
                                  ? "bg-blue-100 text-blue-700"
                                  : inProductionQty >= 25
                                    ? "bg-indigo-100 text-indigo-700"
                                    : "bg-slate-100 text-slate-600"
                              )}>
                                {inProductionQty > 0 ? inProductionQty.toLocaleString() : "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
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

          {/* Footer */}
          {underProductionList.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/80 px-5 py-3 print:hidden">
              <p className="text-xs text-slate-400">
                Sorted by in-production quantity · Click an item to open the queue filtered to that SKU
              </p>
              <p className="text-xs font-semibold text-slate-600">
                Total: {underProductionTotalQty.toLocaleString()} units · {underProductionList.reduce((s, r) => s + r.orderCount, 0).toLocaleString()} order line{underProductionList.reduce((s, r) => s + r.orderCount, 0) === 1 ? "" : "s"} · {underProductionList.length} item type{underProductionList.length === 1 ? "" : "s"}
              </p>
            </div>
          )}
        </div>
      ) : filter === "nfp" ? (
        <div className="space-y-4">

          {/* NFP Summary bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-green-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">In Production</p>
              <p className="mt-1.5 text-3xl font-bold text-green-600">{nfpTotals.inProduction.toLocaleString()}</p>
              <p className="mt-1 text-[11px] text-slate-400">units active in batches</p>
            </div>
            <div className="rounded-2xl border border-red-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Remaining</p>
              <p className="mt-1.5 text-3xl font-bold text-red-600">{nfpTotals.remaining.toLocaleString()}</p>
              <p className="mt-1 text-[11px] text-slate-400">units not yet started</p>
            </div>
            <div className="rounded-2xl border border-violet-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">NFP Total</p>
              <p className="mt-1.5 text-3xl font-bold text-violet-600">{nfpTotals.sum.toLocaleString()}</p>
              <p className="mt-1 text-[11px] text-slate-400">total units needed across {filteredSortedNfpList.length} items</p>
            </div>
          </div>

          {/* Master NFP Table */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Header */}
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <Layers className="h-4 w-4 text-violet-500" />
                  <h2 className="text-[16px] font-semibold text-slate-900">Need for Production</h2>
                  <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[12px] font-semibold text-violet-600">
                    {filteredSortedNfpList.length} items
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  Per-item total production need —{" "}
                  <span className="font-semibold text-green-600">{nfpTotals.inProduction.toLocaleString()} in production</span>
                  {" "}+{" "}
                  <span className="font-semibold text-red-500">{nfpTotals.remaining.toLocaleString()} remaining</span>
                  {" "}={" "}
                  <span className="font-semibold text-violet-600">{nfpTotals.sum.toLocaleString()} NFP total</span>
                  {neededLastUpdated && <span className="ml-2 text-slate-300">· {neededLastUpdated.toLocaleTimeString()}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={handlePrintNfp}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-600 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600"
                >
                  <Printer className="h-4 w-4" />
                  Print NFP
                </button>
              </div>
            </div>

            {/* Toolbar: search + filter chips */}
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={nfpSearch}
                  onChange={(e) => setNfpSearch(e.target.value)}
                  placeholder="Search item…"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-[3px] focus:ring-violet-400/15"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { key: "all",                label: "All",          color: "slate"  },
                  { key: "both",               label: "Mixed",        color: "violet" },
                  { key: "in-production-only", label: "In Prod. only",color: "green"  },
                  { key: "remaining-only",     label: "Remaining only",color: "red"   },
                ] as const).map(({ key, label, color }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setNfpStatusFilter(key)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
                      nfpStatusFilter === key
                        ? color === "slate"  ? "border-slate-400  bg-slate-200  text-slate-800"
                        : color === "violet" ? "border-violet-400 bg-violet-100 text-violet-700"
                        : color === "green"  ? "border-green-400  bg-green-100  text-green-700"
                        :                     "border-red-400    bg-red-100    text-red-700"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            {filteredSortedNfpList.length === 0 ? (
              <div className="py-16 text-center">
                <Layers className="mx-auto mb-3 h-12 w-12 text-slate-200" />
                <p className="font-medium text-slate-500">No items match your filters</p>
                <p className="mt-1 text-sm text-slate-400">All production is fully caught up.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left">
                      <th className="w-10 px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">#</th>
                      <th className="px-4 py-3">
                        <button type="button" onClick={() => handleNfpSort("itemName")} className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 hover:text-slate-700">
                          Item {nfpSortKey === "itemName" ? (nfpSortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                        </button>
                      </th>
                      <th className="w-36 px-4 py-3">
                        <button type="button" onClick={() => handleNfpSort("inProductionQty")} className="inline-flex w-full items-center justify-end gap-1 text-[10px] font-semibold uppercase tracking-widest text-green-500 hover:text-green-700">
                          In Production {nfpSortKey === "inProductionQty" ? (nfpSortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                        </button>
                      </th>
                      <th className="w-36 px-4 py-3">
                        <button type="button" onClick={() => handleNfpSort("remainingQty")} className="inline-flex w-full items-center justify-end gap-1 text-[10px] font-semibold uppercase tracking-widest text-red-400 hover:text-red-600">
                          Remaining {nfpSortKey === "remainingQty" ? (nfpSortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                        </button>
                      </th>
                      <th className="w-36 px-4 py-3">
                        <button type="button" onClick={() => handleNfpSort("sum")} className="inline-flex w-full items-center justify-end gap-1 text-[10px] font-semibold uppercase tracking-widest text-violet-500 hover:text-violet-700">
                          NFP Total {nfpSortKey === "sum" ? (nfpSortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                        </button>
                      </th>
                      <th className="w-36 px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Active Batch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSortedNfpList.map((row, i) => {
                      const ipPct  = row.sum > 0 ? (row.inProductionQty / row.sum) * 100 : 0
                      const remPct = row.sum > 0 ? (row.remainingQty    / row.sum) * 100 : 0
                      const isInProdOnly  = row.inProductionQty > 0 && row.remainingQty === 0
                      const isRemOnly     = row.remainingQty > 0 && row.inProductionQty === 0
                      const isMixed       = row.inProductionQty > 0 && row.remainingQty > 0
                      return (
                        <tr
                          key={row.itemName}
                          onClick={() => handleNfpItemClick(row.itemName)}
                          className={cn(
                            "cursor-pointer border-b border-slate-100 transition-colors last:border-0",
                            i % 2 === 0 ? "bg-white hover:bg-violet-50/40" : "bg-slate-50/40 hover:bg-violet-50/60"
                          )}
                        >
                          <td className="px-4 py-3 text-[11px] font-medium text-slate-300">{i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="text-[13px] font-medium text-slate-800">{row.itemName}</p>
                                {/* Progress bar: green = in production, red = remaining */}
                                <div className="mt-1.5 flex h-[5px] w-40 overflow-hidden rounded-full bg-slate-100">
                                  {ipPct > 0 && <div className="h-full rounded-l-full bg-green-500 transition-all" style={{ width: `${ipPct}%` }} />}
                                  {remPct > 0 && <div className="h-full rounded-r-full bg-red-400 transition-all" style={{ width: `${remPct}%` }} />}
                                </div>
                              </div>
                              <div className="ml-1">
                                {isInProdOnly && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">In Prod. only</span>}
                                {isRemOnly    && <span className="rounded-full bg-red-100   px-2 py-0.5 text-[10px] font-semibold text-red-700">Pending</span>}
                                {isMixed      && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">Mixed</span>}
                              </div>
                            </div>
                            <p className="mt-0.5 text-[10px] text-slate-400">{row.orderLines} order line{row.orderLines === 1 ? "" : "s"}</p>
                          </td>
                          {/* In Production */}
                          <td className="px-4 py-3 text-right">
                            {row.inProductionQty > 0 ? (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-[13px] font-bold text-green-700">
                                {row.inProductionQty.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-[12px] text-slate-300">—</span>
                            )}
                          </td>
                          {/* Remaining */}
                          <td className="px-4 py-3 text-right">
                            {row.remainingQty > 0 ? (
                              <span className={cn(
                                "inline-flex items-center rounded-full px-3 py-1 text-[13px] font-bold",
                                row.remainingQty >= 100 ? "bg-red-100 text-red-700" : row.remainingQty >= 25 ? "bg-amber-100 text-amber-700" : "bg-orange-100 text-orange-700"
                              )}>
                                {row.remainingQty.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-[12px] text-slate-300">—</span>
                            )}
                          </td>
                          {/* NFP Total */}
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center rounded-full bg-violet-100 px-3 py-1 text-[14px] font-extrabold text-violet-700">
                              {row.sum.toLocaleString()}
                            </span>
                          </td>
                          {/* Active Batch */}
                          <td className="px-4 py-3">
                            {row.batches.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {row.batches.map((b) => (
                                  <span key={b} className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">{b}</span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {/* Totals footer row */}
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td colSpan={2} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Totals — {filteredSortedNfpList.length} item type{filteredSortedNfpList.length === 1 ? "" : "s"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[13px] font-bold text-green-700">{nfpTotals.inProduction.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[13px] font-bold text-red-600">{nfpTotals.remaining.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[14px] font-extrabold text-violet-700">{nfpTotals.sum.toLocaleString()}</span>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Footer hint */}
            {filteredSortedNfpList.length > 0 && (
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-5 py-3 print:hidden">
                <p className="text-xs text-slate-400">
                  Click any row to open Production Queue filtered to that item ·{" "}
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-4 rounded-sm bg-green-400"></span> In Production
                  </span>
                  {" "}<span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-4 rounded-sm bg-red-400"></span> Remaining
                  </span>
                </p>
                <p className="text-xs font-semibold text-violet-600">
                  NFP = {nfpTotals.sum.toLocaleString()} units total
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}
      <OrderJourneySheet open={journeyOpen} onOpenChange={setJourneyOpen} row={selectedRow} />
    </div>
  )
}

