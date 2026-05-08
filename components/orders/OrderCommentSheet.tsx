"use client"

import { useState } from "react"
import { MessageSquare } from "lucide-react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { OrderCommentSection } from "@/components/orders/OrderCommentSection"

interface OrderCommentSheetProps {
  orderId: string
  commentCount: number
  onCountChange: (count: number) => void
  /** Controlled open state — lets parent open the sheet programmatically */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function OrderCommentSheet({
  orderId,
  commentCount,
  onCountChange,
  open: controlledOpen,
  onOpenChange,
}: OrderCommentSheetProps) {
  const [internalOpen, setInternalOpen] = useState(false)

  const open = controlledOpen ?? internalOpen
  const setOpen = (v: boolean) => {
    setInternalOpen(v)
    onOpenChange?.(v)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Trigger button — mirrors TimelineDrawer button style */}
      <button
        onClick={() => setOpen(true)}
        title="Remarks"
        className="relative flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:text-orange-700 hover:border-orange-300 hover:bg-orange-50 transition-colors text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Remarks</span>
        {commentCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-orange-500 text-white leading-none">
            {commentCount > 99 ? "99+" : commentCount}
          </span>
        )}
      </button>

      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 sm:max-w-[560px] border-l border-slate-200"
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-slate-100 bg-white">
          <div className="flex items-start justify-between pl-5 pr-14 pt-5 pb-3">
            <div className="min-w-0">
              <SheetTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <MessageSquare className="h-4 w-4 text-orange-500 flex-shrink-0" />
                Remarks
              </SheetTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                {commentCount > 0
                  ? `${commentCount} remark${commentCount !== 1 ? "s" : ""}`
                  : "No remarks yet"}
              </p>
            </div>
          </div>
        </div>

        {/* Always mounted so data is pre-fetched before the sheet opens */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-4">
            <OrderCommentSection orderId={orderId} onCountChange={onCountChange} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
