"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, CalendarDays, Factory, Package2 } from "lucide-react"
import {
  getOrderJourneyData,
  type OrderJourneyData,
  type JourneyStockData,
  type ProductionQueueRow,
} from "@/app/actions/production"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface OrderJourneySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: ProductionQueueRow | null
}

function formatStatusLabel(value: string | null | undefined) {
  if (!value) return "Unknown"
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function getStatusClass(status: string | null | undefined) {
  const normalized = (status || "").toLowerCase()
  if (normalized.includes("complete") || normalized.includes("deliver")) {
    return "bg-green-100 text-green-800"
  }
  if (normalized.includes("progress") || normalized.includes("production")) {
    return "bg-orange-100 text-orange-700"
  }
  if (normalized.includes("partial") || normalized.includes("pending")) {
    return "bg-amber-100 text-amber-800"
  }
  return "bg-slate-100 text-slate-700"
}

function renderStockStatusClass(status: JourneyStockData["status"]) {
  if (status === "low") return "bg-red-100 text-red-700"
  if (status === "excess") return "bg-slate-200 text-slate-700"
  if (status === "no_demand") return "bg-slate-100 text-slate-600"
  return "bg-green-100 text-green-800"
}

export function OrderJourneySheet({ open, onOpenChange, row }: OrderJourneySheetProps) {
  const [journeyData, setJourneyData] = useState<OrderJourneyData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !row) return

    let cancelled = false

    const loadJourney = async () => {
      setLoading(true)
      setError(null)

      const result = await getOrderJourneyData(row.orderId, row.inventoryItemId)
      if (cancelled) return

      if (result.success) {
        setJourneyData(result.data)
      } else {
        setJourneyData(null)
        setError(result.error)
      }

      setLoading(false)
    }

    loadJourney()

    return () => {
      cancelled = true
    }
  }, [open, row])

  const ordered = row?.ordered ?? 0
  const produced = row?.produced ?? 0
  const remaining = row?.remaining ?? 0
  const progressPercent = ordered > 0 ? Math.min(100, Math.round((produced / ordered) * 100)) : 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-l border-slate-200 bg-white px-0 shadow-2xl sm:max-w-xl">
        {!row ? null : (
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-slate-200 bg-slate-50/60 px-6 pb-5 pr-12 pt-6">
              <SheetTitle className="text-xl font-semibold text-slate-900">
                {row.orderNumber} - {row.customerName}
              </SheetTitle>
              <SheetDescription className="text-sm text-slate-500">
                Unified product journey for {row.itemName}
              </SheetDescription>
              <div className="pt-3">
                <Link
                  href={`/dashboard/orders/${row.orderId}`}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Open full order
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-5 px-6 py-6">
              <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-400">Selected item</p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">{row.itemName}</h3>
                    <p className="mt-1 text-sm text-slate-500">{produced} of {ordered} units produced</p>
                  </div>
                  <Badge className="bg-white text-slate-700 border-slate-200">Remaining: {remaining}</Badge>
                </div>
                <div className="mt-4">
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        progressPercent >= 100 ? "bg-green-500" : "bg-orange-500"
                      )}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{progressPercent}% complete</span>
                    <span className="text-slate-500">Ordered {ordered}</span>
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Package2 className="h-4 w-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-900">Order details</h3>
                </div>
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : error ? (
                  <p className="text-sm text-red-600">{error}</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Order status</p>
                      <Badge className={cn("mt-3 border-0", getStatusClass(journeyData?.orderStatus))}>
                        {formatStatusLabel(journeyData?.orderStatus)}
                      </Badge>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Payment</p>
                      <Badge className={cn("mt-3 border-0", getStatusClass(journeyData?.paymentStatus))}>
                        {formatStatusLabel(journeyData?.paymentStatus)}
                      </Badge>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Created</p>
                      <div className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        {journeyData?.createdAt ? new Date(journeyData.createdAt).toLocaleDateString() : "Unknown"}
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Factory className="h-4 w-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-900">Production records</h3>
                </div>
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : !journeyData?.productionRecords.length ? (
                  <p className="text-sm text-slate-500">No production records found for this order yet.</p>
                ) : (
                  <div className="space-y-3">
                    {journeyData.productionRecords.map((record) => (
                      <div key={record.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{record.productionNumber}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.08em] text-slate-400">
                              {formatStatusLabel(record.productionType)}
                            </p>
                          </div>
                          <Badge className={cn("border-0", getStatusClass(record.status))}>
                            {formatStatusLabel(record.status)}
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm text-slate-500">
                          {record.createdAt ? new Date(record.createdAt).toLocaleString() : "Unknown timestamp"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Package2 className="h-4 w-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-900">Inventory impact</h3>
                </div>
                {loading ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : !row.inventoryItemId ? (
                  <p className="text-sm text-slate-500">Stock data is not available for this item type.</p>
                ) : !journeyData?.stockData ? (
                  <p className="text-sm text-slate-500">No stock prediction data is available for this item yet.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Current stock</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{journeyData.stockData.currentStock.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Demand (30d)</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{journeyData.stockData.demandInPeriod}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Weeks of stock</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{journeyData.stockData.weeksOfStock ?? "-"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Status</p>
                      <Badge className={cn("mt-3 border-0", renderStockStatusClass(journeyData.stockData.status))}>
                        {formatStatusLabel(journeyData.stockData.status)}
                      </Badge>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
