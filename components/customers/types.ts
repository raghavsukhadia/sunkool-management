export type CustomerStatusTag =
  | "Frequent Buyer"
  | "New Customer"
  | "Account Overdue"
  | "No Orders"

export type SortKey =
  | "name"
  | "phone"
  | "email"
  | "totalOrders"
  | "totalValue"
  | "unpaidAmount"
  | "lastOrderDate"

export type SortDirection = "asc" | "desc"

export interface CustomerRow {
  id: string
  name: string
  phone: string | null
  email: string | null
  totalOrders: number
  totalValue: number
  unpaidAmount: number
  lastOrderDate: string | null
  statusTags: CustomerStatusTag[]
  extraTags: string[]
  status: CustomerStatusTag
  createdAt: string
  notes?: string | null
  contactPerson?: string | null
  address?: string | null
}

export interface AdvancedFilters {
  lastOrderFrom: string
  lastOrderTo: string
  unpaidMode: "all" | "has" | "none"
  minOrders: string
  minValue: string
  maxValue: string
  phonePrefix: string
  hasEmail: "all" | "yes" | "no"
}

export interface SortRule {
  key: SortKey
  direction: SortDirection
}

export interface CustomerPreset {
  id: string
  name: string
  kind: "predefined" | "custom"
  status: "all" | CustomerStatusTag
  search: string
  advanced: AdvancedFilters
  sortPrimary: SortRule
  sortSecondary: SortRule
}

export type ColumnKey =
  | "name"
  | "phone"
  | "orderFrequency"
  | "totalOrders"
  | "totalValue"
  | "unpaidAmount"
  | "lastOrderDate"
  | "status"
