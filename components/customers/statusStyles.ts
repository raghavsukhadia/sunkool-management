import type { CustomerStatusTag } from "@/components/customers/types"

export const CUSTOMER_STATUS_CLASS: Record<CustomerStatusTag, string> = {
  "Frequent Buyer": "border-blue-200 bg-blue-50 text-blue-700",
  "New Customer": "border-violet-200 bg-violet-50 text-violet-700",
  "Account Overdue": "border-red-200 bg-red-50 text-red-700",
  "No Orders": "border-slate-200 bg-slate-100 text-slate-700",
}