"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { reportError } from "@/lib/monitoring"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportError(error, { area: "app.globalError" })
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-sk-border bg-sk-card-bg p-6 text-center">
        <h2 className="text-lg font-semibold text-sk-text-1">Something went wrong</h2>
        <p className="mt-2 text-sm text-sk-text-2">
          We hit an unexpected issue. Please try again.
        </p>
        <div className="mt-4">
          <Button onClick={() => reset()} className="bg-sk-primary text-white hover:bg-sk-primary-dk">
            Try again
          </Button>
        </div>
      </div>
    </div>
  )
}
