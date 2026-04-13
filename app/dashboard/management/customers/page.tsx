"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { createCustomer, getCustomers, deleteCustomer, updateCustomer } from "@/app/actions/management"
import { useRouter } from "next/navigation"
import {
  Users, Plus, ArrowLeft, Search, ArrowUp, ArrowDown, ArrowUpDown,
  Trash2, Edit2, X, Phone, Mail, MapPin, User, Building2, FileText,
  CheckCircle2, AlertCircle,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  contact_person: string | null
  notes: string | null
  created_at: string
}

const customerSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  contact_person: z.string().optional(),
  notes: z.string().optional(),
})

type CustomerFormValues = z.infer<typeof customerSchema>

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
]

function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ─── Customer Form ────────────────────────────────────────────────────────────

function CustomerForm({
  form,
  onSubmit,
  isSubmitting,
  editingCustomer,
  onCancel,
  isMobile = false,
}: {
  form: ReturnType<typeof useForm<CustomerFormValues>>
  onSubmit: (data: CustomerFormValues) => void
  isSubmitting: boolean
  editingCustomer: Customer | null
  onCancel: () => void
  isMobile?: boolean
}) {
  const inputCls = isMobile ? "min-h-[44px]" : ""

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* Section: Business Info */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
            <Building2 className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Business Info</span>
          </div>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">
                  Customer / Company Name <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. Acme Corporation"
                    className={inputCls}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contact_person"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Contact Person</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. John Smith" className={inputCls} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Section: Contact Details */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
            <Phone className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact Details</span>
          </div>
          <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Phone</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input placeholder="+91 98765 43210" className={`pl-9 ${inputCls}`} {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Email</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input type="email" placeholder="email@company.com" className={`pl-9 ${inputCls}`} {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Address</FormLabel>
                <FormControl>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input placeholder="Street, City, State, PIN" className={`pl-9 ${inputCls}`} {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Section: Notes */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
            <FileText className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</span>
          </div>
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Additional Notes</FormLabel>
                <FormControl>
                  <textarea
                    placeholder="Payment terms, special requirements, preferences…"
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <Button type="submit" disabled={isSubmitting} className={`flex-1 gap-2 ${isMobile ? "min-h-[44px]" : ""}`}>
            {isSubmitting
              ? (editingCustomer ? "Saving…" : "Creating…")
              : (editingCustomer ? "Save Changes" : "Create Customer")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={`gap-2 ${isMobile ? "min-h-[44px]" : ""}`}
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [mobileSheetMode, setMobileSheetMode] = useState<"form" | "search" | null>(null)
  const [showDesktopForm, setShowDesktopForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [sortBy, setSortBy] = useState<"name" | "created_at">("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: "", email: "", phone: "", address: "", contact_person: "", notes: "" },
  })

  useEffect(() => { loadCustomers() }, [])

  const loadCustomers = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getCustomers()
      if (result.success && result.data) setCustomers(result.data as Customer[])
      else setError(result.error || "Failed to load customers")
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const openAddForm = () => {
    setEditingCustomer(null)
    form.reset()
    setError(null)
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMobileSheetMode("form")
    } else {
      setShowDesktopForm(true)
    }
  }

  const openEditForm = (customer: Customer) => {
    setEditingCustomer(customer)
    form.reset({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      contact_person: customer.contact_person || "",
      notes: customer.notes || "",
    })
    setError(null)
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMobileSheetMode("form")
    } else {
      setShowDesktopForm(true)
    }
  }

  const closeForm = () => {
    setShowDesktopForm(false)
    setMobileSheetMode(null)
    setEditingCustomer(null)
    form.reset()
    setError(null)
  }

  async function onSubmit(data: CustomerFormValues) {
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      let result
      if (editingCustomer) {
        result = await updateCustomer(editingCustomer.id, {
          name: data.name,
          email: data.email || undefined,
          phone: data.phone || undefined,
          address: data.address || undefined,
          contact_person: data.contact_person || undefined,
          notes: data.notes || undefined,
        })
      } else {
        result = await createCustomer({
          name: data.name,
          email: data.email || undefined,
          phone: data.phone || undefined,
          address: data.address || undefined,
          contact_person: data.contact_person || undefined,
          notes: data.notes || undefined,
        })
      }
      if (result.success) {
        setSuccess(editingCustomer ? "Customer updated successfully!" : "Customer created successfully!")
        closeForm()
        await loadCustomers()
        setTimeout(() => setSuccess(null), 4000)
      } else {
        setError(result.error || (editingCustomer ? "Failed to update customer" : "Failed to create customer"))
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this customer? This cannot be undone.")) return
    try {
      const result = await deleteCustomer(id)
      if (result.success) {
        setSuccess("Customer deleted.")
        await loadCustomers()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error || "Failed to delete customer")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    }
  }

  const toggleSort = (field: "name" | "created_at") => {
    if (sortBy === field) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortBy(field); setSortDir("asc") }
  }

  const filteredCustomers = (() => {
    let list = [...customers]
    if (searchTerm) {
      const t = searchTerm.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(t) ||
        (c.email && c.email.toLowerCase().includes(t)) ||
        (c.phone && c.phone.toLowerCase().includes(t)) ||
        (c.contact_person && c.contact_person.toLowerCase().includes(t)) ||
        (c.address && c.address.toLowerCase().includes(t))
      )
    }
    list.sort((a, b) => {
      const av = sortBy === "name" ? a.name.toLowerCase() : new Date(a.created_at).getTime()
      const bv = sortBy === "name" ? b.name.toLowerCase() : new Date(b.created_at).getTime()
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })
    return list
  })()

  const SortIcon = ({ field }: { field: "name" | "created_at" }) => {
    if (sortBy !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
    return sortDir === "asc"
      ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
      : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
  }

  return (
    <div className="space-y-5 pb-10 max-w-5xl mx-auto">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-800 min-h-[40px] px-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="h-5 w-px bg-gray-200" />
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg shadow-sm">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Customers</h1>
              <p className="text-xs text-gray-500">Manage contacts & customer info</p>
            </div>
          </div>
          {!loading && (
            <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">
              {customers.length} total
            </Badge>
          )}
        </div>
        <Button onClick={openAddForm} className="gap-2 shadow-sm min-h-[40px]">
          <Plus className="w-4 h-4" />
          New Customer
        </Button>
      </div>

      {/* ── Alerts ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
          <span className="flex-1 font-medium">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-green-500" />
          <span className="flex-1 font-medium">{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Desktop: Add / Edit Form ─────────────────────────────────────── */}
      {showDesktopForm && (
        <Card className="hidden lg:block border-2 border-blue-100 shadow-md">
          <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b rounded-t-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-600 rounded-md">
                  {editingCustomer ? <Edit2 className="w-4 h-4 text-white" /> : <Plus className="w-4 h-4 text-white" />}
                </div>
                <CardTitle className="text-base font-semibold text-gray-900">
                  {editingCustomer ? "Edit Customer" : "New Customer"}
                </CardTitle>
                {editingCustomer && (
                  <Badge variant="outline" className="text-xs text-blue-700 border-blue-200 bg-blue-50">
                    {editingCustomer.name}
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={closeForm} className="text-gray-400 hover:text-gray-700 h-8 w-8 p-0">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <CustomerForm
              form={form}
              onSubmit={onSubmit}
              isSubmitting={isSubmitting}
              editingCustomer={editingCustomer}
              onCancel={closeForm}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Mobile: Form + Search Sheets ────────────────────────────────── */}
      <Sheet
        open={mobileSheetMode === "form"}
        onOpenChange={(o) => { if (!o) closeForm() }}
      >
        <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl overflow-y-auto">
          <SheetHeader className="pb-4 border-b mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-600 rounded-md">
                {editingCustomer ? <Edit2 className="w-4 h-4 text-white" /> : <Plus className="w-4 h-4 text-white" />}
              </div>
              <SheetTitle className="text-base font-semibold">
                {editingCustomer ? "Edit Customer" : "New Customer"}
              </SheetTitle>
            </div>
          </SheetHeader>
          <CustomerForm
            form={form}
            onSubmit={onSubmit}
            isSubmitting={isSubmitting}
            editingCustomer={editingCustomer}
            onCancel={closeForm}
            isMobile
          />
        </SheetContent>
      </Sheet>

      {/* ── Search & Sort Toolbar ────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, phone, email, address…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-9 h-10"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {/* Sort */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-500 font-medium hidden sm:inline">Sort:</span>
              <Button
                variant={sortBy === "name" ? "default" : "outline"}
                size="sm"
                className="h-10 gap-1.5 text-xs"
                onClick={() => toggleSort("name")}
              >
                Name <SortIcon field="name" />
              </Button>
              <Button
                variant={sortBy === "created_at" ? "default" : "outline"}
                size="sm"
                className="h-10 gap-1.5 text-xs"
                onClick={() => toggleSort("created_at")}
              >
                Added <SortIcon field="created_at" />
              </Button>
            </div>
          </div>
          {/* Result count */}
          {searchTerm && (
            <p className="text-xs text-gray-500 mt-2 pl-1">
              {filteredCustomers.length} result{filteredCustomers.length !== 1 ? "s" : ""} for &ldquo;{searchTerm}&rdquo;
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Customer List ────────────────────────────────────────────────── */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-5 bg-gray-50 border-b">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            <CardTitle className="text-sm font-semibold text-gray-700">
              All Customers
            </CardTitle>
            <Badge variant="secondary" className="ml-auto text-xs">
              {filteredCustomers.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
              <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-sm">Loading customers…</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
              <div className="p-4 bg-gray-100 rounded-full">
                <Users className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">
                {searchTerm ? "No customers match your search." : "No customers yet."}
              </p>
              {!searchTerm && (
                <Button variant="outline" size="sm" onClick={openAddForm} className="gap-2 mt-1">
                  <Plus className="w-4 h-4" /> Add your first customer
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* ── Mobile cards ── */}
              <div className="lg:hidden divide-y divide-gray-100">
                {filteredCustomers.map((customer) => (
                  <div key={customer.id} className="p-4 flex items-start gap-3">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${avatarColor(customer.name)}`}>
                      {getInitials(customer.name)}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{customer.name}</p>
                      {customer.contact_person && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3" /> {customer.contact_person}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-col gap-1">
                        {customer.phone && (
                          <a href={`tel:${customer.phone}`} className="text-xs text-blue-600 flex items-center gap-1.5 hover:underline">
                            <Phone className="w-3 h-3" /> {customer.phone}
                          </a>
                        )}
                        {customer.email && (
                          <a href={`mailto:${customer.email}`} className="text-xs text-blue-600 flex items-center gap-1.5 hover:underline truncate">
                            <Mail className="w-3 h-3" /> {customer.email}
                          </a>
                        )}
                        {customer.address && (
                          <p className="text-xs text-gray-500 flex items-start gap-1.5">
                            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                            <span className="line-clamp-1">{customer.address}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 text-blue-600 hover:bg-blue-50"
                        onClick={() => openEditForm(customer)}
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 text-red-500 hover:bg-red-50"
                        onClick={() => handleDelete(customer.id)}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Desktop table ── */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50/60">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-8" />
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => toggleSort("name")}
                          className="flex items-center gap-1.5 hover:text-gray-800 transition-colors"
                        >
                          Customer <SortIcon field="name" />
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact Person</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Address</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => toggleSort("created_at")}
                          className="flex items-center gap-1.5 hover:text-gray-800 transition-colors"
                        >
                          Added <SortIcon field="created_at" />
                        </button>
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredCustomers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-blue-50/30 transition-colors group">
                        {/* Avatar */}
                        <td className="pl-5 pr-2 py-3.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs ${avatarColor(customer.name)}`}>
                            {getInitials(customer.name)}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-sm font-semibold text-gray-900">{customer.name}</span>
                          {customer.notes && (
                            <p className="text-xs text-gray-400 mt-0.5 max-w-[180px] truncate">{customer.notes}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-sm text-gray-600">{customer.contact_person || <span className="text-gray-300">—</span>}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          {customer.phone
                            ? <a href={`tel:${customer.phone}`} className="text-sm text-blue-600 hover:underline">{customer.phone}</a>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          {customer.email
                            ? <a href={`mailto:${customer.email}`} className="text-sm text-blue-600 hover:underline">{customer.email}</a>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-sm text-gray-500 max-w-[200px] truncate block">{customer.address || <span className="text-gray-300">—</span>}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-gray-400">
                            {new Date(customer.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditForm(customer)}
                              className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(customer.id)}
                              className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
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
