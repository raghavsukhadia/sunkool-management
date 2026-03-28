"use client"

import { useMemo, useState } from "react"
import { Check, ChevronDown, Search, Users } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface CustomerOption {
  id: string
  name: string
}

interface CustomerFilterDropdownProps {
  customers: CustomerOption[]
  value: "all" | string
  onChange: (customerId: "all" | string) => void
  className?: string
  id?: string
}

export function CustomerFilterDropdown({
  customers,
  value,
  onChange,
  className,
  id,
}: CustomerFilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const selectedLabel = useMemo(() => {
    if (value === "all") return "All customers"
    const c = customers.find((x) => x.id === value)
    return c?.name ?? "Customer"
  }, [value, customers])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) => c.name.toLowerCase().includes(q))
  }, [customers, query])

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            "h-10 w-full justify-between border-sk-border bg-white px-3 font-normal text-sk-text-1 hover:bg-sk-page-bg focus-visible:ring-sk-primary",
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Users className="h-4 w-4 shrink-0 text-sk-text-3" aria-hidden />
            <span className="truncate text-left">{selectedLabel}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[16rem] max-w-[calc(100vw-2rem)] border-sk-border p-0"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b border-sk-border p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sk-text-3" />
            <Input
              placeholder="Search customers…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 border-sk-border bg-white pl-8 text-sm focus-visible:ring-sk-primary"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>
        <div className="max-h-[min(280px,50vh)] overflow-y-auto p-1">
          <DropdownMenuItem
            className="cursor-pointer gap-2 rounded-md"
            onSelect={() => {
              onChange("all")
              setQuery("")
              setOpen(false)
            }}
          >
            <span className="flex-1">All customers</span>
            {value === "all" && <Check className="h-4 w-4 shrink-0 text-sk-primary" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {filtered.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-sk-text-2">No matches</div>
          ) : (
            filtered.map((c) => (
              <DropdownMenuItem
                key={c.id}
                className="cursor-pointer gap-2 rounded-md"
                onSelect={() => {
                  onChange(c.id)
                  setQuery("")
                  setOpen(false)
                }}
              >
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                {value === c.id && <Check className="h-4 w-4 shrink-0 text-sk-primary" />}
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
