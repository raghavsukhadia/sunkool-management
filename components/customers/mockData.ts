import type { CustomerRow, CustomerStatusTag } from "@/components/customers/types"

const STATUSES: CustomerStatusTag[] = [
  "Frequent Buyer",
  "New Customer",
  "Account Overdue",
  "No Orders",
]

function pickStatus(i: number): CustomerStatusTag {
  return STATUSES[i % STATUSES.length]
}

export function generateMockCustomers(count = 180): CustomerRow[] {
  const now = Date.now()
  return Array.from({ length: count }, (_, i) => {
    const idx = i + 1
    const status = pickStatus(i)
    const totalOrders = status === "No Orders" ? 0 : ((idx * 3) % 22) + 1
    const unpaidAmount =
      status === "Account Overdue" ? ((idx * 997) % 88000) + 2000 : 0
    const totalValue = totalOrders * (((idx * 1133) % 17000) + 1800)
    const daysAgo = (idx * 11) % 420

    const tags: CustomerStatusTag[] = []
    if (status === "Frequent Buyer") tags.push("Frequent Buyer")
    if (status === "New Customer") tags.push("New Customer")
    if (status === "Account Overdue") tags.push("Account Overdue")
    if (status === "No Orders") tags.push("No Orders")

    return {
      id: `mock-${idx}`,
      name: `Customer ${idx.toString().padStart(3, "0")}`,
      phone: idx % 7 === 0 ? null : `9${((700000000 + idx * 1297) % 1000000000).toString().padStart(9, "0")}`,
      email: idx % 5 === 0 ? null : `customer${idx}@example.com`,
      totalOrders,
      totalValue,
      unpaidAmount,
      lastOrderDate: totalOrders === 0 ? null : new Date(now - daysAgo * 86400000).toISOString(),
      status,
      statusTags: tags,
      extraTags: [],
      createdAt: new Date(now - ((idx * 19) % 520) * 86400000).toISOString(),
      address: `Sector ${((idx * 7) % 25) + 1}, Delhi`,
      contactPerson: idx % 4 === 0 ? `Manager ${idx}` : null,
      notes: idx % 6 === 0 ? "Prefers early delivery window." : null,
    }
  })
}
