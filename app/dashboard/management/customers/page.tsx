"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createCustomer, getCustomers, deleteCustomer, updateCustomer } from "@/app/actions/management"
import { useRouter } from "next/navigation"
import { Users, Plus, ArrowLeft, Search, ArrowUp, ArrowDown, ArrowUpDown, Trash2, Edit2, X, Filter } from "lucide-react"

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

export default function CustomersPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showSearchPanel, setShowSearchPanel] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [sortBy, setSortBy] = useState<"name" | "created_at">("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      contact_person: "",
      notes: "",
    },
  })

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getCustomers()
      if (result.success && result.data) {
        setCustomers(result.data as Customer[])
      } else {
        setError(result.error || "Failed to load customers")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  async function onSubmit(data: CustomerFormValues) {
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      let result
      if (editingCustomer) {
        // Update existing customer
        result = await updateCustomer(editingCustomer.id, {
          name: data.name,
          email: data.email || undefined,
          phone: data.phone || undefined,
          address: data.address || undefined,
          contact_person: data.contact_person || undefined,
          notes: data.notes || undefined,
        })
      } else {
        // Create new customer
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
        form.reset()
        setShowAddForm(false)
        setEditingCustomer(null)
        await loadCustomers()
        setTimeout(() => {
          setSuccess(null)
        }, 3000)
      } else {
        setError(result.error || (editingCustomer ? "Failed to update customer" : "Failed to create customer"))
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    form.reset({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      contact_person: customer.contact_person || "",
      notes: customer.notes || "",
    })
    setShowAddForm(true)
    setError(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer?")) {
      return
    }

    try {
      const result = await deleteCustomer(id)
      if (result.success) {
        setSuccess("Customer deleted successfully!")
        await loadCustomers()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error || "Failed to delete customer")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    }
  }

  // Filter and sort customers
  const filteredAndSortedCustomers = (() => {
    let filtered = customers

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = customers.filter(customer =>
        customer.name.toLowerCase().includes(term) ||
        (customer.email && customer.email.toLowerCase().includes(term)) ||
        (customer.phone && customer.phone.toLowerCase().includes(term)) ||
        (customer.contact_person && customer.contact_person.toLowerCase().includes(term)) ||
        (customer.address && customer.address.toLowerCase().includes(term))
      )
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any
      let bVal: any

      switch (sortBy) {
        case "name":
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
          break
        case "created_at":
          aVal = new Date(a.created_at).getTime()
          bVal = new Date(b.created_at).getTime()
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

  return (
    <div className="space-y-6 pb-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Customer</h1>
          <p className="text-gray-600 mt-1.5 text-sm">Manage customer information and contacts</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setShowAddForm(true)
              setEditingCustomer(null)
              form.reset()
              setError(null)
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </Button>
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

      {/* Add New Customer Form */}
      {showAddForm && (
        <Card className="border-2 border-blue-100 shadow-md">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold text-gray-900 flex items-center">
                  {editingCustomer ? (
                    <>
                      <Edit2 className="w-5 h-5 mr-2" />
                      Edit Customer
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5 mr-2" />
                      Add New Customer
                    </>
                  )}
                </CardTitle>
                <CardDescription className="mt-1">
                  {editingCustomer ? "Update customer information below" : "Enter customer information below"}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddForm(false)
                  setEditingCustomer(null)
                  form.reset()
                  setError(null)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter customer name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="customer@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="Phone number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="contact_person"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person</FormLabel>
                    <FormControl>
                      <Input placeholder="Primary contact person name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Customer address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Input placeholder="Additional notes (optional)" {...field} />
                    </FormControl>
                    <FormDescription>
                      Any additional information about this customer
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

                <div className="flex gap-3 pt-2 border-t">
                  <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white px-6">
                    {isSubmitting 
                      ? (editingCustomer ? "Updating..." : "Creating...") 
                      : (editingCustomer ? "Update Customer" : "Create Customer")
                    }
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddForm(false)
                      setEditingCustomer(null)
                      form.reset()
                      setError(null)
                    }}
                    className="border-gray-300"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Search & Sort Panel */}
      <Card className="shadow-sm">
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
              {showSearchPanel ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search customers by name, email, phone, contact person, or address..."
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
              <div className="grid grid-cols-2 gap-4 pt-3">
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                  <div className="text-3xl font-bold text-blue-700">{filteredAndSortedCustomers.length}</div>
                  <div className="text-xs font-medium text-gray-600 mt-1.5">Total Customers</div>
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

      {/* Customers List */}
      <Card className="shadow-sm">
        <CardHeader className="bg-gray-50 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2.5 text-lg font-semibold text-gray-900">
                <div className="p-1.5 bg-blue-100 rounded-md">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                All Customers
                <span className="text-sm font-normal text-gray-500 ml-1">
                  ({filteredAndSortedCustomers.length})
                </span>
              </CardTitle>
              <CardDescription className="mt-1.5">View and manage all customers</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
              <p className="text-sm">Loading customers...</p>
            </div>
          ) : filteredAndSortedCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                {searchTerm ? "No customers found matching your search." : "No customers yet."}
              </p>
              {!searchTerm && (
                <p className="text-sm text-gray-400 mt-1">Create your first customer using the form above.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50/50">
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
                        Customer Name
                        {sortBy === "name" ? (
                          sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
                        )}
                      </button>
                    </th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Contact Person</th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Email</th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Phone</th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Address</th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedCustomers.map((customer) => (
                    <tr key={customer.id} className="border-b hover:bg-blue-50/30 transition-colors">
                      <td className="p-4">
                        <span className="text-sm font-medium text-gray-900">{customer.name}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-gray-600">{customer.contact_person || "-"}</span>
                      </td>
                      <td className="p-4">
                        {customer.email ? (
                          <a
                            href={`mailto:${customer.email}`}
                            className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            {customer.email}
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        {customer.phone ? (
                          <a
                            href={`tel:${customer.phone}`}
                            className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            {customer.phone}
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-gray-600">{customer.address || "-"}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(customer)}
                            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                            title="Edit customer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(customer.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                            title="Delete customer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

