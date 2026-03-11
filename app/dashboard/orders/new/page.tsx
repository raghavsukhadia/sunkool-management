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
import { createOrder, getCustomersForOrder } from "@/app/actions/orders"
import { useRouter } from "next/navigation"
import { ShoppingCart, ArrowLeft, X, CheckCircle2, Search, ChevronDown, ChevronUp } from "lucide-react"

const orderSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  sales_order_number: z.string().optional(),
  cash_discount: z.boolean().default(false),
})

type OrderFormValues = z.infer<typeof orderSchema>

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
}

export default function NewOrderPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customer_id: "",
      sales_order_number: "",
      cash_discount: false,
    },
  })

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getCustomersForOrder()
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

  async function onSubmit(data: OrderFormValues) {
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await createOrder({
        customer_id: data.customer_id,
        sales_order_number: data.sales_order_number || undefined,
        cash_discount: data.cash_discount,
      })

      if (result.success && result.data) {
        setSuccess("Order created successfully! Redirecting to add items...")
        form.reset()
        setTimeout(() => {
          setSuccess(null)
          router.push(`/dashboard/orders/${result.data.id}`)
        }, 1500)
      } else {
        setError(result.error || "Failed to create order")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const cashDiscount = form.watch("cash_discount")
  const selectedCustomerId = form.watch("customer_id")

  // Get selected customer display name
  const getSelectedCustomerName = () => {
    if (!selectedCustomerId) return "Select a customer..."
    const customer = customers.find(c => c.id === selectedCustomerId)
    if (customer) {
      return `${customer.name}${customer.email ? ` (${customer.email})` : ""}${customer.phone ? ` - ${customer.phone}` : ""}`
    }
    return "Select a customer..."
  }

  // Filter customers based on search term
  const filteredCustomers = customers.filter(customer => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      customer.name.toLowerCase().includes(term) ||
      (customer.email && customer.email.toLowerCase().includes(term)) ||
      (customer.phone && customer.phone.toLowerCase().includes(term))
    )
  })

  const handleCustomerSelect = (customerId: string) => {
    form.setValue("customer_id", customerId, { shouldValidate: true })
    setIsDropdownOpen(false)
    setSearchTerm("")
  }

  // Reset search when dropdown closes
  useEffect(() => {
    if (!isDropdownOpen) {
      setSearchTerm("")
    }
  }, [isDropdownOpen])

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
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Create New Order</h1>
          <p className="text-gray-600 mt-1.5 text-sm">Create a new order for a customer</p>
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

      {/* Order Form */}
      <Card className="border-2 border-blue-100 shadow-md">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
          <CardTitle className="text-xl font-semibold text-gray-900 flex items-center">
            <ShoppingCart className="w-5 h-5 mr-2" />
            New Order Details
          </CardTitle>
          <CardDescription className="mt-1">Fill in the order information below</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Customer Selection */}
              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-gray-700">
                      Customer <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      {loading ? (
                        <div className="h-10 flex items-center text-sm text-gray-500">Loading customers...</div>
                      ) : (
                        <div className="relative">
                          {/* Hidden input for form validation */}
                          <input
                            type="hidden"
                            {...field}
                            value={field.value || ""}
                          />
                          <button
                            type="button"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className={`flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm text-left ring-offset-background placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                              form.formState.errors.customer_id 
                                ? "border-red-300 bg-red-50" 
                                : "border-gray-300 bg-white"
                            }`}
                          >
                            <span className={selectedCustomerId ? "text-gray-900" : "text-gray-500"}>
                              {getSelectedCustomerName()}
                            </span>
                            {isDropdownOpen ? (
                              <ChevronUp className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                          
                          {isDropdownOpen && (
                            <>
                              <div 
                                className="fixed inset-0 z-10" 
                                onClick={() => setIsDropdownOpen(false)}
                              />
                              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-hidden flex flex-col">
                                {/* Search Input */}
                                <div className="p-2 border-b border-gray-200 bg-gray-50 sticky top-0">
                                  <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <Input
                                      type="text"
                                      placeholder="Search by name, email, or phone..."
                                      value={searchTerm}
                                      onChange={(e) => setSearchTerm(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Escape") {
                                          setIsDropdownOpen(false)
                                        }
                                        e.stopPropagation()
                                      }}
                                      className="pl-8 pr-8 h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                      autoFocus
                                    />
                                    {searchTerm && (
                                      <button
                                        onClick={() => setSearchTerm("")}
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-200"
                                        title="Clear search"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Customers List */}
                                <div className="overflow-y-auto flex-1">
                                  {filteredCustomers.length === 0 ? (
                                    <div className="px-3 py-4 text-sm text-gray-500 text-center">
                                      {searchTerm ? `No customers found matching "${searchTerm}"` : "No customers available"}
                                    </div>
                                  ) : (
                                    <div className="py-1">
                                      {filteredCustomers.map((customer) => (
                                        <div
                                          key={customer.id}
                                          className={`px-3 py-2.5 text-sm cursor-pointer hover:bg-blue-50 transition-colors ${
                                            selectedCustomerId === customer.id ? "bg-blue-100" : ""
                                          }`}
                                          onClick={() => handleCustomerSelect(customer.id)}
                                        >
                                          <div className="font-medium text-gray-900">{customer.name}</div>
                                          <div className="text-xs text-gray-600 mt-0.5">
                                            {customer.email && <span>{customer.email}</span>}
                                            {customer.email && customer.phone && <span className="mx-1">•</span>}
                                            {customer.phone && <span>{customer.phone}</span>}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                
                                {/* Results count */}
                                {searchTerm && filteredCustomers.length > 0 && (
                                  <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
                                    {filteredCustomers.length} {filteredCustomers.length === 1 ? 'customer' : 'customers'} found
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </FormControl>
                    <FormDescription>
                      Search and select the customer for this order. Type to filter by name, email, or phone number.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Sales Order Number */}
              <FormField
                control={form.control}
                name="sales_order_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-gray-700">Sales Order Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter sales order number from other platform (optional)"
                        {...field}
                        className="h-10"
                      />
                    </FormControl>
                    <FormDescription>
                      Optional: Enter sales order number from other platforms. An internal order number (SK01, SK02, SK03...) will be automatically generated for identification.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Cash Discount Checkbox */}
              <FormField
                control={form.control}
                name="cash_discount"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-gray-200 p-4 bg-gray-50">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm font-semibold text-gray-700 cursor-pointer">
                        Cash Discount
                      </FormLabel>
                      <FormDescription className="text-xs text-gray-600">
                        {cashDiscount ? (
                          <span className="text-blue-700 font-medium">
                            ✓ This order will appear in "Payment Followup" section. Payment tracking will be required for 14 days until payment is received.
                          </span>
                        ) : (
                          "Check this box if cash discount applies to this order. The order will appear in Payment Followup section with 14 days of followup required."
                        )}
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {/* Submit Button */}
              <div className="flex gap-3 pt-2 border-t">
                <Button
                  type="submit"
                  disabled={isSubmitting || loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                >
                  {isSubmitting ? (
                    <>
                      <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                      Creating Order...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Create New Order
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  className="border-gray-300"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
