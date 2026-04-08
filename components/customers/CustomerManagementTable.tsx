"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useVirtualizer } from "@tanstack/react-virtual"
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Columns3, Filter, Plus, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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
  CustomerPreset,
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
  STATUS_FILTERS,
  toCsv,
} from "@/components/customers/utils"
import { CUSTOMER_STATUS_CLASS } from "@/components/customers/statusStyles"

interface Props {
  enableVirtualization?: boolean
  virtualizationThreshold?: number
}

const STORAGE_KEY = "customer-table-custom-presets"

const COLUMN_ORDER: ColumnKey[] = [
  "name",
  "phone",
  "email",
  "totalOrders",
  "totalValue",
  "unpaidAmount",
  "lastOrderDate",
  "status",
]

const DEFAULT_COLUMNS: Record<ColumnKey, boolean> = {
  name: true,
  phone: true,
  email: true,
  totalOrders: true,
  totalValue: true,
  unpaidAmount: true,
  lastOrderDate: true,
  status: true,
}

function readCustomPresets(): CustomerPreset[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CustomerPreset[]
    return parsed.filter(p => p.kind === "custom")
  } catch {
    return []
  }
}

function writeCustomPresets(items: CustomerPreset[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function SortHeader({
  label,
  column,
  primary,
  onClick,
}: {
  label: string
  column: SortKey
  primary: SortRule
  onClick: (column: SortKey) => void
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
  const [customPresets, setCustomPresets] = useState<CustomerPreset[]>([])

  useEffect(() => {
    const presets = readCustomPresets()
    setCustomPresets(presets)
  }, [])

  useEffect(() => {
    let ignore = false

    async function load() {
      setLoading(true)
      setError(null)

      const result = await getCustomersWithStats()
      if (ignore) return

      if (result.success && result.data) {
        const liveRows = buildCustomerRowsFromLive(result.data as CustomerWithStats[])
        setRows(liveRows)
      } else {
        // Fallback to mock data for preview/demo resilience.
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

  const filteredRows = useMemo(() => applyFilters(rows, search, status, advanced), [rows, search, status, advanced])

  const sortedRows = useMemo(
    () => applyMultiSort(filteredRows, sortPrimary, sortSecondary),
    [filteredRows, sortPrimary, sortSecondary]
  )

  const selectedRows = useMemo(() => sortedRows.filter(row => selectedIds.has(row.id)), [sortedRows, selectedIds])

  const allVisibleSelected = sortedRows.length > 0 && sortedRows.every(row => selectedIds.has(row.id))

  const kpis = useMemo(() => {
    const totalCustomers = rows.length
    const activeThisMonth = rows.filter(row => {
      if (!row.lastOrderDate) return false
      return Date.now() - new Date(row.lastOrderDate).getTime() <= 30 * 86400000
    }).length
    const unpaidAccounts = rows.filter(row => row.unpaidAmount > 0).length
    const totalValue = rows.reduce((sum, row) => sum + row.totalValue, 0)
    return { totalCustomers, activeThisMonth, unpaidAccounts, totalValue }
  }, [rows])

  const activeFilterTags = useMemo(() => getActiveFilterTags(search, status, advanced), [search, status, advanced])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: filteredRows.length }
    for (const row of rows) {
      counts[row.status] = (counts[row.status] ?? 0) + 1
    }
    return counts
  }, [rows, filteredRows.length])

  const parentRef = useRef<HTMLDivElement | null>(null)
  const shouldVirtualize = enableVirtualization && sortedRows.length >= virtualizationThreshold

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? sortedRows.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 54,
    overscan: 8,
  })

  const virtualItems = shouldVirtualize ? rowVirtualizer.getVirtualItems() : []

  const handleHeaderSort = (column: SortKey) => {
    setSortPrimary(prev => {
      if (prev.key === column) {
        return { ...prev, direction: prev.direction === "asc" ? "desc" : "asc" }
      }
      setSortSecondary(prevSecondary => (prevSecondary.key === column ? DEFAULT_SECONDARY_SORT : prev))
      return { key: column, direction: "desc" }
    })
  }

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      const next = new Set(selectedIds)
      sortedRows.forEach(row => next.delete(row.id))
      setSelectedIds(next)
      return
    }

    const next = new Set(selectedIds)
    sortedRows.forEach(row => next.add(row.id))
    setSelectedIds(next)
  }

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const removeFilterTag = (tag: string) => {
    if (tag.startsWith("Search:")) setSearch("")
    if (tag.startsWith("Status:")) setStatus("all")
    if (tag.startsWith("Last order from:")) setAdvanced(prev => ({ ...prev, lastOrderFrom: "" }))
    if (tag.startsWith("Last order to:")) setAdvanced(prev => ({ ...prev, lastOrderTo: "" }))
    if (tag === "Has unpaid" || tag === "No unpaid") setAdvanced(prev => ({ ...prev, unpaidMode: "all" }))
    if (tag.startsWith("Min orders:")) setAdvanced(prev => ({ ...prev, minOrders: "" }))
    if (tag.startsWith("Min value:")) setAdvanced(prev => ({ ...prev, minValue: "" }))
    if (tag.startsWith("Max value:")) setAdvanced(prev => ({ ...prev, maxValue: "" }))
    if (tag.startsWith("Phone prefix:")) setAdvanced(prev => ({ ...prev, phonePrefix: "" }))
    if (tag === "Has email" || tag === "No email") setAdvanced(prev => ({ ...prev, hasEmail: "all" }))
    setActivePresetId(null)
  }

  const handleExportCsv = () => {
    const csv = toCsv(selectedRows)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `customers-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleAddTag = () => {
    const tag = window.prompt("Add tag to selected customers:")
    if (!tag || !tag.trim()) return
    const cleanTag = tag.trim()
    setRows(prev =>
      prev.map(row => {
        if (!selectedIds.has(row.id)) return row
        if (row.extraTags.includes(cleanTag)) return row
        return { ...row, extraTags: [...row.extraTags, cleanTag] }
      })
    )
  }

  const handleDeleteSelected = () => {
    const toDelete = rows.filter(row => selectedIds.has(row.id))
    if (toDelete.length === 0) return
    setLastDeleted(toDelete)
    setRows(prev => prev.filter(row => !selectedIds.has(row.id)))
    setSelectedIds(new Set())
    setConfirmDeleteOpen(false)
    setToastOpen(true)

    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      setToastOpen(false)
      setLastDeleted([])
    }, 7000)
  }

  const undoDelete = () => {
    if (lastDeleted.length === 0) return
    setRows(prev => [...lastDeleted, ...prev])
    setLastDeleted([])
    setToastOpen(false)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="overflow-hidden border-sk-border bg-sk-card-bg shadow-none">
          <div className="h-1 bg-sk-primary" />
          <CardContent className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-sk-text-3">Total Customers</p>
            <p className="mt-1 text-2xl font-bold text-sk-text-1">{kpis.totalCustomers}</p>
            <p className="mt-0.5 text-xs text-sk-text-3">{kpis.activeThisMonth} active this month</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-sk-border bg-sk-card-bg shadow-none">
          <div className="h-1 bg-blue-500" />
          <CardContent className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-sk-text-3">Total Value</p>
            <p className="mt-1 text-2xl font-bold text-sk-text-1">{formatCurrency(kpis.totalValue)}</p>
            <p className="mt-0.5 text-xs text-sk-text-3">lifetime revenue</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-sk-border bg-sk-card-bg shadow-none">
          <div className={`h-1 ${kpis.unpaidAccounts > 0 ? "bg-red-500" : "bg-emerald-500"}`} />
          <CardContent className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-sk-text-3">Unpaid Accounts</p>
            <p className={`mt-1 text-2xl font-bold ${kpis.unpaidAccounts > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {kpis.unpaidAccounts}
            </p>
            <p className="mt-0.5 text-xs text-sk-text-3">{kpis.unpaidAccounts > 0 ? "pending collection" : "all accounts clear"}</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-sk-border bg-sk-card-bg shadow-none">
          <div className="h-1 bg-violet-500" />
          <CardContent className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-sk-text-3">Avg Order Value</p>
            <p className="mt-1 text-2xl font-bold text-sk-text-1">
              {kpis.totalCustomers > 0 ? formatCurrency(kpis.totalValue / kpis.totalCustomers) : "—"}
            </p>
            <p className="mt-0.5 text-xs text-sk-text-3">per customer</p>
          </CardContent>
        </Card>
      </div>

      <div className="sticky top-16 z-20 space-y-3 rounded-xl border border-sk-border bg-sk-card-bg p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[250px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sk-text-3" />
            <Input
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                setActivePresetId(null)
              }}
              placeholder="Search by name, phone, or email"
              className="pl-9"
            />
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
            onClick={() => router.push("/dashboard/management/customers")}
            className="bg-sk-primary text-white hover:bg-sk-primary-dk"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Customer
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map(item => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={status === item ? "default" : "outline"}
              className={status === item ? "bg-sk-primary hover:bg-sk-primary-dk" : ""}
              onClick={() => {
                setStatus(item)
                setActivePresetId(null)
              }}
            >
              {item === "all" ? "All" : item}
              {statusCounts[item] !== undefined && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${status === item ? "bg-white/20 text-white" : "bg-sk-page-bg text-sk-text-2"}`}>
                  {statusCounts[item]}
                </span>
              )}
            </Button>
          ))}
        </div>

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

      {advancedOpen && (
        <AdvancedFiltersPanel
          value={advanced}
          onChange={next => {
            setAdvanced(next)
            setActivePresetId(null)
          }}
          onReset={() => {
            setAdvanced(DEFAULT_ADVANCED_FILTERS)
            setActivePresetId(null)
          }}
        />
      )}

      <BulkActionsBar
        selectedCount={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        onExport={handleExportCsv}
        onAddTag={handleAddTag}
        onDelete={() => setConfirmDeleteOpen(true)}
      />

      {loading ? (
        <LoadingSkeleton />
      ) : sortedRows.length === 0 ? (
        <EmptyState text={rows.length === 0 ? "No customer data available." : "No customers match your filters."} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-sk-border bg-sk-card-bg">
          <div className="[overflow-x:clip]" ref={parentRef} style={{ maxHeight: shouldVirtualize ? 620 : undefined }}>
            <table className="w-full min-w-[980px] text-sm">
              <thead className="sticky top-[68px] z-10 bg-sk-page-bg">
                <tr className="border-b border-sk-border">
                  <th className="w-10 px-3 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  {columns.name && (
                    <th className="px-4 py-3 text-left">
                      <SortHeader label="Name" column="name" primary={sortPrimary} onClick={handleHeaderSort} />
                    </th>
                  )}
                  {columns.phone && (
                    <th className="px-4 py-3 text-left">
                      <SortHeader label="Phone" column="phone" primary={sortPrimary} onClick={handleHeaderSort} />
                    </th>
                  )}
                  {columns.email && (
                    <th className="px-4 py-3 text-left">
                      <SortHeader label="Email" column="email" primary={sortPrimary} onClick={handleHeaderSort} />
                    </th>
                  )}
                  {columns.totalOrders && (
                    <th className="px-4 py-3 text-left">
                      <SortHeader label="Total Orders" column="totalOrders" primary={sortPrimary} onClick={handleHeaderSort} />
                    </th>
                  )}
                  {columns.totalValue && (
                    <th className="px-4 py-3 text-left">
                      <SortHeader label="Total Value" column="totalValue" primary={sortPrimary} onClick={handleHeaderSort} />
                    </th>
                  )}
                  {columns.unpaidAmount && (
                    <th className="px-4 py-3 text-left">
                      <SortHeader label="Unpaid Amount" column="unpaidAmount" primary={sortPrimary} onClick={handleHeaderSort} />
                    </th>
                  )}
                  {columns.lastOrderDate && (
                    <th className="px-4 py-3 text-left">
                      <SortHeader label="Last Order Date" column="lastOrderDate" primary={sortPrimary} onClick={handleHeaderSort} />
                    </th>
                  )}
                  {columns.status && <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">Status</th>}
                </tr>
              </thead>

              <tbody className="divide-y divide-sk-border">
                {shouldVirtualize ? (
                  <>
                    {virtualItems.length > 0 && virtualItems[0].start > 0 ? (
                      <tr>
                        <td colSpan={9} style={{ height: virtualItems[0].start }} />
                      </tr>
                    ) : null}

                    {virtualItems.map(virtualItem => {
                      const row = sortedRows[virtualItem.index]
                      const initials = row.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
                      return (
                        <tr
                          key={row.id}
                          className="cursor-pointer transition-colors hover:bg-sk-primary-tint"
                          onClick={() => router.push(`/dashboard/customers/${row.id}`)}
                        >
                          <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(row.id)}
                              onChange={() => toggleSelectOne(row.id)}
                              aria-label={`Select ${row.name}`}
                            />
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
                                        <span
                                          key={tag}
                                          className="rounded-full border border-sk-primary/20 bg-sk-primary-tint px-2 py-0.5 text-[10px] font-medium text-sk-primary-dk"
                                        >
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
                          {columns.email && <td className="px-4 py-3 text-sk-text-2">{row.email ?? "-"}</td>}
                          {columns.totalOrders && <td className="px-4 py-3 text-sk-text-2">{row.totalOrders}</td>}
                          {columns.totalValue && <td className="px-4 py-3 text-sk-text-1">{formatCurrency(row.totalValue)}</td>}
                          {columns.unpaidAmount && <td className="px-4 py-3 text-red-600">{formatCurrency(row.unpaidAmount)}</td>}
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
                    })}

                    {virtualItems.length > 0 && virtualItems[virtualItems.length - 1].end < rowVirtualizer.getTotalSize() ? (
                      <tr>
                        <td colSpan={9} style={{ height: rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end }} />
                      </tr>
                    ) : null}
                  </>
                ) : (
                  sortedRows.map(row => {
                    const initials = row.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
                    return (
                    <tr
                      key={row.id}
                      className="cursor-pointer transition-colors hover:bg-sk-primary-tint"
                      onClick={() => router.push(`/dashboard/customers/${row.id}`)}
                    >
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleSelectOne(row.id)}
                          aria-label={`Select ${row.name}`}
                        />
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
                                    <span
                                      key={tag}
                                      className="rounded-full border border-sk-primary/20 bg-sk-primary-tint px-2 py-0.5 text-[10px] font-medium text-sk-primary-dk"
                                    >
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
                      {columns.email && <td className="px-4 py-3 text-sk-text-2">{row.email ?? "-"}</td>}
                      {columns.totalOrders && <td className="px-4 py-3 text-sk-text-2">{row.totalOrders}</td>}
                      {columns.totalValue && <td className="px-4 py-3 text-sk-text-1">{formatCurrency(row.totalValue)}</td>}
                      {columns.unpaidAmount && <td className="px-4 py-3 text-red-600">{formatCurrency(row.unpaidAmount)}</td>}
                      {columns.lastOrderDate && <td className="px-4 py-3 text-sk-text-2">{formatDate(row.lastOrderDate)}</td>}
                      {columns.status && (
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${CUSTOMER_STATUS_CLASS[row.status]}`}>
                            {row.status}
                          </span>
                        </td>
                      )}
                    </tr>
                  )})
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
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete selected customers?</DialogTitle>
            <DialogDescription>
              This removes selected rows from the table. You can undo this action for a short time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button>
            <Button className="bg-red-600 text-white hover:bg-red-700" onClick={handleDeleteSelected}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
