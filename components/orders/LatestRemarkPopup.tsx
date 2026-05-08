"use client"

import { useState, useEffect } from "react"
import { X, MessageSquare } from "lucide-react"
import { getOrderComments } from "@/app/actions/comments"

interface LatestRemarkPopupProps {
  orderId: string
  /** Called when user clicks the "View remarks" button — should open the remarks sheet */
  onOpen?: () => void
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function LatestRemarkPopup({ orderId, onOpen }: LatestRemarkPopupProps) {
  const [visible, setVisible] = useState(false)
  const [remark, setRemark] = useState<{
    content: string
    author: string
    createdAt: string
  } | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const result = await getOrderComments(orderId)
      if (cancelled || !result.success || !result.data) return

      // Find the latest remark that has real text (not a pure-attachment placeholder)
      const textRemarks = (result.data as any[])
        .filter((c) => c.content && c.content !== "📎 Attachment")
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )

      if (textRemarks.length === 0) return

      const latest = textRemarks[0]
      setRemark({
        content: latest.content,
        author:
          latest.profiles?.full_name ||
          latest.profiles?.email ||
          "Unknown",
        createdAt: latest.created_at,
      })
      setVisible(true)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [orderId])

  if (!visible || !remark) return null

  const truncated =
    remark.content.length > 220
      ? remark.content.slice(0, 220).trimEnd() + "…"
      : remark.content

  return (
    <div className="fixed top-5 right-5 z-50 w-[320px] max-w-[calc(100vw-2.5rem)] rounded-xl border border-orange-200 bg-white shadow-xl animate-in slide-in-from-top-3 fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Latest Remark
          </span>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="text-slate-400 hover:text-slate-600 transition-colors rounded-md p-0.5 hover:bg-slate-100"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
          {truncated}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {remark.author} · {timeAgo(remark.createdAt)}
          </span>
          {onOpen && (
            <button
              onClick={() => {
                setVisible(false)
                onOpen()
              }}
              className="text-xs font-medium text-orange-500 hover:text-orange-700 transition-colors"
            >
              View all →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
