"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { reportError } from "@/lib/monitoring"

export default function OrdersError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportError(error, { area: "app.ordersError" })
  }, [error])

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-sk-border bg-sk-card-bg p-6 text-center">
        <h2 className="text-lg font-semibold text-sk-text-1">Orders page hit an issue</h2>
        <p className="mt-2 text-sm text-sk-text-2">
          We could not complete this request right now.
        </p>
        <div className="mt-4">
          <Button onClick={() => reset()} className="bg-sk-primary text-white hover:bg-sk-primary-dk">
            Retry
          </Button>
        </div>
      </div>
    </div>
  )
}
