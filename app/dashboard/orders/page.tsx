"use client"

import { useState, useEffect, useMemo, useDeferredValue } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getAllOrders, getCompletedOrderIds, getOrdersExportData } from "@/app/actions/orders"
import {
  ShoppingCart,
  Plus,
  Search,
  Eye,
  Filter,
  ChevronRight,
  X,
  Calendar,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Download,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { OrderCardList } from "@/components/orders/OrderCardList"
import { OrderItemsDropdown } from "@/components/orders/OrderItemsDropdown"
import { CustomerFilterDropdown } from "@/components/orders/CustomerFilterDropdown"
import type { OrderLineItemSummary } from "@/app/actions/orders"

interface Order {
  id: string
  internal_order_number: string | null
  sales_order_number: string | null
  order_status: string
  payment_status: string
  total_price: number
  requested_payment_amount?: number | null
  cash_discount: boolean
  created_at: string
  updated_at: string
  item_count: number
  line_items?: OrderLineItemSummary[]
  total_invoiced?: number | null
  total_paid?: number | null
  amount_due?: number | null
  customers: {
    id: string
    name: string
    email: string | null
    phone: string | null
  } | null
}

function getOrderDisplayTotal(order: Order): number {
  return order.requested_payment_amount != null ? Number(order.requested_payment_amount) : (order.total_price ?? 0)
}

const VALID_STATUSES = ["New Order", "In Progress", "Ready for Dispatch", "Invoiced", "In Transit", "Partial Delivered", "Delivered", "Void"]

export default function OrdersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [showSearchPanel, setShowSearchPanel] = useState(false)
  const [sortBy, setSortBy] = useState<"created_at" | "total_price" | "sales_order_number">("created_at")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [paymentFilter, setPaymentFilter] = useState<string>("all")
  const [completedOrderIds, setCompletedOrderIds] = useState<string[]>([])
  const [completedOnly, setCompletedOnly] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [customerFilter, setCustomerFilter] = useState<"all" | string>("all")
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())

  const uniqueCustomers = useMemo(() => {
    const map = new Map<string, string>()
    for (const o of orders) {
      const c = o.customers
      if (c?.id && c.name) map.set(c.id, c.name)
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
  }, [orders])

  useEffect(() => {
    const status = searchParams.get("status")
    if (status && VALID_STATUSES.includes(status)) {
      setStatusFilter(status)
      setShowSearchPanel(true)
    }
  }, [searchParams])

  useEffect(() => {
    loadOrders()
  }, [])

  // When returning from an order detail page, this client component may keep its
  // previous state (browser back/forward). Refresh on focus/visibility so statuses
  // like Paid/Delivered show up immediately without manual refresh.
  useEffect(() => {
    const onFocus = () => {
      void loadOrders()
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") void loadOrders()
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleExport = async () => {
    const exportOrders =
      selectedOrderIds.size > 0
        ? filteredAndSortedOrders.filter((o) => selectedOrderIds.has(o.id))
        : filteredAndSortedOrders
    const ids = exportOrders.map((o) => o.id)
    if (ids.length === 0) {
      setError("No orders to export")
      return
    }
    setExporting(true)
    setError(null)
    try {
      const XLSX = await import("xlsx-js-style")
      const res = await getOrdersExportData(ids)
      if (!res.success || !res.data) {
        setError(res.error || "Export failed")
        return
      }

      // Build a lookup map from already-loaded order data (has price, payment, email, phone)
      const orderLookup = new Map(filteredAndSortedOrders.map((o) => [o.id, o]))

      // ── Color palette ──────────────────────────────────────────────
      const C = {
        // Brand
        brandDark:  "1E3A5F",   // deep navy (title bg)
        brandMid:   "2E5F8A",   // steel blue (section group headers)
        brandLight: "E8F0F8",   // very light blue (alt row)
        white:      "FFFFFF",
        lightGray:  "F4F6F9",
        borderCol:  "C5D3E0",
        textDark:   "0D1B2A",
        textMuted:  "4A6080",
        // Section header accents
        secOrder:   "1E5799",   // ORDER INFO — navy
        secCustomer:"276749",   // CUSTOMER — forest green
        secItems:   "7B3F00",   // ITEMS — warm brown
        secFinance: "6B2D8B",   // FINANCIAL — purple
        secDispatch:"8B3A1E",   // DISPATCH — rust
        // Finance value colours
        green:      "166534",
        red:        "991B1B",
        amber:      "92400E",
      }

      // ── Column definitions (grouped) ───────────────────────────────
      // Groups: ORDER INFO | CUSTOMER | ITEMS | FINANCIAL / PAYMENT | DISPATCH & SHIPPING
      const COLS = [
        // ── ORDER INFO (0–3)
        { label: "SR #",               width: 6,  group: "order"    },
        { label: "Internal Order #",   width: 18, group: "order"    },
        { label: "Sales Order #",      width: 17, group: "order"    },
        { label: "Order Date",         width: 14, group: "order"    },
        { label: "Order Status",       width: 16, group: "order"    },
        // ── CUSTOMER (5–7)
        { label: "Customer Name",      width: 24, group: "customer" },
        { label: "Phone",              width: 14, group: "customer" },
        { label: "Email",              width: 28, group: "customer" },
        // ── ITEMS (8)
        { label: "Items Ordered",      width: 42, group: "items"    },
        // ── FINANCIAL (9–14)
        { label: "Order Value (₹)",    width: 16, group: "finance"  },
        { label: "Cash Discount",      width: 13, group: "finance"  },
        { label: "Invoice #",          width: 16, group: "finance"  },
        { label: "Total Invoiced (₹)", width: 17, group: "finance"  },
        { label: "Total Received (₹)", width: 17, group: "finance"  },
        { label: "Balance Due (₹)",    width: 16, group: "finance"  },
        { label: "Payment Status",     width: 16, group: "finance"  },
        // ── DISPATCH (16–19)
        { label: "Dispatch Date",      width: 14, group: "dispatch" },
        { label: "Courier",            width: 20, group: "dispatch" },
        { label: "Tracking / Docket #", width: 24, group: "dispatch" },
        { label: "Ship-to Address",    width: 34, group: "dispatch" },
      ]
      const numCols = COLS.length

      // Column letter helper — handles > 26 cols (AA, AB…)
      const colLetter = (i: number): string => {
        if (i < 26) return String.fromCharCode(65 + i)
        return String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26))
      }

      // Section group → header bg colour
      const groupColor: Record<string, string> = {
        order:    C.secOrder,
        customer: C.secCustomer,
        items:    C.secItems,
        finance:  C.secFinance,
        dispatch: C.secDispatch,
      }

      // Section group → label row (row 4) text
      const groupLabel: Record<string, string> = {
        order:    "ORDER INFORMATION",
        customer: "CUSTOMER",
        items:    "ITEMS",
        finance:  "FINANCIAL / PAYMENT",
        dispatch: "DISPATCH & SHIPPING",
      }

      // ── Shared border ──────────────────────────────────────────────
      const border = {
        top:    { style: "thin", color: { rgb: C.borderCol } },
        bottom: { style: "thin", color: { rgb: C.borderCol } },
        left:   { style: "thin", color: { rgb: C.borderCol } },
        right:  { style: "thin", color: { rgb: C.borderCol } },
      }

      // ── Build worksheet ────────────────────────────────────────────
      const ws: Record<string, unknown> = {}

      // Row 1 — Title banner
      ws["A1"] = {
        v: "SUNKOOL MANAGEMENT  —  Orders Export Report",
        t: "s",
        s: {
          font: { bold: true, sz: 16, color: { rgb: C.white }, name: "Calibri" },
          fill: { patternType: "solid", fgColor: { rgb: C.brandDark } },
          alignment: { horizontal: "center", vertical: "center" },
        },
      }

      // Row 2 — Meta summary bar
      const totalInvoiced = ids.reduce((sum, id) => sum + (orderLookup.get(id)?.total_invoiced ?? 0), 0)
      const totalPaid     = ids.reduce((sum, id) => sum + (orderLookup.get(id)?.total_paid     ?? 0), 0)
      const totalDue      = ids.reduce((sum, id) => sum + (orderLookup.get(id)?.amount_due     ?? 0), 0)
      const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
      ws["A2"] = {
        v: [
          `Generated: ${new Date().toLocaleString("en-IN")}`,
          `Orders: ${res.data.length}`,
          `Total Invoiced: ${fmt(totalInvoiced)}`,
          `Total Received: ${fmt(totalPaid)}`,
          `Balance Due: ${fmt(totalDue)}`,
        ].join("     |     "),
        t: "s",
        s: {
          font: { sz: 10, color: { rgb: C.textMuted }, name: "Calibri" },
          fill: { patternType: "solid", fgColor: { rgb: C.lightGray } },
          alignment: { horizontal: "center", vertical: "center" },
        },
      }

      // Row 3 — Section group label band
      // Compute first column index for each group
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

      // Row 4 — Column headers
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

      // Rows 5+ — Data rows
      res.data.forEach((row, idx) => {
        const order = orderLookup.get(row.orderId)
        const r = idx + 5
        const isAlt = idx % 2 === 1
        const fillBg = isAlt ? C.brandLight : C.white

        const base = {
          font: { sz: 10, name: "Calibri", color: { rgb: C.textDark } },
          fill: { patternType: "solid", fgColor: { rgb: fillBg } },
          alignment: { vertical: "center", wrapText: true },
          border,
        }
        const sCenter = { ...base, alignment: { ...base.alignment, horizontal: "center" } }
        const sBold   = { ...base, font: { ...base.font, bold: true } }
        const sRight  = { ...base, alignment: { ...base.alignment, horizontal: "right" } }
        const sAmtBold = {
          ...base,
          font: { ...base.font, bold: true },
          alignment: { ...base.alignment, horizontal: "right" },
        }
        const sGreen = { ...sAmtBold, font: { ...sAmtBold.font, color: { rgb: C.green } } }
        const sRed   = { ...sAmtBold, font: { ...sAmtBold.font, color: { rgb: C.red   } } }
        const sAmber = { ...sAmtBold, font: { ...sAmtBold.font, color: { rgb: C.amber } } }

        const invoiced  = order?.total_invoiced ?? 0
        const paid      = order?.total_paid     ?? 0
        const due       = order?.amount_due     ?? 0
        const orderVal  = order ? getOrderDisplayTotal(order) : 0

        // Payment status badge text cleanup
        const payStatus = (order?.payment_status ?? "—")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())

        const cells = [
          // ORDER INFO
          { v: idx + 1,                                    t: "n", s: sCenter                     },
          { v: row.internal_order_number || "—",           t: "s", s: sBold                       },
          { v: row.sales_order_number    || "—",           t: "s", s: base                        },
          { v: row.created_at            || "—",           t: "s", s: sCenter                     },
          { v: (row.order_status || "—").replace(/_/g," ").replace(/\b\w/g,(c)=>c.toUpperCase()),
                                                           t: "s", s: sCenter                     },
          // CUSTOMER
          { v: row.customer_name         || "—",           t: "s", s: sBold                       },
          { v: order?.customers?.phone   || "—",           t: "s", s: base                        },
          { v: order?.customers?.email   || "—",           t: "s", s: base                        },
          // ITEMS
          { v: row.item_details          || "—",           t: "s", s: base                        },
          // FINANCIAL
          { v: orderVal,                                   t: "n", s: sAmtBold                    },
          { v: order?.cash_discount ? "Yes" : "No",        t: "s", s: sCenter                     },
          { v: row.invoice_number        || "—",           t: "s", s: sCenter                     },
          { v: invoiced > 0 ? invoiced : "—",              t: invoiced > 0 ? "n" : "s", s: invoiced > 0 ? sGreen : sRight },
          { v: paid     > 0 ? paid     : "—",              t: paid     > 0 ? "n" : "s", s: paid     > 0 ? sGreen : sRight },
          { v: due      > 0 ? due      : "—",              t: due      > 0 ? "n" : "s", s: due      > 0 ? sRed   : sRight },
          { v: payStatus,                                  t: "s", s: sCenter                     },
          // DISPATCH
          { v: row.dispatch_date         || "—",           t: "s", s: sCenter                     },
          { v: row.courier_name          || "—",           t: "s", s: base                        },
          { v: row.tracking_id           || "—",           t: "s", s: base                        },
          { v: row.ship_to               || "—",           t: "s", s: base                        },
        ]
        cells.forEach((cell, ci) => {
          ws[`${colLetter(ci)}${r}`] = cell
        })
      })

      // ── Totals footer row ──────────────────────────────────────────
      const footerRow = res.data.length + 5
      const footerBase = {
        font: { bold: true, sz: 10, name: "Calibri", color: { rgb: C.textDark } },
        fill: { patternType: "solid", fgColor: { rgb: C.lightGray } },
        alignment: { vertical: "center", horizontal: "center" },
        border,
      }
      const footerAmt = { ...footerBase, alignment: { ...footerBase.alignment, horizontal: "right" } }
      const footerGreen = { ...footerAmt, font: { ...footerAmt.font, color: { rgb: C.green } } }
      const footerRed   = { ...footerAmt, font: { ...footerAmt.font, color: { rgb: C.red   } } }
      COLS.forEach((_, i) => {
        const col = colLetter(i)
        // Col index map: 9=Order Value, 12=Total Invoiced, 13=Total Received, 14=Balance Due
        if (i === 0)  ws[`${col}${footerRow}`] = { v: "TOTALS", t: "s", s: footerBase }
        else if (i === 9)  ws[`${col}${footerRow}`] = { v: ids.reduce((s,id)=>s+(orderLookup.get(id)?getOrderDisplayTotal(orderLookup.get(id)!):0),0), t:"n", s: footerAmt  }
        else if (i === 12) ws[`${col}${footerRow}`] = { v: totalInvoiced, t:"n", s: footerGreen }
        else if (i === 13) ws[`${col}${footerRow}`] = { v: totalPaid,     t:"n", s: footerGreen }
        else if (i === 14) ws[`${col}${footerRow}`] = { v: totalDue,      t:"n", s: footerRed   }
        else               ws[`${col}${footerRow}`] = { v: "",            t:"s", s: footerBase  }
      })

      // ── Worksheet range ────────────────────────────────────────────
      const lastRow = footerRow
      const lastCol = colLetter(numCols - 1)
      ws["!ref"] = `A1:${lastCol}${lastRow}`

      // ── Merges ────────────────────────────────────────────────────
      const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [
        // Title & meta span all columns (rows 0, 1)
        { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } },
        // Section group label merges (row 2)
        ...Object.keys(groupFirstCol).map((g) => ({
          s: { r: 2, c: groupFirstCol[g] },
          e: { r: 2, c: groupLastCol[g]  },
        })),
        // Footer "TOTALS" label merges cols 0–8
        { s: { r: footerRow - 1, c: 0 }, e: { r: footerRow - 1, c: 8 } },
      ]
      ws["!merges"] = merges

      // ── Column widths ─────────────────────────────────────────────
      ws["!cols"] = COLS.map((c) => ({ wch: c.width }))

      // ── Row heights ───────────────────────────────────────────────
      ws["!rows"] = [
        { hpt: 40 }, // title
        { hpt: 22 }, // meta
        { hpt: 20 }, // section labels
        { hpt: 36 }, // column headers
      ]

      // ── Freeze panes (top 4 rows + first 2 cols) ──────────────────
      ws["!freeze"] = { xSplit: 2, ySplit: 4 }

      // ── Auto-filter on header row ──────────────────────────────────
      ws["!autofilter"] = { ref: `A4:${lastCol}4` }

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Orders")

      const date = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `sunkool-orders-${date}.xlsx`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Export failed")
    } finally {
      setExporting(false)
    }
  }

  const loadOrders = async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Fetch and show orders immediately — don't block on completed IDs
      const ordersResult = await getAllOrders()
      if (ordersResult.success && ordersResult.data) {
        setOrders(ordersResult.data as unknown as Order[])
      } else {
        setError(ordersResult.error || "Failed to load orders")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setLoading(false) // Orders are visible now
    }

    // 2. Load completed IDs silently in the background
    try {
      const completedResult = await getCompletedOrderIds()
      if (completedResult.success && completedResult.data) {
        setCompletedOrderIds(completedResult.data)
      }
    } catch {
      // Non-critical — completed filter just won't highlight anything
    }
  }

  const deferredSearchTerm = useDeferredValue(searchTerm)
  const normalizedSearchTerm = useMemo(() => deferredSearchTerm.trim().toLowerCase(), [deferredSearchTerm])
  const completedOrderIdsSet = useMemo(() => new Set(completedOrderIds), [completedOrderIds])
  const ordersWithDerived = useMemo(
    () =>
      orders.map((order) => ({
        order,
        createdAtTs: new Date(order.created_at).getTime(),
        searchable: [
          order.internal_order_number ?? "",
          order.sales_order_number ?? "",
          order.customers?.name ?? "",
          order.customers?.email ?? "",
          order.customers?.phone ?? "",
          order.id,
        ]
          .join(" ")
          .toLowerCase(),
      })),
    [orders]
  )

  const filteredAndSortedOrders = useMemo(() => {
    let filtered = [...ordersWithDerived]

    if (normalizedSearchTerm) {
      filtered = filtered.filter(({ searchable }) => searchable.includes(normalizedSearchTerm))
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(({ order }) => order.order_status === statusFilter)
    }

    // Payment status filter
    if (paymentFilter !== "all") {
      filtered = filtered.filter(({ order }) => order.payment_status === paymentFilter)
    }

    // Customer filter
    if (customerFilter !== "all") {
      filtered = filtered.filter(({ order }) => order.customers?.id === customerFilter)
    }

    // Completed filter: "Completed only" shows only completed; otherwise show all orders (including completed)
    if (completedOnly) {
      filtered = filtered.filter(({ order }) => completedOrderIdsSet.has(order.id))
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: string | number
      let bVal: string | number

      switch (sortBy) {
        case "created_at":
          aVal = a.createdAtTs
          bVal = b.createdAtTs
          break
        case "total_price":
          aVal = a.order.total_price || 0
          bVal = b.order.total_price || 0
          break
        case "sales_order_number":
          aVal = a.order.sales_order_number || ""
          bVal = b.order.sales_order_number || ""
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1
      return 0
    })

    return filtered.map(({ order }) => order)
  }, [
    completedOnly,
    completedOrderIdsSet,
    customerFilter,
    normalizedSearchTerm,
    ordersWithDerived,
    paymentFilter,
    sortBy,
    sortDirection,
    statusFilter,
  ])

  const allVisibleSelected =
    filteredAndSortedOrders.length > 0 &&
    filteredAndSortedOrders.every((o) => selectedOrderIds.has(o.id))
  const someSelected = selectedOrderIds.size > 0 && !allVisibleSelected

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedOrderIds(new Set())
    } else {
      setSelectedOrderIds(new Set(filteredAndSortedOrders.map((o) => o.id)))
    }
  }

  const toggleOrder = (id: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "New Order":
        return "border-yellow-200 bg-yellow-50 text-yellow-800"
      case "In Progress":
        return "border-purple-200 bg-purple-50 text-purple-800"
      case "Ready for Dispatch":
        return "border-orange-200 bg-orange-50 text-orange-800"
      case "Invoiced":
        return "border-cyan-200 bg-cyan-50 text-cyan-800"
      case "In Transit":
        return "border-sky-200 bg-sky-50 text-sky-800"
      case "Partial Delivered":
        return "border-teal-200 bg-teal-50 text-teal-800"
      case "Delivered":
        return "border-emerald-200 bg-emerald-50 text-emerald-800"
      case "Void":
        return "border-red-200 bg-red-50 text-red-800"
      default:
        return "border-slate-200 bg-slate-50 text-slate-700"
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "Paid":
        return "border-green-200 bg-green-50 text-green-800"
      case "Pending":
        return "border-amber-200 bg-amber-50 text-amber-800"
      case "Delivered Unpaid":
        return "border-orange-200 bg-orange-50 text-orange-800"
      case "Partial":
        return "border-blue-200 bg-blue-50 text-blue-800"
      case "Refunded":
        return "border-red-200 bg-red-50 text-red-800"
      default:
        return "border-slate-200 bg-slate-50 text-slate-700"
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-sk-primary"></div>
          <p className="text-sk-text-2">Loading orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-8 lg:space-y-6">
      {/* Header - desktop */}
      <div className="hidden border-b border-sk-border pb-4 lg:flex lg:items-end lg:justify-between lg:gap-4">
        <div className="space-y-3">
          <div className="h-1 w-14 rounded-full bg-sk-primary" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-sk-text-1">All Orders</h1>
            <p className="mt-1.5 text-sm text-sk-text-2">Manage and track all orders across the pipeline.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleExport}
            disabled={exporting}
            variant="outline"
            className="gap-2 border-sk-border bg-white text-sk-text-1 hover:bg-sk-page-bg"
          >
            <Download className="w-4 h-4" />
            {exporting
              ? "Exporting..."
              : selectedOrderIds.size > 0
                ? `Export ${selectedOrderIds.size} selected`
                : "Export All"}
          </Button>
          <Button onClick={() => router.push("/dashboard/orders/new")} className="gap-2 px-4">
            <Plus className="w-4 h-4 mr-2" />
            New Order
          </Button>
        </div>
      </div>

      {/* Header - mobile: title + Filter + New Order */}
      <div className="flex items-center justify-between gap-3 border-b border-sk-border pb-3 lg:hidden">
        <div className="min-w-0">
          <div className="mb-2 h-1 w-10 rounded-full bg-sk-primary" />
          <h1 className="text-xl font-semibold tracking-tight text-sk-text-1">Orders</h1>
          <p className="truncate text-sm text-sk-text-2">{filteredAndSortedOrders.length} orders</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="min-h-[44px] gap-2 border-sk-border bg-white text-sk-text-1 hover:bg-sk-page-bg">
                <Filter className="w-4 h-4" />
                Filter
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl border-sk-border bg-white">
              <SheetHeader>
                <SheetTitle>Filter & sort</SheetTitle>
                <SheetDescription className="sr-only">
                  Filter and sort orders by customer, status, payment, and date.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-5 pb-8">
                <div>
                  <Label className="text-sm font-semibold text-sk-text-1">Search</Label>
                  <div className="relative mt-1.5">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sk-text-3 w-4 h-4" />
                    <Input
                      placeholder="Order #, customer, email, phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-11 border-sk-border bg-white pl-9 focus-visible:ring-sk-primary"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-sk-text-1">Order Status</Label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="mt-1.5 flex h-11 w-full rounded-md border border-sk-border bg-white px-3 py-2 text-base text-sk-text-1 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-sk-primary focus-visible:ring-offset-2"
                  >
                    <option value="all">All Statuses</option>
                    {VALID_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-sk-text-1">Payment Status</Label>
                  <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    className="mt-1.5 flex h-11 w-full rounded-md border border-sk-border bg-white px-3 py-2 text-base text-sk-text-1 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-sk-primary focus-visible:ring-offset-2"
                  >
                    <option value="all">All</option>
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                    <option value="Partial">Partial</option>
                    <option value="Delivered Unpaid">Delivered Unpaid</option>
                    <option value="Refunded">Refunded</option>
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-sk-text-1">Customer</Label>
                  <div className="mt-1.5">
                    <CustomerFilterDropdown
                      customers={uniqueCustomers}
                      value={customerFilter}
                      onChange={setCustomerFilter}
                      className="min-h-11 h-11"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-semibold text-sk-text-1">Sort by</Label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as "created_at" | "total_price" | "sales_order_number")}
                      className="mt-1.5 flex h-11 w-full rounded-md border border-sk-border bg-white px-3 py-2 text-base text-sk-text-1 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-sk-primary focus-visible:ring-offset-2"
                    >
                      <option value="created_at">Date</option>
                      <option value="total_price">Amount</option>
                      <option value="sales_order_number">Order #</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-sk-text-1">Order</Label>
                    <select
                      value={sortDirection}
                      onChange={(e) => setSortDirection(e.target.value as "asc" | "desc")}
                      className="mt-1.5 flex h-11 w-full rounded-md border border-sk-border bg-white px-3 py-2 text-base text-sk-text-1 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-sk-primary focus-visible:ring-offset-2"
                    >
                      <option value="desc">Newest first</option>
                      <option value="asc">Oldest first</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCompletedOnly((prev) => !prev)}
                  className={`w-full text-left p-4 rounded-xl border min-h-[44px] ${
                    completedOnly ? "border-green-200 bg-green-50" : "border-sk-border bg-sk-page-bg"
                  }`}
                >
                  <span className="font-medium text-sk-text-1">Completed only</span>
                  <span className="mt-0.5 block text-sm text-sk-text-2">
                    {completedOrderIds.length} completed · {completedOnly ? "Showing completed" : "Tap to show"}
                  </span>
                </button>
                <Button className="w-full min-h-[44px]" onClick={() => setFilterSheetOpen(false)}>
                  Done
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <Button onClick={() => router.push("/dashboard/orders/new")} className="min-h-[44px] gap-2">
            <Plus className="w-4 h-4" />
            New
          </Button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center justify-between rounded-r-md border-l-4 border-red-500 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filter Panel - desktop only */}
      <Card className="hidden border border-sk-border bg-white lg:block">
        <CardHeader className="border-b border-sk-border bg-[#fcf7f2] pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="rounded-md bg-sk-primary-tint p-1.5">
                <Filter className="w-4 h-4 text-sk-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-sk-text-1">Search & Filter</CardTitle>
                <CardDescription className="mt-1 text-sm text-sk-text-2">Refine orders by customer, status, payment state, and sort order.</CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSearchPanel(!showSearchPanel)}
              className="flex items-center gap-1.5 text-sk-text-2 hover:bg-sk-page-bg hover:text-sk-text-1"
            >
              {showSearchPanel ? "Hide" : "Show"} Options
              {showSearchPanel ? <ChevronRight className="w-4 h-4 rotate-90" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-sk-text-3 w-4 h-4" />
            <Input
              placeholder="Search by order number, customer name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 border-sk-border bg-white pl-10 pr-10 text-sm focus-visible:ring-sk-primary"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 rounded p-1 text-sk-text-3 transition-colors hover:bg-sk-page-bg hover:text-sk-text-2"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {showSearchPanel && (
            <div className="space-y-5 border-t border-sk-border pt-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="mb-3 block text-sm font-semibold text-sk-text-1">Order Status</Label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-sk-border bg-white px-3 py-2 text-sm text-sk-text-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sk-primary focus-visible:ring-offset-2"
                  >
                    <option value="all">All Statuses</option>
                    <option value="New Order">New Order</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Ready for Dispatch">Ready for Dispatch</option>
                    <option value="Invoiced">Invoiced</option>
                    <option value="In Transit">In Transit</option>
                    <option value="Partial Delivered">Partial Delivered</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Void">Void</option>
                  </select>
                </div>
                <div>
                  <Label className="mb-3 block text-sm font-semibold text-sk-text-1">Payment Status</Label>
                  <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-sk-border bg-white px-3 py-2 text-sm text-sk-text-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sk-primary focus-visible:ring-offset-2"
                  >
                    <option value="all">All Payment Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                    <option value="Partial">Partial</option>
                    <option value="Delivered Unpaid">Delivered Unpaid</option>
                    <option value="Refunded">Refunded</option>
                  </select>
                </div>
                <div>
                  <Label className="mb-3 block text-sm font-semibold text-sk-text-1">Customer</Label>
                  <CustomerFilterDropdown
                    customers={uniqueCustomers}
                    value={customerFilter}
                    onChange={setCustomerFilter}
                    className="h-10"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-3">
                <div className="rounded-xl border border-sk-border bg-[#fcf7f2] p-4 text-center">
                  <div className="text-3xl font-semibold text-sk-text-1">{filteredAndSortedOrders.length}</div>
                  <div className="mt-1.5 text-xs font-medium uppercase tracking-[0.16em] text-sk-text-3">Filtered Orders</div>
                </div>
                <button
                  type="button"
                  onClick={() => setCompletedOnly((prev) => !prev)}
                  className={`w-full cursor-pointer rounded-xl border p-4 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 ${
                    completedOnly
                      ? "border-green-300 bg-green-50 ring-2 ring-green-400"
                      : "border-green-200 bg-white hover:bg-green-50"
                  }`}
                >
                  <div className="text-3xl font-bold text-green-700">{completedOrderIds.length}</div>
                  <div className="mt-1.5 text-xs font-medium uppercase tracking-[0.16em] text-sk-text-3">Completed</div>
                  {completedOnly && (
                    <div className="text-xs text-green-700 mt-1 font-medium">Showing completed only · click to clear</div>
                  )}
                </button>
                <div className="rounded-xl border border-sk-border bg-white p-4 text-center">
                  <div className="text-3xl font-semibold text-sk-text-1">
                    ₹{filteredAndSortedOrders.reduce((sum, o) => sum + getOrderDisplayTotal(o), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="mt-1.5 text-xs font-medium uppercase tracking-[0.16em] text-sk-text-3">Total Value</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders - mobile: card list */}
      <div className="lg:hidden">
        {filteredAndSortedOrders.length === 0 ? (
          <div className="rounded-xl border border-sk-border bg-white px-4 py-12 text-center">
            <ShoppingCart className="mx-auto mb-3 h-12 w-12 text-sk-text-3" />
            <p className="font-medium text-sk-text-2">
              {completedOnly
                ? "No completed orders match your filters"
                : searchTerm || statusFilter !== "all" || paymentFilter !== "all"
                  ? "No orders match your filters"
                  : completedOrderIds.length > 0
                    ? "All orders are completed"
                    : "No orders yet"}
            </p>
            {!searchTerm && statusFilter === "all" && paymentFilter === "all" && !completedOnly && completedOrderIds.length === 0 && (
              <Button onClick={() => router.push("/dashboard/orders/new")} className="mt-4 min-h-[44px]">
                <Plus className="w-4 h-4 mr-2" />
                Create New Order
              </Button>
            )}
          </div>
        ) : (
          <OrderCardList data={filteredAndSortedOrders} />
        )}
      </div>

      {/* Orders Table - desktop only */}
      <Card className="hidden border border-sk-border bg-white lg:block">
        <CardHeader className="sticky top-[68px] z-10 border-b border-sk-border bg-[#fcf7f2] py-3 px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="rounded-md bg-sk-primary-tint p-1.5">
                <ShoppingCart className="w-4 h-4 text-sk-primary" />
              </div>
              <div>
                <span className="text-base font-semibold text-sk-text-1">
                  Orders
                  <span className="ml-1.5 text-sm font-normal text-sk-text-3">({filteredAndSortedOrders.length})</span>
                </span>
                <p className="text-xs text-sk-text-3 mt-0.5">
                  {completedOnly
                    ? <span className="inline-flex items-center gap-1">Showing completed only <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-px text-[10px] font-medium text-green-800">Completed</span></span>
                    : `In-progress orders · ${completedOrderIds.length} completed`}
                </p>
              </div>
            </div>
            {selectedOrderIds.size > 0 && (
              <span className="text-xs font-medium text-sk-primary">
                {selectedOrderIds.size} selected — click Export to download
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredAndSortedOrders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="mx-auto mb-3 h-12 w-12 text-sk-text-3" />
              <p className="font-medium text-sk-text-2">
                {completedOnly
                  ? "No completed orders match your filters"
                  : searchTerm || statusFilter !== "all" || paymentFilter !== "all"
                    ? "No orders match your filters"
                    : completedOrderIds.length > 0
                      ? "All orders are completed"
                      : "No orders yet"}
              </p>
              <p className="mt-1 text-sm text-sk-text-3">
                {completedOnly
                  ? "Completed = all items produced, all delivered, full amount paid."
                  : searchTerm || statusFilter !== "all" || paymentFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : completedOrderIds.length > 0
                      ? "Click the Completed card above to see finished orders."
                      : "Create your first order to get started"}
              </p>
              {!searchTerm && statusFilter === "all" && paymentFilter === "all" && !completedOnly && completedOrderIds.length === 0 && (
                <Button onClick={() => router.push("/dashboard/orders/new")} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Order
                </Button>
              )}
            </div>
          ) : (
            <div className="[overflow-x:clip]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="sticky top-[130px] z-10 border-b border-sk-border bg-[#fcf7f2]">
                    <th className="w-10 px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        ref={(el) => { if (el) el.indeterminate = someSelected }}
                        onChange={toggleSelectAll}
                        aria-label="Select all orders"
                        className="h-4 w-4 cursor-pointer rounded border-sk-border accent-sk-primary"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-sk-text-3">
                      <button
                        onClick={() => {
                          if (sortBy === "sales_order_number") {
                            setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                          } else {
                            setSortBy("sales_order_number")
                            setSortDirection("asc")
                          }
                        }}
                        className="group flex items-center gap-1 transition-colors hover:text-sk-text-1"
                      >
                        Order #
                        {sortBy === "sales_order_number" ? (
                          sortDirection === "asc" ? <ArrowUp className="h-3 w-3 text-sk-primary" /> : <ArrowDown className="h-3 w-3 text-sk-primary" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-sk-text-3 group-hover:text-sk-text-2" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-sk-text-3">Customer</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-sk-text-3">Items</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-sk-text-3">Status</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-sk-text-3">Payment</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-sk-text-3">
                      <button
                        onClick={() => {
                          if (sortBy === "total_price") {
                            setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                          } else {
                            setSortBy("total_price")
                            setSortDirection("desc")
                          }
                        }}
                        className="group flex items-center gap-1 transition-colors hover:text-sk-text-1"
                      >
                        Total
                        {sortBy === "total_price" ? (
                          sortDirection === "asc" ? <ArrowUp className="h-3 w-3 text-sk-primary" /> : <ArrowDown className="h-3 w-3 text-sk-primary" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-sk-text-3 group-hover:text-sk-text-2" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-sk-text-3">
                      <button
                        onClick={() => {
                          if (sortBy === "created_at") {
                            setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                          } else {
                            setSortBy("created_at")
                            setSortDirection("desc")
                          }
                        }}
                        className="group flex items-center gap-1 transition-colors hover:text-sk-text-1"
                      >
                        Date
                        {sortBy === "created_at" ? (
                          sortDirection === "asc" ? <ArrowUp className="h-3 w-3 text-sk-primary" /> : <ArrowDown className="h-3 w-3 text-sk-primary" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-sk-text-3 group-hover:text-sk-text-2" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-sk-text-3">View</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedOrders.map((order, index) => (
                    <tr
                      key={order.id}
                      className={`cursor-pointer border-b border-sk-border transition-colors hover:bg-sk-page-bg ${
                        selectedOrderIds.has(order.id)
                          ? "bg-amber-50/60"
                          : completedOrderIdsSet.has(order.id)
                            ? "bg-emerald-50/30"
                          : index % 2 === 0
                            ? "bg-white"
                            : "bg-slate-50/40"
                      }`}
                      onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                    >
                      <td className="w-10 px-3 py-3.5 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.has(order.id)}
                          onChange={() => toggleOrder(order.id)}
                          aria-label={`Select order ${order.internal_order_number || order.id}`}
                          className="h-4 w-4 cursor-pointer rounded border-sk-border accent-sk-primary"
                        />
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-sk-text-1">
                            {order.internal_order_number || order.sales_order_number || `#${order.id.slice(0, 8)}`}
                          </span>
                          {order.sales_order_number && order.internal_order_number && (
                            <span className="mt-0.5 text-xs text-sk-text-3">SO: {order.sales_order_number}</span>
                          )}
                          {order.cash_discount && (
                            <span className="mt-0.5 inline-flex w-fit items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700">CD</span>
                          )}
                          {completedOrderIdsSet.has(order.id) && (
                            <span className="mt-1 inline-flex w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-px text-[10px] font-medium text-emerald-800">
                              Completed
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-sk-text-1">
                            {order.customers?.name || "N/A"}
                          </span>
                          {order.customers?.phone && (
                            <span className="mt-0.5 text-xs text-sk-text-3">{order.customers.phone}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-middle" onClick={(e) => e.stopPropagation()}>
                        <OrderItemsDropdown
                          orderId={order.id}
                          count={order.item_count || 0}
                        />
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(order.order_status)}`}>
                          {order.order_status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getPaymentStatusColor(order.payment_status)}`}>
                          {order.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <span className="text-sm font-semibold text-sk-text-1">
                          ₹{getOrderDisplayTotal(order).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-sk-text-1">
                            {new Date(order.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                          <span className="text-[11px] text-sk-text-3">
                            {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/dashboard/orders/${order.id}`)
                          }}
                          className="h-8 w-8 rounded-full border border-transparent p-0 text-sk-text-2 hover:border-sk-border hover:bg-white hover:text-sk-primary"
                          aria-label={`View ${order.internal_order_number || order.sales_order_number || order.id}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
