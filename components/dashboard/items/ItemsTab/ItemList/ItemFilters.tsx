"use client"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type StockFilter = "all" | "in_stock" | "low_stock" | "out_of_stock"
export type OrderFilter = "all" | "has_pending_orders" | "fully_dispatched"
export type SortBy = "name" | "stock_level" | "pending_orders"

export function ItemFilters({
  search,
  stockFilter,
  orderFilter,
  sortBy,
  onSearchChange,
  onStockFilterChange,
  onOrderFilterChange,
  onSortByChange,
}: {
  search: string
  stockFilter: StockFilter
  orderFilter: OrderFilter
  sortBy: SortBy
  onSearchChange: (value: string) => void
  onStockFilterChange: (value: StockFilter) => void
  onOrderFilterChange: (value: OrderFilter) => void
  onSortByChange: (value: SortBy) => void
}) {
  return (
    <div className="space-y-2">
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search by name or SKU"
        className="h-9 text-xs"
      />
      <div className="grid grid-cols-1 gap-2">
        <Select value={stockFilter} onValueChange={(value) => onStockFilterChange(value as StockFilter)}>
          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Stock" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stock states</SelectItem>
            <SelectItem value="in_stock">In stock</SelectItem>
            <SelectItem value="low_stock">Low stock</SelectItem>
            <SelectItem value="out_of_stock">Out of stock</SelectItem>
          </SelectContent>
        </Select>
        <Select value={orderFilter} onValueChange={(value) => onOrderFilterChange(value as OrderFilter)}>
          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Orders" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All order states</SelectItem>
            <SelectItem value="has_pending_orders">Has pending orders</SelectItem>
            <SelectItem value="fully_dispatched">Fully dispatched</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(value) => onSortByChange(value as SortBy)}>
          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Sort by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="stock_level">Stock level</SelectItem>
            <SelectItem value="pending_orders">Pending orders</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
