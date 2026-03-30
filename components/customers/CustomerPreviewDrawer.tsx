"use client"

import { useRouter } from "next/navigation"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Mail, Phone, MapPin, User } from "lucide-react"
import type { CustomerRow } from "@/components/customers/types"
import { formatCurrency, formatDate } from "@/components/customers/utils"
import { CUSTOMER_STATUS_CLASS } from "@/components/customers/statusStyles"

interface Props {
  customer: CustomerRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CustomerPreviewDrawer({ customer, open, onOpenChange }: Props) {
  const router = useRouter()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {!customer ? null : (
          <>
            <SheetHeader>
              <SheetTitle>{customer.name}</SheetTitle>
              <SheetDescription>Customer preview</SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-5">
              <div className="rounded-lg border border-sk-border bg-sk-page-bg p-3">
                <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${CUSTOMER_STATUS_CLASS[customer.status]}`}>
                  {customer.status}
                </span>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[11px] text-sk-text-3">Orders</p>
                    <p className="text-lg font-semibold text-sk-text-1">{customer.totalOrders}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-sk-text-3">Value</p>
                    <p className="text-lg font-semibold text-sk-text-1">{formatCurrency(customer.totalValue)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-sk-text-3">Unpaid</p>
                    <p className="text-lg font-semibold text-red-600">{formatCurrency(customer.unpaidAmount)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm text-sk-text-2">
                {customer.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-sk-text-3" />
                    {customer.phone}
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-sk-text-3" />
                    {customer.email}
                  </div>
                )}
                {customer.contactPerson && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-sk-text-3" />
                    {customer.contactPerson}
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-sk-text-3" />
                    {customer.address}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-sk-border p-3 text-sm text-sk-text-2">
                <p className="font-medium text-sk-text-1">Last order date</p>
                <p>{formatDate(customer.lastOrderDate)}</p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="bg-sk-primary text-white hover:bg-sk-primary-dk"
                  onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
                >
                  Open Full Profile
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
