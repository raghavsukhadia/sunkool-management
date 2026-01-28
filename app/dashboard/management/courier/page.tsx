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
import { createCourierCompany, getCourierCompanies, deleteCourierCompany } from "@/app/actions/management"
import { useRouter } from "next/navigation"
import { Truck, Plus, ArrowLeft, Search, ArrowUp, ArrowDown, ArrowUpDown, Trash2, Edit2, X, Filter } from "lucide-react"

const courierSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  contact_person: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  tracking_url: z.string().url("Invalid URL").min(1, "Tracking URL is required"),
  notes: z.string().optional(),
})

interface CourierCompany {
  id: string
  name: string
  contact_person: string | null
  email: string | null
  phone: string | null
  address: string | null
  tracking_url: string | null
  notes: string | null
  created_at: string
}

type CourierFormValues = z.infer<typeof courierSchema>

export default function CourierPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [courierCompanies, setCourierCompanies] = useState<CourierCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showSearchPanel, setShowSearchPanel] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [sortBy, setSortBy] = useState<"name" | "created_at">("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const form = useForm<CourierFormValues>({
    resolver: zodResolver(courierSchema),
    defaultValues: {
      name: "",
      contact_person: "",
      email: "",
      phone: "",
      address: "",
      tracking_url: "",
      notes: "",
    },
  })

  useEffect(() => {
    loadCourierCompanies()
  }, [])

  const loadCourierCompanies = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getCourierCompanies()
      if (result.success && result.data) {
        setCourierCompanies(result.data as CourierCompany[])
      } else {
        setError(result.error || "Failed to load courier companies")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  async function onSubmit(data: CourierFormValues) {
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await createCourierCompany({
        name: data.name,
        contact_person: data.contact_person || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        tracking_url: data.tracking_url || undefined,
        notes: data.notes || undefined,
      })

      if (result.success) {
        setSuccess("Courier company created successfully!")
        form.reset()
        setShowAddForm(false)
        await loadCourierCompanies()
        setTimeout(() => {
          setSuccess(null)
        }, 3000)
      } else {
        setError(result.error || "Failed to create courier company")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this courier company?")) {
      return
    }

    try {
      const result = await deleteCourierCompany(id)
      if (result.success) {
        setSuccess("Courier company deleted successfully!")
        await loadCourierCompanies()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error || "Failed to delete courier company")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    }
  }

  // Filter and sort courier companies
  const filteredAndSortedCompanies = (() => {
    let filtered = courierCompanies

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = courierCompanies.filter(company =>
        company.name.toLowerCase().includes(term) ||
        (company.email && company.email.toLowerCase().includes(term)) ||
        (company.phone && company.phone.toLowerCase().includes(term)) ||
        (company.contact_person && company.contact_person.toLowerCase().includes(term))
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
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Courier Company</h1>
          <p className="text-gray-600 mt-1.5 text-sm">Manage shipping and courier partners</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setShowAddForm(true)
              form.reset()
              setError(null)
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Courier Company
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

      {/* Add New Courier Company Form */}
      {showAddForm && (
        <Card className="border-2 border-blue-100 shadow-md">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold text-gray-900 flex items-center">
                  <Plus className="w-5 h-5 mr-2" />
                  Add New Courier Company
                </CardTitle>
                <CardDescription className="mt-1">Enter courier company information below</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddForm(false)
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
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter courier company name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="contact_person"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Person</FormLabel>
                      <FormControl>
                        <Input placeholder="Contact person name" {...field} />
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="company@example.com" {...field} />
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
                      <Input placeholder="Company address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tracking_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tracking URL *</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://track.example.com/?tracking={tracking_number}"
                        {...field}
                        required
                      />
                    </FormControl>
                    <FormDescription>
                      Use {"{tracking_number}"} as placeholder for tracking number
                    </FormDescription>
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
                    <FormMessage />
                  </FormItem>
                )}
              />

                <div className="flex gap-3 pt-2 border-t">
                  <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white px-6">
                    {isSubmitting ? "Creating..." : "Create Courier Company"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddForm(false)
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
              placeholder="Search courier companies by name, email, phone, or contact person..."
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
                  <div className="text-3xl font-bold text-blue-700">{filteredAndSortedCompanies.length}</div>
                  <div className="text-xs font-medium text-gray-600 mt-1.5">Total Companies</div>
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

      {/* Courier Companies List */}
      <Card className="shadow-sm">
        <CardHeader className="bg-gray-50 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2.5 text-lg font-semibold text-gray-900">
                <div className="p-1.5 bg-blue-100 rounded-md">
                  <Truck className="w-4 h-4 text-blue-600" />
                </div>
                All Courier Companies
                <span className="text-sm font-normal text-gray-500 ml-1">
                  ({filteredAndSortedCompanies.length})
                </span>
              </CardTitle>
              <CardDescription className="mt-1.5">View and manage all courier companies</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
              <p className="text-sm">Loading courier companies...</p>
            </div>
          ) : filteredAndSortedCompanies.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                {searchTerm ? "No courier companies found matching your search." : "No courier companies yet."}
              </p>
              {!searchTerm && (
                <p className="text-sm text-gray-400 mt-1">Create your first courier company using the form above.</p>
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
                        Company Name
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
                    <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Tracking URL</th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedCompanies.map((company) => (
                    <tr key={company.id} className="border-b hover:bg-blue-50/30 transition-colors">
                      <td className="p-4">
                        <span className="text-sm font-medium text-gray-900">{company.name}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-gray-600">{company.contact_person || "-"}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-gray-600">{company.email || "-"}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-gray-600">{company.phone || "-"}</span>
                      </td>
                      <td className="p-4">
                        {company.tracking_url ? (
                          <a
                            href={company.tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            View URL
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(company.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                            title="Delete courier company"
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

