import type { ItemMatchReason } from "@/app/actions/items"

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

export function formatRelativeDate(value: string | null) {
  if (!value) return "—"
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 30) return `${days}d ago`
  return formatDate(value)
}

export function getDispatchTag(totalDispatched: number, totalRemaining: number) {
  if (totalRemaining === 0 && totalDispatched > 0) {
    return {
      label: "All Sent",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    }
  }
  if (totalDispatched > 0 && totalRemaining > 0) {
    return {
      label: `${totalRemaining} left`,
      className: "border-blue-200 bg-blue-50 text-blue-700",
    }
  }
  return {
    label: "Pending",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  }
}

export function getMatchReasonLabel(reason: ItemMatchReason) {
  if (reason === "item") return "name"
  if (reason === "sku") return "SKU"
  if (reason === "category") return "category"
  if (reason === "customer") return "customer"
  return "order #"
}
