"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  getInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem
} from "@/app/actions/management"
import { 
  Plus, 
  Trash2, 
  Edit2,
  Package, 
  Search,
  Download,
  X,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Filter,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

interface SubItem {
  id: string
  item_name: string
  date: string | null
  created_at: string
  parent_item_id: string
}

interface InventoryItem {
  id: string
  sr_no: number | null
  item_name: string
  date: string | null
  parent_item_id: string | null
  created_at?: string
  sub_items?: SubItem[]
}

export default function ProductsPage() {
  const router = useRouter()
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [showSubItemForm, setShowSubItemForm] = useState<string | null>(null)
  const [showSearchPanel, setShowSearchPanel] = useState(true)
  const [searchSheetOpen, setSearchSheetOpen] = useState(false)
  const [addFormSheetOpen, setAddFormSheetOpen] = useState(false)
  const [sortBy, setSortBy] = useState<"name" | "sr_no" | "date" | "created_at">("sr_no")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  // Inventory form state
  const [inventoryForm, setInventoryForm] = useState({
    item_name: "",
    date: new Date().toISOString().split('T')[0],
  })

  // Sub-item form state
  const [subItemForm, setSubItemForm] = useState({
    item_name: "",
    date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    loadInventoryItems()
  }, [])

  const loadInventoryItems = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getInventoryItems()
      if (result.success && result.data) {
        setInventoryItems(result.data as InventoryItem[])
      } else {
        setError(result.error || "Failed to load inventory")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleInventorySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!inventoryForm.item_name.trim()) {
      setError("Item name is required")
      return
    }

    try {
      const result = editingItem
        ? await updateInventoryItem(editingItem.id, {
            item_name: inventoryForm.item_name.trim(),
            date: inventoryForm.date || undefined,
          })
        : await createInventoryItem({
            item_name: inventoryForm.item_name.trim(),
            date: inventoryForm.date || undefined,
          })

      if (result.success) {
        setSuccess(editingItem ? "Item updated successfully!" : "Item added successfully!")
        setInventoryForm({ item_name: "", date: new Date().toISOString().split('T')[0] })
        setEditingItem(null)
        setShowAddForm(false)
        setAddFormSheetOpen(false)
        await loadInventoryItems()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error || "Failed to save item")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    }
  }

  const handleSubItemSubmit = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!subItemForm.item_name.trim()) {
      setError("Item name is required")
      return
    }

    try {
      const result = await createInventoryItem({
        item_name: subItemForm.item_name.trim(),
        date: subItemForm.date || undefined,
        parent_item_id: parentId,
      })

      if (result.success) {
        setSuccess("Sub-item added successfully!")
        setSubItemForm({ item_name: "", date: new Date().toISOString().split('T')[0] })
        setShowSubItemForm(null)
        await loadInventoryItems()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error || "Failed to add sub-item")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return

    setError(null)
    try {
      const result = await deleteInventoryItem(id)
      if (result.success) {
        setSuccess("Item deleted successfully!")
        await loadInventoryItems()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error || "Failed to delete item")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    }
  }

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item)
    setInventoryForm({
      item_name: item.item_name,
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    })
    setShowAddForm(true)
    if (typeof window !== "undefined" && window.innerWidth < 1024) setAddFormSheetOpen(true)
  }

  const toggleExpand = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const handleExport = () => {
    const csv = [
      ["Sr No", "Date", "Item Name"].join(","),
      ...inventoryItems.map(item => 
        `"${item.sr_no || ""}","${item.date || ""}","${item.item_name}"`
      )
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `inventory-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Comprehensive search and sort logic
  const filteredAndSortedInventory = (() => {
    let filtered = inventoryItems

    // Search: Check both items and sub-items
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = inventoryItems.filter(item => {
        // Check parent item
        const matchesParent = 
          item.item_name.toLowerCase().includes(term) ||
          (item.sr_no && item.sr_no.toString().includes(term)) ||
          (item.date && new Date(item.date).toLocaleDateString().toLowerCase().includes(term))
        
        // Check sub-items
        const matchesSubItems = item.sub_items?.some(subItem =>
          subItem.item_name.toLowerCase().includes(term) ||
          (subItem.date && new Date(subItem.date).toLocaleDateString().toLowerCase().includes(term))
        )
        
        return matchesParent || matchesSubItems
      })
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any
      let bVal: any

      switch (sortBy) {
        case "name":
          aVal = a.item_name.toLowerCase()
          bVal = b.item_name.toLowerCase()
          break
        case "sr_no":
          aVal = a.sr_no ?? 999999 // Put items without serial numbers at the end
          bVal = b.sr_no ?? 999999
          break
        case "date":
          aVal = a.date ? new Date(a.date).getTime() : 0
          bVal = b.date ? new Date(b.date).getTime() : 0
          break
        case "created_at":
          aVal = new Date(a.created_at || 0).getTime()
          bVal = new Date(b.created_at || 0).getTime()
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1
      return 0
    })

    return filtered
  })()

  const openAddForm = () => {
    setShowAddForm(true)
    setEditingItem(null)
    setInventoryForm({ item_name: "", date: new Date().toISOString().split('T')[0] })
    setAddFormSheetOpen(true)
  }

  const closeAddForm = () => {
    setShowAddForm(false)
    setEditingItem(null)
    setAddFormSheetOpen(false)
  }

  return (
    <div className="space-y-4 lg:space-y-6 pb-8">
      {/* Header Section - compact on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 lg:mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 min-h-[44px] lg:min-h-0"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Inventory Management</h1>
          <p className="text-gray-600 mt-1.5 text-sm">Manage your inventory items, master rolls, and stock levels efficiently</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            className="flex items-center gap-2 border-gray-300 hover:bg-gray-50 min-h-[44px]"
          >
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button
            onClick={() => {
              setShowAddForm(true)
              setEditingItem(null)
              setInventoryForm({ item_name: "", date: new Date().toISOString().split('T')[0] })
            }}
            className="hidden lg:inline-flex flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </Button>
          <Sheet open={addFormSheetOpen} onOpenChange={(o) => { setAddFormSheetOpen(o); if (!o) { setShowAddForm(false); setEditingItem(null) } }}>
            <SheetTrigger asChild className="lg:hidden">
              <Button
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm min-h-[44px]"
                onClick={() => openAddForm()}
              >
                <Plus className="w-4 h-4" />
                Add Item
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{editingItem ? "Edit Item" : "Add Inventory Item"}</SheetTitle>
                <SheetDescription className="sr-only">Item name and date</SheetDescription>
              </SheetHeader>
              <div className="mt-4">
                <form onSubmit={handleInventorySubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="mobile_item_name">Item Name *</Label>
                    <Input
                      id="mobile_item_name"
                      value={inventoryForm.item_name}
                      onChange={(e) => setInventoryForm({ ...inventoryForm, item_name: e.target.value })}
                      placeholder="Enter item name"
                      required
                      className="min-h-[44px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mobile_date">Date</Label>
                    <Input
                      id="mobile_date"
                      type="date"
                      value={inventoryForm.date}
                      onChange={(e) => setInventoryForm({ ...inventoryForm, date: e.target.value })}
                      className="min-h-[44px]"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" className="flex-1 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white">
                      {editingItem ? "Update" : "Add Item"}
                    </Button>
                    <Button type="button" variant="outline" onClick={closeAddForm} className="min-h-[44px]">
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-50 border-l-4 border-red-500 rounded-r-md flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="p-4 text-sm text-green-700 bg-green-50 border-l-4 border-green-500 rounded-r-md flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
            <span className="font-medium">{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add/Edit Item Form - desktop only; mobile uses sheet */}
      {showAddForm && (
        <Card className="hidden lg:block border-2 border-blue-100 shadow-md">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold text-gray-900">
                  {editingItem ? "Edit Inventory Item" : "Add New Inventory Item"}
                </CardTitle>
                <CardDescription className="mt-1">
                  {editingItem ? "Update item information below" : "Enter item information below. Serial number will be auto-generated."}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddForm(false)
                  setEditingItem(null)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleInventorySubmit} className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="item_name" className="text-sm font-semibold text-gray-700">
                    Item Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="item_name"
                    value={inventoryForm.item_name}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, item_name: e.target.value })}
                    placeholder="Enter item name"
                    required
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-sm font-semibold text-gray-700">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={inventoryForm.date}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, date: e.target.value })}
                    className="h-10"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t">
                <Button 
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                >
                  {editingItem ? "Update Item" : "Add Item"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowAddForm(false)
                    setEditingItem(null)
                  }}
                  className="border-gray-300"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Mobile: Search & Sort sheet trigger */}
      <div className="lg:hidden flex justify-end">
        <Sheet open={searchSheetOpen} onOpenChange={setSearchSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2 min-h-[44px] border-gray-300">
              <Filter className="w-4 h-4" />
              Search & Sort
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[75vh] rounded-t-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Search & Sort</SheetTitle>
              <SheetDescription>Filter and sort inventory items</SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by name, serial no, or date..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-10 min-h-[44px]"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                    title="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sort by</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["sr_no", "name", "date", "created_at"] as const).map((field) => (
                    <Button
                      key={field}
                      variant={sortBy === field ? "default" : "outline"}
                      size="sm"
                      className="min-h-[44px]"
                      onClick={() => { setSortBy(field); setSortDirection(sortDirection === "asc" ? "desc" : "asc") }}
                    >
                      {field === "sr_no" ? "Serial" : field === "created_at" ? "Created" : field}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full min-h-[44px]"
                  onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                >
                  {sortDirection === "asc" ? <ArrowUp className="w-4 h-4 mr-1" /> : <ArrowDown className="w-4 h-4 mr-1" />}
                  {sortDirection === "asc" ? "Ascending" : "Descending"}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="text-xl font-bold text-blue-700">{filteredAndSortedInventory.length}</div>
                  <div className="text-xs font-medium text-gray-600">Items</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
                  <div className="text-xl font-bold text-green-700">
                    {filteredAndSortedInventory.reduce((sum, item) => sum + (item.sub_items?.length || 0), 0)}
                  </div>
                  <div className="text-xs font-medium text-gray-600">Sub-Items</div>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Advanced Search & Sort Panel - desktop only */}
      <Card className="hidden lg:block shadow-sm">
        <CardHeader className="pb-4 bg-gray-50 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-blue-100 rounded-md">
                <Filter className="w-4 h-4 text-blue-600" />
              </div>
              <CardTitle className="text-lg font-semibold text-gray-900">Search & Sort</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSearchPanel(!showSearchPanel)}
              className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              {showSearchPanel ? "Hide" : "Show"} Options
              {showSearchPanel ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search items and sub-items by name, serial number, or date..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10 h-11 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Advanced Options */}
          {showSearchPanel && (
            <div className="pt-5 border-t border-gray-200 space-y-5">
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4 pt-3">
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                  <div className="text-3xl font-bold text-blue-700">{filteredAndSortedInventory.length}</div>
                  <div className="text-xs font-medium text-gray-600 mt-1.5">Total Items</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-100">
                  <div className="text-3xl font-bold text-green-700">
                    {filteredAndSortedInventory.reduce((sum, item) => sum + (item.sub_items?.length || 0), 0)}
                  </div>
                  <div className="text-xs font-medium text-gray-600 mt-1.5">Sub-Items</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-100">
                  <div className="text-lg font-bold text-purple-700 mt-1">
                    {searchTerm ? "Filtered" : "All"}
                  </div>
                  <div className="text-xs font-medium text-gray-600 mt-1.5">View Status</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card className="shadow-sm">
        <CardHeader className="bg-gray-50 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2.5 text-lg font-semibold text-gray-900">
                <div className="p-1.5 bg-blue-100 rounded-md">
                  <Package className="w-4 h-4 text-blue-600" />
                </div>
                Inventory Items
                <span className="text-sm font-normal text-gray-500 ml-1">
                  ({filteredAndSortedInventory.length})
                </span>
              </CardTitle>
              <CardDescription className="mt-1.5">View and manage all your inventory items</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
              <p className="text-sm">Loading inventory...</p>
            </div>
          ) : filteredAndSortedInventory.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                {searchTerm ? "No items or sub-items found matching your search." : "No inventory items yet."}
              </p>
              {!searchTerm && (
                <p className="text-sm text-gray-400 mt-1">Add your first item or import from Excel to get started.</p>
              )}
            </div>
          ) : (
            <>
              {/* Mobile card list */}
              <div className="lg:hidden p-4 space-y-3">
                {filteredAndSortedInventory.map((item) => {
                  const isExpanded = expandedItems.has(item.id)
                  const subCount = item.sub_items?.length ?? 0
                  return (
                    <Card key={item.id} className="border shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium text-gray-500">#{item.sr_no ?? "-"}</span>
                              <span className="text-sm font-medium text-gray-900">{item.item_name}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {item.date ? new Date(item.date).toLocaleDateString() : "No date"}
                            </p>
                            {subCount > 0 && (
                              <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {subCount} sub-item{subCount !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 min-h-[44px] min-w-[44px]" onClick={() => handleEdit(item)} title="Edit"><Edit2 className="w-4 h-4 text-blue-600" /></Button>
                            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 min-h-[44px] min-w-[44px]" onClick={() => handleDelete(item.id)} title="Delete"><Trash2 className="w-4 h-4 text-red-600" /></Button>
                            {subCount > 0 && (
                              <Button variant="ghost" size="sm" className="h-9 w-9 p-0 min-h-[44px] min-w-[44px]" onClick={() => toggleExpand(item.id)} title={isExpanded ? "Collapse" : "Expand"}>
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </Button>
                            )}
                          </div>
                        </div>
                        {isExpanded && item.sub_items && item.sub_items.length > 0 && (
                          <div className="mt-3 pt-3 border-t space-y-2">
                            {item.sub_items.map((sub) => (
                              <div key={sub.id} className="flex items-center justify-between gap-2 py-2 px-3 bg-gray-50 rounded-md">
                                <div>
                                  <span className="text-sm font-medium text-gray-900">{sub.item_name}</span>
                                  <span className="text-xs text-gray-500 ml-2">{sub.date ? new Date(sub.date).toLocaleDateString() : ""}</span>
                                </div>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 min-h-[44px] min-w-[44px] text-red-600" onClick={() => handleDelete(sub.id)} title="Delete"><Trash2 className="w-3.5 h-3.5" /></Button>
                              </div>
                            ))}
                            <Button variant="outline" size="sm" className="w-full border-green-300 text-green-700 min-h-[44px]" onClick={() => { setShowSubItemForm(item.id); setSubItemForm({ item_name: "", date: new Date().toISOString().split("T")[0] }) }}>
                              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Sub-Item
                            </Button>
                            {showSubItemForm === item.id && (
                              <form onSubmit={(e) => handleSubItemSubmit(e, item.id)} className="space-y-2 p-3 bg-white border rounded-md">
                                <Input value={subItemForm.item_name} onChange={(e) => setSubItemForm({ ...subItemForm, item_name: e.target.value })} placeholder="Sub-item name" required className="min-h-[44px]" />
                                <Input type="date" value={subItemForm.date} onChange={(e) => setSubItemForm({ ...subItemForm, date: e.target.value })} className="min-h-[44px]" />
                                <div className="flex gap-2">
                                  <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700 min-h-[44px]">Add</Button>
                                  <Button type="button" variant="outline" size="sm" className="min-h-[44px]" onClick={() => setShowSubItemForm(null)}>Cancel</Button>
                                </div>
                              </form>
                            )}
                          </div>
                        )}
                        {!isExpanded && subCount === 0 && (
                          <div className="mt-2">
                            <Button variant="outline" size="sm" className="w-full border-green-300 text-green-700 min-h-[44px]" onClick={() => { setShowSubItemForm(item.id); setSubItemForm({ item_name: "", date: new Date().toISOString().split("T")[0] }) }}>
                              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Sub-Item
                            </Button>
                            {showSubItemForm === item.id && (
                              <form onSubmit={(e) => handleSubItemSubmit(e, item.id)} className="mt-2 space-y-2 p-3 bg-gray-50 rounded-md">
                                <Input value={subItemForm.item_name} onChange={(e) => setSubItemForm({ ...subItemForm, item_name: e.target.value })} placeholder="Sub-item name" required className="min-h-[44px]" />
                                <Input type="date" value={subItemForm.date} onChange={(e) => setSubItemForm({ ...subItemForm, date: e.target.value })} className="min-h-[44px]" />
                                <div className="flex gap-2">
                                  <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700 min-h-[44px]">Add</Button>
                                  <Button type="button" variant="outline" size="sm" className="min-h-[44px]" onClick={() => setShowSubItemForm(null)}>Cancel</Button>
                                </div>
                              </form>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
              {/* Desktop table */}
              <div className="hidden lg:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50/50">
                    <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider w-12"></th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">
                      <button
                        onClick={() => {
                          if (sortBy === "sr_no") {
                            setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                          } else {
                            setSortBy("sr_no")
                            setSortDirection("asc")
                          }
                        }}
                        className="flex items-center gap-1.5 hover:text-gray-900 transition-colors group"
                      >
                        Serial No
                        {sortBy === "sr_no" ? (
                          sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
                        )}
                      </button>
                    </th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">
                      <button
                        onClick={() => {
                          if (sortBy === "date") {
                            setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                          } else {
                            setSortBy("date")
                            setSortDirection("desc")
                          }
                        }}
                        className="flex items-center gap-1.5 hover:text-gray-900 transition-colors group"
                      >
                        Date
                        {sortBy === "date" ? (
                          sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
                        )}
                      </button>
                    </th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">
                      <button
                        onClick={() => {
                          if (sortBy === "name") {
                            setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                          } else {
                            setSortBy("name")
                            setSortDirection("asc")
                          }
                        }}
                        className="flex items-center gap-1.5 hover:text-gray-900 transition-colors group"
                      >
                        Item Name
                        {sortBy === "name" ? (
                          sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
                        )}
                      </button>
                    </th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedInventory.map((item) => {
                    const isExpanded = expandedItems.has(item.id)
                    const hasSubItems = item.sub_items && item.sub_items.length > 0
                    
                    return (
                      <React.Fragment key={item.id}>
                        <tr className="border-b hover:bg-blue-50/30 transition-colors">
                          <td className="p-4">
                            {hasSubItems ? (
                              <button
                                onClick={() => toggleExpand(item.id)}
                                className="p-1.5 hover:bg-blue-100 rounded-md transition-colors"
                                title={isExpanded ? "Collapse sub-items" : "Expand sub-items"}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-blue-600" />
                                )}
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setShowSubItemForm(item.id)
                                  setSubItemForm({ item_name: "", date: new Date().toISOString().split('T')[0] })
                                }}
                                className="p-1.5 hover:bg-green-100 rounded-md transition-colors"
                                title="Add sub-item"
                              >
                                <Plus className="w-4 h-4 text-green-600" />
                              </button>
                            )}
                          </td>
                          <td className="p-4">
                            <span className="text-sm font-semibold text-gray-900">{item.sr_no || "-"}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm text-gray-600">
                              {item.date ? new Date(item.date).toLocaleDateString() : "-"}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm font-medium text-gray-900">{item.item_name}</span>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(item)}
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                                title="Edit item"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(item.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                                title="Delete item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {/* Sub-items row */}
                        {isExpanded && hasSubItems && (
                          <tr>
                            <td colSpan={5} className="p-0">
                              <div className="bg-gray-50 pl-8">
                                <div className="px-4 py-3">
                                  <table className="w-full">
                                    <thead>
                                      <tr className="border-b bg-gray-100/80">
                                        <th className="text-left p-3 font-semibold text-xs text-gray-600 uppercase tracking-wider w-12"></th>
                                        <th className="text-left p-3 font-semibold text-xs text-gray-600 uppercase tracking-wider">Date</th>
                                        <th className="text-left p-3 font-semibold text-xs text-gray-600 uppercase tracking-wider">Sub Item</th>
                                        <th className="text-left p-3 font-semibold text-xs text-gray-600 uppercase tracking-wider">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {item.sub_items?.map((subItem) => (
                                        <tr key={subItem.id} className="border-b hover:bg-gray-50 transition-colors">
                                          <td className="p-3"></td>
                                          <td className="p-3">
                                            <span className="text-xs text-gray-600">
                                              {subItem.date ? new Date(subItem.date).toLocaleDateString() : "-"}
                                            </span>
                                          </td>
                                          <td className="p-3">
                                            <span className="text-xs font-medium text-gray-900">{subItem.item_name}</span>
                                          </td>
                                          <td className="p-3">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleDelete(subItem.id)}
                                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                                              title="Delete sub-item"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                {/* Add Sub-item Form */}
                                {showSubItemForm === item.id && (
                                  <div className="p-4 border-t bg-white border-gray-200">
                                    <form 
                                      onSubmit={(e) => handleSubItemSubmit(e, item.id)}
                                      className="space-y-4"
                                    >
                                      <div className="grid gap-4 md:grid-cols-3">
                                        <div className="space-y-2">
                                          <Label htmlFor="sub_item_name" className="text-xs font-semibold text-gray-700">
                                            Sub-Item Name <span className="text-red-500">*</span>
                                          </Label>
                                          <Input
                                            id="sub_item_name"
                                            value={subItemForm.item_name}
                                            onChange={(e) => setSubItemForm({ ...subItemForm, item_name: e.target.value })}
                                            placeholder="Enter sub-item name"
                                            required
                                            className="text-sm h-9"
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label htmlFor="sub_item_date" className="text-xs font-semibold text-gray-700">Date</Label>
                                          <Input
                                            id="sub_item_date"
                                            type="date"
                                            value={subItemForm.date}
                                            onChange={(e) => setSubItemForm({ ...subItemForm, date: e.target.value })}
                                            className="text-sm h-9"
                                          />
                                        </div>
                                        <div className="flex items-end gap-2">
                                          <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                                            Add Sub-Item
                                          </Button>
                                          <Button 
                                            type="button" 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => setShowSubItemForm(null)}
                                            className="border-gray-300"
                                          >
                                            Cancel
                                          </Button>
                                        </div>
                                      </div>
                                    </form>
                                  </div>
                                )}
                                {showSubItemForm !== item.id && (
                                  <div className="p-3 border-t bg-gray-50/50">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setShowSubItemForm(item.id)
                                        setSubItemForm({ item_name: "", date: new Date().toISOString().split('T')[0] })
                                      }}
                                      className="text-xs border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400"
                                    >
                                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                                      Add Sub-Item
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                        {/* Add Sub-item Form (when no sub-items exist) - desktop */}
                        {showSubItemForm === item.id && !hasSubItems && (
                          <tr>
                            <td colSpan={5} className="p-0">
                              <div className="bg-gray-50 pl-8 p-4 border-t border-gray-200">
                                <form 
                                  onSubmit={(e) => handleSubItemSubmit(e, item.id)}
                                  className="space-y-4"
                                >
                                  <div className="grid gap-4 md:grid-cols-3">
                                    <div className="space-y-2">
                                      <Label htmlFor="sub_item_name" className="text-xs font-semibold text-gray-700">
                                        Sub-Item Name <span className="text-red-500">*</span>
                                      </Label>
                                      <Input
                                        id="sub_item_name"
                                        value={subItemForm.item_name}
                                        onChange={(e) => setSubItemForm({ ...subItemForm, item_name: e.target.value })}
                                        placeholder="Enter sub-item name"
                                        required
                                        className="text-sm h-9"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="sub_item_date" className="text-xs font-semibold text-gray-700">Date</Label>
                                      <Input
                                        id="sub_item_date"
                                        type="date"
                                        value={subItemForm.date}
                                        onChange={(e) => setSubItemForm({ ...subItemForm, date: e.target.value })}
                                        className="text-sm h-9"
                                      />
                                    </div>
                                    <div className="flex items-end gap-2">
                                      <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                                        Add Sub-Item
                                      </Button>
                                      <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setShowSubItemForm(null)}
                                        className="border-gray-300"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                </form>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
