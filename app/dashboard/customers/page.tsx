"use client"

import { CustomerManagementTable } from "@/components/customers/CustomerManagementTable"

export default function CustomersPage() {
  return <CustomerManagementTable enableVirtualization={false} />
}
