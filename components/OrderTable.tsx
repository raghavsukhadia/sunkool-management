"use client"

import React, { useState, useMemo } from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  ArrowUpDown,
  Eye,
  Edit2,
} from "lucide-react"
import Link from "next/link"

export interface Order {
  id: string
  internal_order_number: string
  sales_order_number?: string
  customer_id: string
  customer?: {
    name: string
    email: string
  }
  order_status: string
  payment_status: string
  total_price: number
  created_at: string
  updated_at: string
}

interface OrderTableProps {
  data: Order[]
  isLoading?: boolean
}

const statusColorMap: Record<string, { bg: string; text: string }> = {
  Pending: { bg: "bg-amber-100", text: "text-amber-700" },
  "In Production": { bg: "bg-blue-100", text: "text-blue-700" },
  "Partial Dispatch": { bg: "bg-cyan-100", text: "text-cyan-700" },
  Dispatched: { bg: "bg-indigo-100", text: "text-indigo-700" },
  Delivered: { bg: "bg-green-100", text: "text-green-700" },
}

const paymentStatusColorMap: Record<string, { bg: string; text: string }> = {
  Pending: { bg: "bg-red-100", text: "text-red-700" },
  "Partial Payment": { bg: "bg-yellow-100", text: "text-yellow-700" },
  Paid: { bg: "bg-green-100", text: "text-green-700" },
}

export function OrderTable({ data, isLoading = false }: OrderTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [paymentFilter, setPaymentFilter] = useState<string>("all")

  const columns: ColumnDef<Order>[] = [
    {
      accessorKey: "internal_order_number",
      header: ({ column }) => (
        <button
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="flex items-center gap-2 font-semibold text-slate-900 hover:text-slate-600"
        >
          Order ID
          <ArrowUpDown className="h-4 w-4" />
        </button>
      ),
      cell: ({ row }) => (
        <span className="font-semibold text-slate-900">
          {row.getValue("internal_order_number")}
        </span>
      ),
    },
    {
      accessorKey: "customer",
      header: "Customer",
      cell: ({ row }) => {
        const customer = row.original.customer
        return (
          <div>
            <div className="font-medium text-slate-900">
              {customer?.name || "N/A"}
            </div>
            <div className="text-xs text-slate-500">{customer?.email}</div>
          </div>
        )
      },
    },
    {
      accessorKey: "sales_order_number",
      header: "Sales Order #",
      cell: ({ row }) => (
        <span className="text-sm text-slate-700">
          {row.getValue("sales_order_number") || "-"}
        </span>
      ),
    },
    {
      accessorKey: "order_status",
      header: ({ column }) => (
        <button
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="flex items-center gap-2 font-semibold text-slate-900"
        >
          Status
          <ArrowUpDown className="h-4 w-4" />
        </button>
      ),
      cell: ({ row }) => {
        const status = row.getValue("order_status") as string
        const colors = statusColorMap[status] || statusColorMap.Pending
        return (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
          >
            {status}
          </span>
        )
      },
    },
    {
      accessorKey: "payment_status",
      header: "Payment",
      cell: ({ row }) => {
        const status = row.getValue("payment_status") as string
        const colors = paymentStatusColorMap[status] || paymentStatusColorMap.Pending
        return (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
          >
            {status}
          </span>
        )
      },
    },
    {
      accessorKey: "total_price",
      header: ({ column }) => (
        <button
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="flex items-center gap-2 font-semibold text-slate-900"
        >
          Amount
          <ArrowUpDown className="h-4 w-4" />
        </button>
      ),
      cell: ({ row }) => (
        <span className="font-medium text-slate-900">
          ₹{(row.getValue("total_price") as number).toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <button
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="flex items-center gap-2 font-semibold text-slate-900"
        >
          Date
          <ArrowUpDown className="h-4 w-4" />
        </button>
      ),
      cell: ({ row }) => (
        <span className="text-sm text-slate-600">
          {new Date(row.getValue("created_at") as string).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/orders/${row.original.id}`}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-slate-100"
            >
              <Eye className="h-4 w-4 text-slate-600" />
            </Button>
          </Link>
          <Link href={`/dashboard/orders/${row.original.id}`}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-slate-100"
            >
              <Edit2 className="h-4 w-4 text-slate-600" />
            </Button>
          </Link>
        </div>
      ),
    },
  ]

  const filteredData = useMemo(() => {
    return data.filter((order) => {
      const matchesGlobalFilter =
        !globalFilter ||
        order.internal_order_number
          .toLowerCase()
          .includes(globalFilter.toLowerCase()) ||
        order.customer?.name
          .toLowerCase()
          .includes(globalFilter.toLowerCase()) ||
        order.customer?.email
          .toLowerCase()
          .includes(globalFilter.toLowerCase())

      const matchesStatus =
        statusFilter === "all" || order.order_status === statusFilter

      const matchesPayment =
        paymentFilter === "all" || order.payment_status === paymentFilter

      return matchesGlobalFilter && matchesStatus && matchesPayment
    })
  }, [data, globalFilter, statusFilter, paymentFilter])

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Global Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Search Order ID, Customer name or email..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-10 h-9 border-slate-200 focus:ring-blue-500"
          />
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40 h-9 border-slate-200">
            <SelectValue placeholder="Filter by Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="In Production">In Production</SelectItem>
            <SelectItem value="Partial Dispatch">Partial Dispatch</SelectItem>
            <SelectItem value="Dispatched">Dispatched</SelectItem>
            <SelectItem value="Delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>

        {/* Payment Filter */}
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-full sm:w-40 h-9 border-slate-200">
            <SelectValue placeholder="Filter by Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Partial Payment">Partial Payment</SelectItem>
            <SelectItem value="Paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading orders...</div>
        ) : filteredData.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No orders found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b border-slate-200 bg-slate-50">
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          className="px-4 py-3 text-left text-xs font-semibold text-slate-900 bg-slate-50"
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      ))}
                    </tr>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={`border-b border-slate-200 hover:bg-slate-50 transition-colors ${
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                      }`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="px-4 py-3">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
              <div className="text-sm text-slate-600">
                Showing{" "}
                <span className="font-semibold">
                  {table.getState().pagination.pageIndex *
                    table.getState().pagination.pageSize +
                    1}
                </span>{" "}
                to{" "}
                <span className="font-semibold">
                  {Math.min(
                    (table.getState().pagination.pageIndex + 1) *
                      table.getState().pagination.pageSize,
                    filteredData.length
                  )}
                </span>{" "}
                of <span className="font-semibold">{filteredData.length}</span>{" "}
                orders
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  variant="outline"
                  size="sm"
                  className="h-8 border-slate-200"
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from(
                    { length: table.getPageCount() },
                    (_, i) => i + 1
                  ).map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() =>
                        table.setPageIndex(pageNum - 1)
                      }
                      className={`h-8 w-8 rounded ${
                        table.getState().pagination.pageIndex === pageNum - 1
                          ? "bg-blue-600 text-white"
                          : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  variant="outline"
                  size="sm"
                  className="h-8 border-slate-200"
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
