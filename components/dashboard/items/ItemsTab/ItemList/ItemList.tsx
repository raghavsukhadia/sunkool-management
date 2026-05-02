"use client"

import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react"
import { ChevronsDown, ChevronsUp, Eye, ListTree, Package } from "lucide-react"
import type { ItemSummary } from "@/app/actions/items"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export function ItemList({
  items,
  selectedItemKey,
  selectedItemName,
  onSelect,
  expanded,
  onExpandedChange,
}: {
  items: ItemSummary[]
  selectedItemKey: string | null
  selectedItemName: string | null
  onSelect: (itemKey: string) => void
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
}) {
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = [...items]
    if (q) {
      list = list.filter((item) => item.item_name.toLowerCase().includes(q))
    }

    list.sort((a, b) => a.item_name.localeCompare(b.item_name))

    return list
  }, [items, search])

  function activate(itemKey: string) {
    onSelect(itemKey)
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLDivElement>, itemKey: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      activate(itemKey)
    }
  }

  function handleViewClick(event: MouseEvent<HTMLButtonElement>, itemKey: string) {
    event.stopPropagation()
    activate(itemKey)
  }

  const displayName = selectedItemName ?? "No item selected"

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          "w-full max-w-full self-start",
          expanded ? "rounded-2xl border border-sk-border bg-white p-3 shadow-sm" : "rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-100"
        )}
      >
        {!expanded ? (
          <div>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sk-primary">
                <Package className="h-[18px] w-[18px]" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Item catalog</p>
                <p className="mt-1.5 truncate text-sm font-semibold leading-snug text-sk-text-1" title={displayName}>
                  {displayName}
                </p>
                <p className="mt-1 text-xs tabular-nums text-sk-text-3">
                  {items.length} {items.length === 1 ? "item" : "items"}
                  {search.trim() ? ` · ${filtered.length} filtered` : ""}
                </p>
              </div>
            </div>
            <Button
              type="button"
              className="mt-3 h-9 w-full gap-2 bg-sk-primary text-sm font-medium text-primary-foreground shadow-sm hover:bg-sk-primary-dk"
              onClick={() => onExpandedChange(true)}
            >
              <ChevronsDown className="h-4 w-4 shrink-0 opacity-90" />
              Expand catalog
            </Button>
            <p className="mt-2 text-center text-[10px] leading-snug text-slate-500">
              Minimized · expand to switch item or search.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-2">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name"
                className="h-10 min-w-0 flex-1 border-sk-border bg-slate-50/80 text-sm text-sk-text-1 placeholder:text-sk-text-3 focus-visible:bg-white"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0 border-slate-300 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-sk-primary"
                    onClick={() => onExpandedChange(false)}
                    aria-label="Hide items list"
                  >
                    <ChevronsUp className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[220px] text-xs">
                  Hide list — more room for item actions and details
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="overflow-hidden rounded-xl border-2 border-slate-300/90 bg-white shadow-inner">
              <div className="flex items-center justify-between border-b-2 border-slate-400 bg-gradient-to-b from-slate-100 to-slate-200/70 px-3 py-3 shadow-sm sm:px-4">
                <div className="flex min-w-0 items-center gap-2">
                  <ListTree className="h-4 w-4 shrink-0 text-slate-500" />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Items</p>
                  <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600 ring-1 ring-slate-200">
                    {items.length}
                  </span>
                </div>
              </div>

              <div className="max-h-[min(50vh,26rem)] overflow-y-auto overscroll-contain bg-white xl:max-h-[min(36vh,22rem)]">
                <ul className="divide-y divide-slate-200">
                  {filtered.map((item, index) => {
                    const isSelected = selectedItemKey === item.item_key
                    return (
                      <li key={item.item_key}>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSelected}
                          onClick={() => activate(item.item_key)}
                          onKeyDown={(event) => handleRowKeyDown(event, item.item_key)}
                          className={cn(
                            "flex min-h-[3.75rem] items-center gap-4 px-4 py-4 text-left transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sk-primary/35",
                            index % 2 === 1 ? "bg-slate-50/80" : "bg-white",
                            isSelected
                              ? "border-l-[3px] border-l-sk-primary bg-sk-primary/[0.08] hover:bg-sk-primary/[0.11]"
                              : "border-l-[3px] border-l-transparent hover:bg-slate-100/90"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold leading-relaxed text-sk-text-1 sm:text-[15px]">
                              {item.item_name}
                            </p>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 shrink-0 rounded-lg border-slate-300 bg-white text-slate-600 shadow-sm hover:border-sk-primary hover:bg-sk-primary/10 hover:text-sk-primary"
                                onClick={(event) => handleViewClick(event, item.item_key)}
                                aria-label={`View ${item.item_name}`}
                              >
                                <Eye className="h-4 w-4" strokeWidth={2.25} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-xs">
                              View item
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                {filtered.length === 0 ? (
                  <div className="space-y-2 border-t border-slate-200 bg-white px-4 py-10 text-center">
                    {items.length === 0 ? (
                      <>
                        <p className="text-sm font-medium text-sk-text-1">No item data available yet</p>
                        <p className="text-xs text-sk-text-3">Items appear here once orders are created with product or inventory links.</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-sk-text-1">No items match your search</p>
                        <p className="text-xs text-sk-text-3">Clear the search box to view all items.</p>
                        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSearch("")}>
                          Clear search
                        </Button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        )}
      </aside>
    </TooltipProvider>
  )
}
