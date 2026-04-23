"use client"

import { Button } from "@/components/ui/button"
import { Download, Tag, Trash2, X } from "lucide-react"

interface Props {
  selectedCount: number
  onClear: () => void
  onExport: () => void
  onAddTag: () => void
  onDelete: () => void
}

export function BulkActionsBar({ selectedCount, onClear, onExport, onAddTag, onDelete }: Props) {
  if (selectedCount <= 0) return null

  return (
    <div className="sticky top-[120px] z-30 rounded-xl border border-sk-primary/30 bg-sk-primary-tint p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-sk-primary-dk">{selectedCount} selected</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onExport}>
            <Download className="mr-1.5 h-4 w-4" />
            Export Excel
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onAddTag}>
            <Tag className="mr-1.5 h-4 w-4" />
            Add Tag
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-red-200 text-red-700 hover:bg-red-50"
            onClick={onDelete}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClear}>
            <X className="mr-1.5 h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>
    </div>
  )
}
