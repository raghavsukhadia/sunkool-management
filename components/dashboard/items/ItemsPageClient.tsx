"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Download, RefreshCw, Search, X } from "lucide-react"
import {
  getItemsForExport,
  type ItemsListQuery,
  type ItemsListResult,
  type ItemsListSortKey,
} from "@/app/actions/items"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ItemsResultsGrid } from "./ItemsResultsGrid"
import { ItemsStatsStrip } from "./ItemsStatsStrip"
import { formatCurrency, formatDate } from "./items-utils"

const SORT_OPTIONS: Array<{ key: ItemsListSortKey; label: string }> = [
  { key: "last_ordered_at", label: "Last ordered" },
  { key: "item_name", label: "Item name" },
  { key: "total_orders", label: "Orders" },
  { key: "total_quantity", label: "Quantity" },
  { key: "total_value", label: "Value" },
  { key: "total_remaining", label: "Remaining" },
]

function toQueryValue(value?: string | null) {
  return value && value !== "all" ? value : ""
}

export function ItemsPageClient({
  initialQuery,
  initialData,
}: {
  initialQuery: ItemsListQuery
  initialData: ItemsListResult
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [searchInput, setSearchInput] = useState(initialQuery.search ?? "")
  const [isExporting, setIsExporting] = useState(false)

  const page = initialData.page
  const pageSize = initialData.page_size
  const sortKey = (initialQuery.sort_key ?? "last_ordered_at") as ItemsListSortKey
  const sortDir = (initialQuery.sort_dir ?? "desc") as "asc" | "desc"
  const customerId = initialQuery.customer_id ?? "all"
  const category = initialQuery.category ?? "all"
  const dispatchStatus = initialQuery.dispatch_status ?? "all"

  useEffect(() => {
    setSearchInput(initialQuery.search ?? "")
  }, [initialQuery.search])

  const updateUrl = (updates: Record<string, string | number | null | undefined>) => {
    const params = new URLSearchParams()

    const merged: Record<string, string> = {
      page: String(initialQuery.page ?? 1),
      page_size: String(initialQuery.page_size ?? 25),
      sort_key: sortKey,
      sort_dir: sortDir,
      search: initialQuery.search ?? "",
      customer_id: initialQuery.customer_id ?? "",
      category: initialQuery.category ?? "",
      dispatch_status: initialQuery.dispatch_status ?? "all",
    }

    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined) merged[key] = ""
      else merged[key] = String(value)
    }

    Object.entries(merged).forEach(([key, value]) => {
      if (!value || value === "all") return
      if (key === "page" && value === "1") return
      if (key === "page_size" && value === "25") return
      if (key === "sort_key" && value === "last_ordered_at") return
      if (key === "sort_dir" && value === "desc") return
      params.set(key, value)
    })

    const queryString = params.toString()
    startTransition(() => {
      router.push(queryString ? `${pathname}?${queryString}` : pathname)
    })
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      if ((initialQuery.search ?? "") !== searchInput) {
        updateUrl({ search: searchInput.trim() || null, page: 1 })
      }
    }, 350)
    return () => clearTimeout(timeout)
  }, [searchInput, initialQuery.search]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeFilterCount = [customerId !== "all", category !== "all", dispatchStatus !== "all", !!(initialQuery.search ?? "").trim()].filter(Boolean).length

  const summaryValue = useMemo(
    () => initialData.rows.reduce((sum, row) => sum + row.total_value, 0),
    [initialData.rows]
  )

  async function handleExport() {
    try {
      setIsExporting(true)
      const result = await getItemsForExport({
        search: initialQuery.search ?? "",
        customer_id: toQueryValue(customerId),
        category: toQueryValue(category),
        dispatch_status: dispatchStatus,
        sort_key: sortKey,
        sort_dir: sortDir,
      })
      if (!result.success || !result.data) return

      const rows = [
        ["Item", "SKU", "Category", "Total Orders", "Total Qty", "Dispatched", "Remaining", "Customers", "Total Value", "Last Ordered"],
        ...result.data.map((row) => [
          row.item_name,
          row.item_sku ?? "",
          row.item_category ?? "",
          String(row.total_orders),
          String(row.total_quantity),
          String(row.total_dispatched),
          String(row.total_remaining),
          row.customers.join("; "),
          String(row.total_value),
          formatDate(row.last_ordered_at),
        ]),
      ]
      const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, "\"\"")}"`).join(",")).join("\n")
      const anchor = document.createElement("a")
      anchor.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
      anchor.download = `items-${new Date().toISOString().slice(0, 10)}.csv`
      anchor.click()
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <section className="space-y-6">
      <ItemsStatsStrip stats={initialData.stats} />

      <div className="rounded-2xl border border-sk-border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sk-text-3" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by item, SKU, customer or order #"
              className="h-10 pl-9 pr-8 text-sm"
            />
            {searchInput ? (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-sk-text-3 transition-colors hover:text-sk-text-1"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-4">
            <Select
              value={dispatchStatus}
              onValueChange={(value) => updateUrl({ dispatch_status: value, page: 1 })}
            >
              <SelectTrigger className="h-10 bg-white text-sm">
                <SelectValue placeholder="Dispatch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All dispatch states</SelectItem>
                <SelectItem value="not_dispatched">Pending</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="fully_dispatched">Fully dispatched</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={customerId || "all"}
              onValueChange={(value) => updateUrl({ customer_id: value === "all" ? null : value, page: 1 })}
            >
              <SelectTrigger className="h-10 bg-white text-sm">
                <SelectValue placeholder="Customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All customers</SelectItem>
                {initialData.facets.customers.map((customer) => (
                  <SelectItem key={customer.value} value={customer.value}>
                    {customer.label} ({customer.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={category || "all"}
              onValueChange={(value) => updateUrl({ category: value === "all" ? null : value, page: 1 })}
            >
              <SelectTrigger className="h-10 bg-white text-sm">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {initialData.facets.categories.map((itemCategory) => (
                  <SelectItem key={itemCategory.value} value={itemCategory.value}>
                    {itemCategory.label} ({itemCategory.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={`${sortKey}:${sortDir}`}
              onValueChange={(value) => {
                const [nextSortKey, nextSortDir] = value.split(":")
                updateUrl({
                  sort_key: nextSortKey,
                  sort_dir: nextSortDir,
                  page: 1,
                })
              }}
            >
              <SelectTrigger className="h-10 bg-white text-sm">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.flatMap((option) => [
                  <SelectItem key={`${option.key}:desc`} value={`${option.key}:desc`}>
                    {option.label} (high to low)
                  </SelectItem>,
                  <SelectItem key={`${option.key}:asc`} value={`${option.key}:asc`}>
                    {option.label} (low to high)
                  </SelectItem>,
                ])}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-sk-border pt-4">
          <div className="text-xs text-sk-text-3">
            <span className="font-semibold text-sk-text-1">{initialData.total_rows}</span> results
            {" · "}
            <span className="font-semibold text-sk-text-1">{formatCurrency(summaryValue)}</span> on this page
            {activeFilterCount > 0 ? ` · ${activeFilterCount} active filters` : ""}
          </div>

          <div className="flex items-center gap-2">
            {activeFilterCount > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="h-9 text-xs"
                onClick={() =>
                  updateUrl({
                    page: 1,
                    search: null,
                    customer_id: null,
                    category: null,
                    dispatch_status: null,
                  })
                }
              >
                Clear filters
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-3 text-xs"
              onClick={() => router.refresh()}
              disabled={isPending}
            >
              <RefreshCw className={cn("mr-1 h-3.5 w-3.5", isPending && "animate-spin")} />
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 px-3 text-xs"
              onClick={handleExport}
              disabled={isExporting || initialData.total_rows === 0}
            >
              <Download className={cn("mr-1 h-3.5 w-3.5", isExporting && "animate-spin")} />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      <ItemsResultsGrid
        rows={initialData.rows}
        sortKey={sortKey}
        sortDir={sortDir}
        isLoading={isPending}
        onSort={(nextSortKey) => {
          const nextDir = sortKey === nextSortKey && sortDir === "desc" ? "asc" : "desc"
          updateUrl({ sort_key: nextSortKey, sort_dir: nextDir, page: 1 })
        }}
        onView={(itemKey) => router.push(`/dashboard/items/${itemKey}`)}
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-sk-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-sk-text-3">
          Page <span className="font-semibold text-sk-text-1">{page}</span> of{" "}
          <span className="font-semibold text-sk-text-1">{initialData.total_pages}</span>
        </p>
        <div className="flex items-center gap-2">
          <Select
            value={String(pageSize)}
            onValueChange={(value) => updateUrl({ page_size: Number(value), page: 1 })}
          >
            <SelectTrigger className="h-9 w-[140px] text-xs">
              <SelectValue placeholder="Page size" />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            className="h-9 px-3 text-xs"
            disabled={page <= 1 || isPending}
            onClick={() => updateUrl({ page: page - 1 })}
          >
            Previous
          </Button>
          <Button
            type="button"
            className="h-9 bg-sk-primary px-3 text-xs text-white hover:bg-sk-primary-dk"
            disabled={page >= initialData.total_pages || isPending}
            onClick={() => updateUrl({ page: page + 1 })}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  )
}
