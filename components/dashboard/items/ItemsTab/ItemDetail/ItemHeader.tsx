"use client"

import { useState } from "react"
import type { ItemSummary } from "@/app/actions/items"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function ItemHeader({ item }: { item: ItemSummary }) {
  const [editing, setEditing] = useState(false)
  const [description, setDescription] = useState(item.description ?? "")

  return (
    <section className="rounded-xl border border-sk-border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-sk-text-1">{item.item_name}</h2>
          {item.item_sku ? <p className="text-xs text-sk-text-3">SKU: {item.item_sku}</p> : null}
        </div>
        {item.item_category ? <Badge variant="outline">{item.item_category}</Badge> : null}
      </div>
      <div className="mt-3">
        {!editing ? (
          <button
            type="button"
            className="w-full rounded-lg border border-dashed border-sk-border p-2 text-left text-xs text-sk-text-3"
            onClick={() => setEditing(true)}
          >
            {description || "Click to add item description"}
          </button>
        ) : (
          <div className="space-y-2">
            <Input value={description} onChange={(event) => setDescription(event.target.value)} className="h-9 text-xs" />
            <div className="flex gap-2">
              <Button size="sm" className="h-8 text-xs" onClick={() => setEditing(false)}>Save</Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
