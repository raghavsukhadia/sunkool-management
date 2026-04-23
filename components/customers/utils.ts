import type {
  AdvancedFilters,
  CustomerPreset,
  CustomerRow,
  CustomerStatusTag,
  SortDirection,
  SortKey,
  SortRule,
} from "@/components/customers/types"

export const STATUS_FILTERS: Array<"all" | CustomerStatusTag> = [
  "all",
  "Frequent Buyer",
  "New Customer",
  "Account Overdue",
  "No Orders",
]

export const COLUMN_LABELS: Record<SortKey | "status" | "orderFrequency", string> = {
  name: "Name",
  phone: "Phone",
  email: "Email",
  orderFrequency: "Order Frequency",
  totalOrders: "Total Orders",
  totalValue: "Total Value",
  unpaidAmount: "Unpaid Amount",
  lastOrderDate: "Last Order Date",
  status: "Status",
}

export const DEFAULT_ADVANCED_FILTERS: AdvancedFilters = {
  lastOrderFrom: "",
  lastOrderTo: "",
  unpaidMode: "all",
  minOrders: "",
  minValue: "",
  maxValue: "",
  phonePrefix: "",
  hasEmail: "all",
}

export const DEFAULT_PRIMARY_SORT: SortRule = { key: "totalValue", direction: "desc" }
export const DEFAULT_SECONDARY_SORT: SortRule = { key: "name", direction: "asc" }

export function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-"
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(dateStr))
}

export function getPrimaryStatus(row: Pick<CustomerRow, "statusTags" | "totalOrders">): CustomerStatusTag {
  if (row.statusTags.includes("Account Overdue")) return "Account Overdue"
  if (row.statusTags.includes("No Orders") || row.totalOrders === 0) return "No Orders"
  if (row.statusTags.includes("New Customer")) return "New Customer"
  return "Frequent Buyer"
}

export function buildCustomerRowsFromLive(
  input: Array<{
    id: string
    name: string
    phone: string | null
    email: string | null
    total_orders: number
    lifetime_value: number
    unpaid_delivered: number
    unpaid_delivered_amount?: number
    last_order_date: string | null
    smart_tags: string[]
    created_at: string
    notes?: string | null
    contact_person?: string | null
    address?: string | null
  }>
): CustomerRow[] {
  return input.map(item => {
    const statusTags = item.smart_tags.filter((tag): tag is CustomerStatusTag =>
      ["Frequent Buyer", "New Customer", "Account Overdue", "No Orders"].includes(tag)
    )
    const row: CustomerRow = {
      id: item.id,
      name: item.name,
      phone: item.phone,
      email: item.email,
      totalOrders: item.total_orders,
      totalValue: Number(item.lifetime_value ?? 0),
      unpaidAmount: Number(item.unpaid_delivered_amount ?? 0),
      lastOrderDate: item.last_order_date,
      statusTags,
      extraTags: [],
      status: "Frequent Buyer",
      createdAt: item.created_at,
      notes: item.notes ?? null,
      contactPerson: item.contact_person ?? null,
      address: item.address ?? null,
    }
    row.status = getPrimaryStatus(row)
    return row
  })
}

function matchesAdvancedFilters(row: CustomerRow, advanced: AdvancedFilters): boolean {
  if (advanced.lastOrderFrom && row.lastOrderDate && row.lastOrderDate < advanced.lastOrderFrom) {
    return false
  }
  if (advanced.lastOrderTo && row.lastOrderDate && row.lastOrderDate > `${advanced.lastOrderTo}T23:59:59`) {
    return false
  }
  if (advanced.lastOrderFrom && !row.lastOrderDate) return false

  if (advanced.unpaidMode === "has" && row.unpaidAmount <= 0) return false
  if (advanced.unpaidMode === "none" && row.unpaidAmount > 0) return false

  if (advanced.minOrders && row.totalOrders < Number(advanced.minOrders)) return false
  if (advanced.minValue && row.totalValue < Number(advanced.minValue)) return false
  if (advanced.maxValue && row.totalValue > Number(advanced.maxValue)) return false

  if (advanced.phonePrefix) {
    const phone = row.phone ?? ""
    if (!phone.startsWith(advanced.phonePrefix.trim())) return false
  }

  if (advanced.hasEmail === "yes" && !row.email) return false
  if (advanced.hasEmail === "no" && row.email) return false

  return true
}

export function applyFilters(
  rows: CustomerRow[],
  search: string,
  status: "all" | CustomerStatusTag,
  advanced: AdvancedFilters
): CustomerRow[] {
  const term = search.toLowerCase().trim()
  return rows.filter(row => {
    if (term) {
      const found =
        row.name.toLowerCase().includes(term) ||
        (row.phone ?? "").toLowerCase().includes(term) ||
        (row.email ?? "").toLowerCase().includes(term)
      if (!found) return false
    }

    if (status !== "all" && row.status !== status) return false

    return matchesAdvancedFilters(row, advanced)
  })
}

function compareByKey(a: CustomerRow, b: CustomerRow, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    case "phone":
      return (a.phone ?? "").localeCompare(b.phone ?? "")
    case "email":
      return (a.email ?? "").localeCompare(b.email ?? "")
    case "totalOrders":
      return a.totalOrders - b.totalOrders
    case "totalValue":
      return a.totalValue - b.totalValue
    case "unpaidAmount":
      return a.unpaidAmount - b.unpaidAmount
    case "lastOrderDate":
      return (a.lastOrderDate ?? "").localeCompare(b.lastOrderDate ?? "")
    default:
      return 0
  }
}

export function applyMultiSort(rows: CustomerRow[], primary: SortRule, secondary: SortRule): CustomerRow[] {
  const withDir = (val: number, dir: SortDirection) => (dir === "asc" ? val : val * -1)
  return [...rows].sort((a, b) => {
    const first = withDir(compareByKey(a, b, primary.key), primary.direction)
    if (first !== 0) return first
    return withDir(compareByKey(a, b, secondary.key), secondary.direction)
  })
}

export function getPredefinedPresets(): CustomerPreset[] {
  return [
    {
      id: "preset-high-value-overdue",
      name: "High-value overdue",
      kind: "predefined",
      status: "Account Overdue",
      search: "",
      advanced: { ...DEFAULT_ADVANCED_FILTERS, minValue: "300000", unpaidMode: "has" },
      sortPrimary: { key: "unpaidAmount", direction: "desc" },
      sortSecondary: { key: "totalValue", direction: "desc" },
    },
    {
      id: "preset-inactive-buyers",
      name: "Inactive buyers",
      kind: "predefined",
      status: "all",
      search: "",
      advanced: { ...DEFAULT_ADVANCED_FILTERS, lastOrderTo: new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10), minOrders: "1" },
      sortPrimary: { key: "lastOrderDate", direction: "asc" },
      sortSecondary: { key: "name", direction: "asc" },
    },
    {
      id: "preset-new-with-orders",
      name: "New with orders",
      kind: "predefined",
      status: "New Customer",
      search: "",
      advanced: { ...DEFAULT_ADVANCED_FILTERS, minOrders: "1" },
      sortPrimary: { key: "totalOrders", direction: "desc" },
      sortSecondary: { key: "totalValue", direction: "desc" },
    },
    {
      id: "preset-5-plus-unpaid",
      name: "5+ unpaid",
      kind: "predefined",
      status: "all",
      search: "",
      advanced: { ...DEFAULT_ADVANCED_FILTERS, unpaidMode: "has", minOrders: "5" },
      sortPrimary: { key: "unpaidAmount", direction: "desc" },
      sortSecondary: { key: "name", direction: "asc" },
    },
  ]
}

export function toCsv(rows: CustomerRow[]): string {
  const header = [
    "Name",
    "Phone",
    "Email",
    "Total Orders",
    "Total Value (INR)",
    "Unpaid Amount (INR)",
    "Last Order Date",
    "Status",
  ]

  const escape = (val: string | number) => {
    const text = String(val ?? "")
    if (text.includes(",") || text.includes("\"")) {
      return `"${text.replaceAll("\"", '""')}"`
    }
    return text
  }

  const lines = rows.map(row => [
    row.name,
    row.phone ?? "",
    row.email ?? "",
    row.totalOrders,
    row.totalValue,
    row.unpaidAmount,
    formatDate(row.lastOrderDate),
    row.status,
  ].map(escape).join(","))

  return [header.join(","), ...lines].join("\n")
}

export function getActiveFilterTags(
  search: string,
  status: "all" | CustomerStatusTag,
  advanced: AdvancedFilters
): string[] {
  const tags: string[] = []
  if (search.trim()) tags.push(`Search: ${search.trim()}`)
  if (status !== "all") tags.push(`Status: ${status}`)
  if (advanced.lastOrderFrom) tags.push(`Last order from: ${advanced.lastOrderFrom}`)
  if (advanced.lastOrderTo) tags.push(`Last order to: ${advanced.lastOrderTo}`)
  if (advanced.unpaidMode === "has") tags.push("Has unpaid")
  if (advanced.unpaidMode === "none") tags.push("No unpaid")
  if (advanced.minOrders) tags.push(`Min orders: ${advanced.minOrders}`)
  if (advanced.minValue) tags.push(`Min value: ₹${Number(advanced.minValue).toLocaleString("en-IN")}`)
  if (advanced.maxValue) tags.push(`Max value: ₹${Number(advanced.maxValue).toLocaleString("en-IN")}`)
  if (advanced.phonePrefix) tags.push(`Phone prefix: ${advanced.phonePrefix}`)
  if (advanced.hasEmail === "yes") tags.push("Has email")
  if (advanced.hasEmail === "no") tags.push("No email")
  return tags
}
