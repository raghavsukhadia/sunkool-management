"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, PackageSearch, Truck, CalendarDays, UserRound, ExternalLink } from "lucide-react"
import { getOrderTrackingById, type TrackingLookupResult } from "@/app/actions/orders"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

function getShipmentStatusTone(status: string): string {
  switch ((status || "").toLowerCase()) {
    case "ready":
      return "border-amber-200 bg-amber-50 text-amber-800"
    case "picked_up":
      return "border-blue-200 bg-blue-50 text-blue-800"
    case "delivered":
      return "border-green-200 bg-green-50 text-green-800"
    default:
      return "border-slate-200 bg-slate-50 text-slate-700"
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-"
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function TrackingPage() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [results, setResults] = useState<TrackingLookupResult[]>([])

  const trimmedQuery = useMemo(() => query.trim(), [query])

  const runSearch = async () => {
    setHasSearched(true)
    setError(null)

    if (!trimmedQuery) {
      setResults([])
      setError("Please enter a tracking ID.")
      return
    }

    setLoading(true)
    try {
      const response = await getOrderTrackingById(trimmedQuery)
      if (!response.success) {
        setResults([])
        setError(response.error || "Unable to search tracking right now.")
        return
      }
      setResults(response.data || [])
    } catch (e: unknown) {
      setResults([])
      setError(e instanceof Error ? e.message : "Unexpected error while searching tracking ID.")
    } finally {
      setLoading(false)
    }
  }

  const clearSearch = () => {
    setQuery("")
    setHasSearched(false)
    setError(null)
    setResults([])
  }

  return (
    <div className="space-y-5">
      <Card className="border-sk-border bg-white">
        <CardHeader className="border-b border-sk-border bg-[#fcf7f2]">
          <CardTitle className="text-lg font-semibold text-sk-text-1">Tracking</CardTitle>
          <CardDescription className="text-sk-text-2">
            Search by exact Tracking ID to find shipment details and jump to the linked order.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sk-text-3" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter exact Tracking ID (example: AWB12345678)"
                className="h-10 border-sk-border bg-white pl-9 text-sm focus-visible:ring-sk-primary"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    void runSearch()
                  }
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void runSearch()} disabled={loading} className="h-10 px-5">
                {loading ? "Searching..." : "Track"}
              </Button>
              <Button variant="outline" onClick={clearSearch} disabled={loading && !hasSearched} className="h-10 border-sk-border bg-white">
                Clear
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-sk-border bg-sk-page-bg px-3 py-2 text-xs text-sk-text-2">
            Exact match only: this search checks the full tracking ID, without partial lookup.
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {!hasSearched && (
        <Card className="border-sk-border bg-white">
          <CardContent className="py-12 text-center">
            <PackageSearch className="mx-auto mb-3 h-10 w-10 text-sk-text-3" />
            <p className="text-sm font-medium text-sk-text-1">Start by entering a tracking ID</p>
            <p className="mt-1 text-sm text-sk-text-2">You can open the order details page or the courier tracking page from search results.</p>
          </CardContent>
        </Card>
      )}

      {hasSearched && !loading && !error && results.length === 0 && (
        <Card className="border-sk-border bg-white">
          <CardContent className="py-10 text-center">
            <p className="text-sm font-medium text-sk-text-1">No shipment found for this tracking ID.</p>
            <p className="mt-1 text-sm text-sk-text-2">Check spelling and spacing, then try again.</p>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((item) => (
            <Card key={item.dispatch_id} className="border-sk-border bg-white">
              <CardContent className="pt-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-sk-border bg-sk-page-bg px-3 py-1 text-xs font-medium text-sk-text-1">
                        Tracking ID: {item.tracking_id}
                      </span>
                      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${getShipmentStatusTone(item.shipment_status)}`}>
                        {item.shipment_status.replace("_", " ")}
                      </span>
                    </div>

                    <div className="grid gap-2 text-sm text-sk-text-1 sm:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-sk-text-3" />
                        <span>{item.courier_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-sk-text-3" />
                        <span>{formatDate(item.dispatch_date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserRound className="h-4 w-4 text-sk-text-3" />
                        <span>{item.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <PackageSearch className="h-4 w-4 text-sk-text-3" />
                        <span>Order #{item.order_number}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <Link href={`/dashboard/orders/${item.order_id}`}>
                      <Button variant="outline" className="border-sk-border bg-white">
                        Open Order
                      </Button>
                    </Link>
                    {item.tracking_url && (
                      <a href={item.tracking_url} target="_blank" rel="noreferrer noopener">
                        <Button className="gap-1.5">
                          Track Courier
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
