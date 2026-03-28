"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getOrderDetailPageData,
  getOrderDetails,
  getInventoryItemsForOrder,
  addItemToOrder,
  updateOrderItemQuantity,
  removeItemFromOrder,
  createReturnDispatch,
  createDispatch,
  getOrderDispatches,
  updateDispatchStatus,
  updateOrderPayment,
  getOrderPaymentFollowups,
  ensurePaymentFollowupForOrder,
  updatePaymentFollowup,
  updateOrder,
  deleteOrder,
  uploadProductionPDF,
  deleteProductionPDF,
  createProductionList,
  getOrderProductionLists,
  deleteProductionList,
  createProductionRecord,
  getOrderProductionRecords,
  updateProductionRecordStatus,
  deleteProductionRecord,
  getInvoiceAttachments,
  uploadInvoiceAttachment,
  deleteInvoiceAttachment,
  getOrderPayments,
  addOrderPayment,
  deleteOrderPayment,
} from "@/app/actions/orders"
import { getCourierCompanies } from "@/app/actions/management"
import {
  ShoppingCart,
  ArrowLeft,
  Plus,
  Trash2,
  Package,
  User,
  X,
  CheckCircle2,
  Edit2,
  ChevronDown,
  ChevronRight,
  Search,
  Truck,
  Check,
  FileText,
  DollarSign,
  Calendar,
  Edit,
  Trash,
  Upload,
  Download,
  File,
  FileDown,
  AlertCircle,
  Factory,
  Zap,
  RefreshCw,
  CreditCard,
  Receipt,
} from "lucide-react"
import { generateProductionPDF, generateTrackingSlipPDF } from "@/lib/pdf-generator"

interface SubItem {
  id: string
  item_name: string
  date: string | null
  parent_item_id: string
}

interface InventoryItem {
  id: string
  sr_no: number
  item_name: string
  date: string | null
  sub_items?: SubItem[]
}

interface OrderItem {
  id: string
  product_id: string | null
  inventory_item_id?: string | null
  quantity: number
  unit_price: number
  subtotal: number
  inventory_item?: InventoryItem
}

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  contact_person: string | null
}

interface Order {
  id: string
  customer_id: string
  internal_order_number: string | null
  sales_order_number: string | null
  cash_discount: boolean
  order_status: string
  payment_status: string
  total_price: number
  created_at: string
  invoice_number?: string | null
  zoho_billing_details?: any
  requested_payment_amount?: number | null
  customers: Customer
  items: OrderItem[]
}

export default function OrderDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<string>("")
  const [quantity, setQuantity] = useState<number>(1)
  const [addingItem, setAddingItem] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [dispatchType, setDispatchType] = useState<"partial" | "full" | null>(null)
  const [dispatchQuantities, setDispatchQuantities] = useState<Record<string, number>>({})
  const [dispatchNotes, setDispatchNotes] = useState<string>("")
  const [dispatching, setDispatching] = useState(false)
  const [courierCompanies, setCourierCompanies] = useState<any[]>([])
  const [selectedCourierCompany, setSelectedCourierCompany] = useState<string>("")
  const [trackingId, setTrackingId] = useState<string>("")
  const [activeTab, setActiveTab] = useState<string>("items")
  const [showDispatchForm, setShowDispatchForm] = useState(false)
  const [selectedProductionRecord, setSelectedProductionRecord] = useState<any>(null)
  const [creatingDispatch, setCreatingDispatch] = useState(false)
  const [dispatches, setDispatches] = useState<any[]>([])
  const [paymentFollowups, setPaymentFollowups] = useState<any[]>([])
  const [invoiceNumber, setInvoiceNumber] = useState<string>("")
  const [zohoBillingDetails, setZohoBillingDetails] = useState<string>("")
  const [paymentStatus, setPaymentStatus] = useState<'complete' | 'partial' | 'pending'>('pending')
  const [paymentDate, setPaymentDate] = useState<string>("")
  const [partialPaymentAmount, setPartialPaymentAmount] = useState<string>("")
  const [remainingPaymentAmount, setRemainingPaymentAmount] = useState<string>("")
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [productionType, setProductionType] = useState<"full" | "partial">("full")
  const [productionQuantities, setProductionQuantities] = useState<Record<string, number>>({})
  const [productionLists, setProductionLists] = useState<any[]>([])
  const [productionRecords, setProductionRecords] = useState<any[]>([])
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [creatingRecord, setCreatingRecord] = useState(false)
  const [generatingTrackingSlip, setGeneratingTrackingSlip] = useState<string | null>(null)
  const [expandedShipments, setExpandedShipments] = useState<Record<string, boolean>>({})
  const [invoiceAttachments, setInvoiceAttachments] = useState<any[]>([])
  const [uploadingInvoiceAttachment, setUploadingInvoiceAttachment] = useState(false)
  const [orderPayments, setOrderPayments] = useState<any[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [addingPayment, setAddingPayment] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const [paymentReference, setPaymentReference] = useState<string>("")
  const [paymentNotes, setPaymentNotes] = useState<string>("")
  const [paymentProductionRecordsOpen, setPaymentProductionRecordsOpen] = useState(false)
  const [paymentDispatchRecordsOpen, setPaymentDispatchRecordsOpen] = useState(false)
  const [requestedPaymentAmount, setRequestedPaymentAmount] = useState<string>("")
  const [savingRequestedPayment, setSavingRequestedPayment] = useState(false)
  const [followupFormById, setFollowupFormById] = useState<Record<string, { payment_received: boolean; payment_date: string; notes: string }>>({})
  const [savingFollowupId, setSavingFollowupId] = useState<string | null>(null)

  // Single source of truth for payment summary (requested, total paid, remaining)
  const paymentSummary = useMemo(() => {
    const totalPaid = orderPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const requested = (order as any)?.requested_payment_amount != null ? Number((order as any).requested_payment_amount) : (order?.total_price ?? 0)
    const amountDue = Math.max(0, requested - totalPaid)
    return { totalPaid, requested, amountDue, hasRequestedPayment: requested > 0 }
  }, [order, orderPayments])

  // Derived payment status from actual amounts. Only show Paid when there was an amount to pay and it's fully covered.
  const derivedPaymentStatus = useMemo((): "complete" | "partial" | "pending" => {
    const { amountDue, requested, totalPaid } = paymentSummary
    if (amountDue === 0 && (requested > 0 || totalPaid > 0)) return "complete"
    if (totalPaid > 0) return "partial"
    return "pending"
  }, [paymentSummary])

  // Single follow-up after 14 days: only show the one at (first dispatch + 14 days), hide old 14-daily entries
  const paymentFollowupDisplay = useMemo(() => {
    const dates = (dispatches || [])
      .map((d: { dispatch_date?: string }) => d.dispatch_date)
      .filter((d): d is string => !!d)
    const firstDispatchDateStr = dates.length > 0 ? dates.sort()[0] : null
    const referenceDate = firstDispatchDateStr
      ? new Date(firstDispatchDateStr)
      : new Date((order as any)?.created_at || (order as any)?.updated_at || Date.now())
    const overdueDate = new Date(referenceDate)
    overdueDate.setDate(overdueDate.getDate() + 14)
    const overdueDateStr = overdueDate.toISOString().split("T")[0]
    const todayStr = new Date().toISOString().split("T")[0]
    const isBefore14Days = todayStr < overdueDateStr
    // Only show the follow-up form on or after the follow-up date (25/03), not before
    const displayFollowups = isBefore14Days
      ? []
      : (paymentFollowups || []).filter(
          (f: { followup_date?: string }) => f.followup_date === overdueDateStr
        )
    const daysUntil = isBefore14Days
      ? Math.ceil((new Date(overdueDateStr + "T12:00:00").getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : 0
    return { overdueDateStr, isBefore14Days, displayFollowups, daysUntil }
  }, [dispatches, order, paymentFollowups])

  const getNetDispatchedForItem = useCallback((orderItemId: string) => {
    return dispatches.reduce((sum, dispatch) => {
      const dispatchQtyForItem = dispatch.dispatch_items?.reduce((itemSum: number, di: any) => {
        return di.order_items?.id === orderItemId ? itemSum + di.quantity : itemSum
      }, 0) || 0
      return sum + dispatchQtyForItem
    }, 0)
  }, [dispatches])

  // Tab badges: remaining work counts so users can see at a glance what's left
  const tabRemainingCounts = useMemo(() => {
    const items = order?.items || []
    let productionRemaining = 0
    let shipmentItemsRemaining = 0
    items.forEach(item => {
      const producedQty = (productionRecords || []).reduce((sum, record) => {
        if (record.selected_quantities?.[item.id]) return sum + (record.selected_quantities[item.id] as number)
        if (record.production_type === "full") return item.quantity
        return sum
      }, 0)
      if (item.quantity - producedQty > 0) productionRemaining += 1
      const dispatchedQty = dispatches.reduce((sum, d) => {
        const q = d.dispatch_items?.reduce((s: number, di: any) => {
          const orderItemId = di.order_items?.id ?? di.order_item_id
          return orderItemId === item.id ? s + (Number(di.quantity) || 0) : s
        }, 0) ?? 0
        return sum + q
      }, 0)
      if (item.quantity - dispatchedQty > 0) shipmentItemsRemaining += 1
    })
    const undeliveredDispatches = (dispatches || []).filter(
      d => (d.shipment_status || "ready") !== "delivered"
    ).length
    const shipmentRemaining = shipmentItemsRemaining + undeliveredDispatches
    return {
      productionRemaining,
      shipmentRemaining,
      paymentDue: paymentSummary.amountDue > 0,
    }
  }, [order?.items, productionRecords, dispatches, paymentSummary.amountDue])

  const fetchAllOrderData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getOrderDetailPageData(orderId)
      if (result.success && result.data) {
        const d = result.data
        setOrder(d.order as any)
        setInventoryItems(d.inventoryItems as any)
        setDispatches(d.dispatches)
        setCourierCompanies(d.courierCompanies)
        setProductionLists(d.productionLists)
        setProductionRecords(d.productionRecords)
        setInvoiceAttachments(d.invoiceAttachments)
        setOrderPayments(d.orderPayments)
        setPaymentFollowups(d.paymentFollowups)
      } else {
        setError(result.success ? null : (result as { error: string }).error ?? "Failed to load order")
      }
    } catch (err: any) {
      console.error("Order detail fetch error:", err)
      setError("Some data failed to load. Please refresh.")
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    if (orderId) {
      fetchAllOrderData()
    }
  }, [orderId, fetchAllOrderData])

  // Predicate used across the payment UI to determine whether payments can be recorded.
  // An order is eligible for payment recording if its status indicates dispatch OR if
  // there are existing dispatch records (handles legacy/stale status cases).
  const dispatchedStates = ['Ready for Dispatch', 'In Transit', 'Delivered', 'Partial Delivered']
  const canRecordPayment = dispatchedStates.includes(order?.order_status || '') || (dispatches && dispatches.length > 0)

  const loadOrderPayments = async () => {
    setLoadingPayments(true)
    try {
      const result = await getOrderPayments(orderId)
      if (result.success && result.data) {
        setOrderPayments(result.data)
      }
    } catch (err: any) {
      console.error("Failed to load order payments:", err)
    } finally {
      setLoadingPayments(false)
    }
  }

  const loadProductionLists = async () => {
    try {
      const result = await getOrderProductionLists(orderId)
      if (result.success && result.data) {
        setProductionLists(result.data)
      }
    } catch (err: any) {
      console.error("Failed to load production lists:", err)
    }
  }

  const loadProductionRecords = async () => {
    try {
      const result = await getOrderProductionRecords(orderId)
      if (result.success && result.data) {
        setProductionRecords(result.data)
      }
    } catch (err: any) {
      console.error("Failed to load production records:", err)
    }
  }

  const loadPaymentFollowups = useCallback(async () => {
    try {
      const result = await getOrderPaymentFollowups(orderId)
      if (result.success && result.data) {
        setPaymentFollowups(result.data)
      }
    } catch (err: any) {
      console.error("Failed to load payment followups:", err)
    }
  }, [orderId])

  useEffect(() => {
    if (order) {
      setInvoiceNumber(order.invoice_number || "")
      // Set payment status based on order payment_status
      if (order.payment_status === 'Paid') {
        setPaymentStatus('complete')
      } else if (order.payment_status === 'Partial') {
        setPaymentStatus('partial')
      } else {
        setPaymentStatus('pending')
      }
      // Set partial payment amounts if available
      if ((order as any).partial_payment_amount) {
        setPartialPaymentAmount(String((order as any).partial_payment_amount))
      }
      if ((order as any).remaining_payment_amount) {
        setRemainingPaymentAmount(String((order as any).remaining_payment_amount))
      }
      const reqAmt = (order as any).requested_payment_amount
      setRequestedPaymentAmount(reqAmt != null && reqAmt !== "" ? String(reqAmt) : "")
      if (order.zoho_billing_details) {
        setZohoBillingDetails(typeof order.zoho_billing_details === 'string'
          ? order.zoho_billing_details
          : JSON.stringify(order.zoho_billing_details, null, 2))
      } else {
        setZohoBillingDetails("")
      }
      if (order.cash_discount) {
        loadPaymentFollowups()
      }
    }
  }, [order, loadPaymentFollowups])

  // When Payment or Followup tab is active and order has amount due, ensure single 14-day followup exists and reload followups
  useEffect(() => {
    if ((activeTab === "payment" || activeTab === "followup") && order?.id && paymentSummary.amountDue > 0) {
      ensurePaymentFollowupForOrder(orderId).then(() => loadPaymentFollowups())
    }
  }, [activeTab, order?.id, orderId, paymentSummary.amountDue, loadPaymentFollowups])

  const loadOrderDetails = async () => {
    try {
      const result = await getOrderDetails(orderId)
      if (result.success && result.data) {
        setOrder(result.data as any)
      } else {
        setError(result.error || "Failed to load order details")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    }
  }

  const loadInventoryItems = async () => {
    try {
      const result = await getInventoryItemsForOrder()
      if (result.success && result.data) {
        setInventoryItems(result.data as InventoryItem[])
      }
    } catch (err: any) {
      console.error("Failed to load inventory items:", err)
    }
  }

  const loadDispatches = async () => {
    try {
      const result = await getOrderDispatches(orderId)
      if (result.success && result.data) {
        setDispatches(result.data)
      }
    } catch (err: any) {
      console.error("Failed to load dispatches:", err)
    }
  }

  const loadCourierCompanies = async () => {
    try {
      const result = await getCourierCompanies()
      if (result.success && result.data) {
        setCourierCompanies(result.data)
      }
    } catch (err: any) {
      console.error("Failed to load courier companies:", err)
    }
  }

  const loadInvoiceAttachments = async () => {
    try {
      const result = await getInvoiceAttachments(orderId)
      if (result.success && result.data) {
        setInvoiceAttachments(result.data)
      }
    } catch (err: any) {
      console.error("Failed to load invoice attachments:", err)
    }
  }

  const handleAddItem = async () => {
    if (!selectedItem || quantity <= 0) {
      setError("Please select an item and enter a valid quantity")
      return
    }

    setAddingItem(true)
    setError(null)
    try {
      const result = await addItemToOrder(orderId, selectedItem, quantity)
      if (result.success) {
        setSuccess("Item added to order successfully! Order status updated to Approved - ready for production.")
        setSelectedItem("")
        setQuantity(1)
        setIsDropdownOpen(false)
        await loadOrderDetails()
        setTimeout(() => setSuccess(null), 4000)
      } else {
        setError(result.error || "Failed to add item")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setAddingItem(false)
    }
  }

  const fetchLogoDataUrl = async (): Promise<string | undefined> => {
    try {
      const response = await fetch('/images/logo.png')
      const blob = await response.blob()
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = () => resolve(undefined)
        reader.readAsDataURL(blob)
      })
    } catch (err) {
      console.error("Failed to fetch logo:", err)
      return undefined
    }
  }

  const handleGeneratePDF = async () => {
    if (!order) {
      setError("Order data not available")
      return
    }

    // Validate partial production quantities
    if (productionType === "partial") {
      const selectedEntries = Object.entries(productionQuantities)
      const hasAnyQty = selectedEntries.some(([_, qty]) => qty > 0)
      const hasInvalidQty = selectedEntries.some(([id, qty]) => {
        const item = order.items.find(oi => oi.id === id)
        return qty < 0 || (item && qty > item.quantity)
      })

      if (!hasAnyQty) {
        setError("Please enter quantity for at least one item.")
        return
      }

      if (hasInvalidQty) {
        setError("Quantities cannot be negative or exceed the ordered quantity.")
        return
      }
    }

    setGeneratingPDF(true)
    setError(null)

    try {
      // Fetch logo data URL
      const logoDataUrl = await fetchLogoDataUrl()

      // Generate PDF
      const { blob, filename } = generateProductionPDF(
        order,
        inventoryItems,
        productionType === "partial" ? productionQuantities : undefined,
        undefined,
        logoDataUrl
      )

      // Create production list record and upload PDF
      const result = await createProductionList(
        orderId,
        productionType,
        productionType === "partial" ? productionQuantities : undefined,
        blob,
        filename
      )

      if (result.success) {
        setSuccess(`Production PDF generated and saved as ${getProductionListLabel(result.data.production_number)}!`)
        await loadProductionLists()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error || "Failed to save production list")
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate PDF")
    } finally {
      setGeneratingPDF(false)
    }
  }

  const getProductionListLabel = (number: number): string => {
    const suffixes = ['th', 'st', 'nd', 'rd']
    const v = number % 100
    return `${number}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]} Production List`
  }

  const handleCreateProductionRecord = async () => {
    if (!order) {
      setError("Order data not available")
      return
    }

    // Validate partial production quantities
    if (productionType === "partial") {
      const selectedEntries = Object.entries(productionQuantities)
      const hasAnyQty = selectedEntries.some(([_, qty]) => qty > 0)
      const hasInvalidQty = selectedEntries.some(([id, qty]) => {
        const item = order.items.find(oi => oi.id === id)
        return qty < 0 || (item && qty > item.quantity)
      })

      if (!hasAnyQty) {
        setError("Please enter quantity for at least one item.")
        return
      }

      if (hasInvalidQty) {
        setError("Quantities cannot be negative or exceed the ordered quantity.")
        return
      }
    }

    setCreatingRecord(true)
    setError(null)

    try {
      // Fetch logo data URL
      const logoDataUrl = await fetchLogoDataUrl()

      // Generate PDF first (without production record number, will be added after creation)
      const { blob, filename } = generateProductionPDF(
        order,
        inventoryItems,
        productionType === "partial" ? productionQuantities : undefined,
        undefined,
        logoDataUrl
      )

      // Convert Blob to base64 for Server Action
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64String = reader.result as string
          // Remove data URL prefix (data:application/pdf;base64,)
          const base64Data = base64String.split(',')[1] || base64String
          resolve(base64Data)
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      // Create production record with PDF
      const result = await createProductionRecord(
        orderId,
        productionType,
        productionType === "partial" ? productionQuantities : undefined,
        base64,
        filename
      )

      if (result.success) {
        setSuccess(`Production Record ${result.data.production_number} created successfully!`)
        await loadOrderDetails() // Reload to get updated order status
        await loadProductionRecords()
        // Reset form only if not partial order (partial orders stay in partial mode)
        if (productionType === "full" || (productionRecords.length > 0 && productionRecords[0]?.production_type === "full")) {
          setProductionType("full")
          setProductionQuantities({})
        } else {
          setProductionQuantities({})
        }
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error || "Failed to create production record")
      }
    } catch (err: any) {
      setError(err.message || "Failed to create production record")
    } finally {
      setCreatingRecord(false)
    }
  }

  // Set production type based on existing records
  useEffect(() => {
    if (productionRecords.length > 0) {
      const firstRecordType = productionRecords[0]?.production_type
      if (firstRecordType && productionType !== firstRecordType) {
        setProductionType(firstRecordType as "full" | "partial")
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productionRecords])

  // Initialize production quantities when switching to partial or when order changes
  useEffect(() => {
    if (order && productionType === "partial") {
      setProductionQuantities((prev) => {
        const next = { ...prev }
        let changed = false

        order.items.forEach((item) => {
          // Calculate produced quantity up to now for this item
          const producedQty = productionRecords.reduce((sum, record) => {
            if (record.selected_quantities && record.selected_quantities[item.id]) {
              return sum + (record.selected_quantities[item.id] as number)
            }
            if (record.production_type === "full") return item.quantity
            return sum
          }, 0)

          const remainingQty = Math.max(0, item.quantity - producedQty)

          if (next[item.id] == null) {
            next[item.id] = remainingQty
            changed = true
          }
        })

        return changed ? next : prev
      })
    }
  }, [order, productionType, productionRecords])

  const handleUpdateOrderStatus = async (newStatus: string) => {
    setError(null)
    try {
      const result = await updateOrder(orderId, { order_status: newStatus })
      if (result.success) {
        setSuccess(`Order status updated to ${newStatus} successfully!`)
        await loadOrderDetails()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error || "Failed to update order status")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    }
  }

  const toggleItemExpansion = (itemId: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedItems(newExpanded)
  }

  const handleItemSelect = (itemId: string) => {
    setSelectedItem(itemId)
    setIsDropdownOpen(false)
  }

  // Get selected item display name
  const getSelectedItemName = () => {
    if (!selectedItem) return "Select an item from inventory..."

    // Check if it's a parent item
    const parentItem = inventoryItems.find(item => item.id === selectedItem)
    if (parentItem) {
      return `#${parentItem.sr_no} - ${parentItem.item_name}`
    }

    // Check if it's a sub-item
    for (const item of inventoryItems) {
      const subItem = item.sub_items?.find(sub => sub.id === selectedItem)
      if (subItem) {
        return `#${item.sr_no} - ${item.item_name} → ${subItem.item_name}`
      }
    }

    return "Select an item from inventory..."
  }

  // Filter items based on search term
  const filteredItems = inventoryItems.filter(item => {
    if (!searchTerm) return true

    const searchLower = searchTerm.toLowerCase()

    // Check if parent item matches
    const parentMatches =
      item.item_name.toLowerCase().includes(searchLower) ||
      item.sr_no?.toString().includes(searchTerm)

    // Check if any sub-item matches
    const subItemMatches = item.sub_items?.some(sub =>
      sub.item_name.toLowerCase().includes(searchLower)
    )

    return parentMatches || subItemMatches
  })

  // Auto-expand items with matching sub-items when searching
  useEffect(() => {
    if (searchTerm) {
      const newExpanded = new Set<string>()
      inventoryItems.forEach(item => {
        const hasMatchingSubItem = item.sub_items?.some(sub =>
          sub.item_name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        if (hasMatchingSubItem) {
          newExpanded.add(item.id)
        }
      })
      setExpandedItems(newExpanded)
    }
  }, [searchTerm, inventoryItems])

  // Reset search when dropdown closes
  useEffect(() => {
    if (!isDropdownOpen) {
      setSearchTerm("")
    }
  }, [isDropdownOpen])

  // Initialize dispatch quantities when modal opens
  useEffect(() => {
    if (showDispatchModal && order?.items) {
      const initialQuantities: Record<string, number> = {}
      order.items.forEach(item => {
        const remainingToDispatch = Math.max(0, item.quantity - getNetDispatchedForItem(item.id))
        initialQuantities[item.id] = dispatchType === "full" ? remainingToDispatch : 0
      })
      setDispatchQuantities(initialQuantities)
    }
  }, [showDispatchModal, dispatchType, order?.items, getNetDispatchedForItem])

  const handleDownloadLatestTrackingSlip = async () => {
    if (!order) return

    setGeneratingTrackingSlip("universal")
    try {
      let dispatchData: any

      if (dispatches.length > 0) {
        // Sort dispatches by date descending to get the latest
        const latestDispatch = [...dispatches].sort((a, b) =>
          new Date(b.dispatch_date || 0).getTime() - new Date(a.dispatch_date || 0).getTime()
        )[0]

        // Find the associated production record for this dispatch if it exists
        const productionRecord = productionRecords.find(pr => pr.id === latestDispatch.production_record_id)

        // Map dispatch items for the PDF
        const dispatchItems = latestDispatch.dispatch_items?.map((di: any) => {
          const orderItem = order.items.find((item: any) => item.id === di.order_item_id)
          let itemName = "Item"

          if (orderItem) {
            let inventoryItem = inventoryItems.find((item: any) => item.id === orderItem.inventory_item_id || item.id === orderItem.product_id)
            let subItem

            if (!inventoryItem) {
              for (const parentItem of inventoryItems) {
                subItem = parentItem.sub_items?.find((sub: any) =>
                  sub.id === orderItem.inventory_item_id || sub.id === orderItem.product_id
                )
                if (subItem) {
                  inventoryItem = parentItem
                  break
                }
              }
            }

            itemName = subItem
              ? `${inventoryItem?.item_name || ""} → ${subItem.item_name}`
              : inventoryItem?.item_name || "Item"
          }

          return {
            name: itemName,
            quantity: di.quantity
          }
        }) || []

        dispatchData = {
          dispatchType: latestDispatch.dispatch_type || 'full',
          dispatchDate: latestDispatch.dispatch_date || new Date().toISOString(),
          trackingId: latestDispatch.tracking_id || 'TBA',
          courierName: latestDispatch.courier_companies?.name || 'Standard Delivery',
          productionNumber: productionRecord?.production_number,
          items: dispatchItems
        }
      } else {
        // No dispatches yet - generate a "Pending" slip with all order items
        const allItems = order.items.map((oi: any) => {
          let itemName = "Item"
          let inventoryItem = inventoryItems.find((item: any) => item.id === oi.inventory_item_id || item.id === oi.product_id)
          let subItem

          if (!inventoryItem) {
            for (const parentItem of inventoryItems) {
              subItem = parentItem.sub_items?.find((sub: any) =>
                sub.id === oi.inventory_item_id || sub.id === oi.product_id
              )
              if (subItem) {
                inventoryItem = parentItem
                break
              }
            }
          }

          itemName = subItem
            ? `${inventoryItem?.item_name || ""} → ${subItem.item_name}`
            : inventoryItem?.item_name || "Item"

          return {
            name: itemName,
            quantity: oi.quantity
          }
        })

        dispatchData = {
          dispatchType: 'Full Order (Pending)',
          dispatchDate: new Date().toISOString(),
          trackingId: 'TBA',
          courierName: 'Shipment Pending',
          items: allItems
        }
      }

      const logoDataUrl = await fetchLogoDataUrl()
      const { blob, filename } = generateTrackingSlipPDF(order, dispatchData, { logoDataUrl })

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setSuccess("Tracking slip generated successfully!")
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message || "Failed to generate tracking slip")
    } finally {
      setGeneratingTrackingSlip(null)
    }
  }

  const handleOpenDispatchModal = (type: "partial" | "full") => {
    if (!order?.items || order.items.length === 0) {
      setError("Cannot dispatch: Order has no items")
      return
    }
    setDispatchType(type)
    setShowDispatchModal(true)
    setDispatchNotes("")
    setSelectedCourierCompany("")
    setTrackingId("")
    setError(null)
  }

  const handleDispatchQuantityChange = (orderItemId: string, quantity: number) => {
    const orderItem = order?.items?.find(item => item.id === orderItemId)
    if (!orderItem) return

    const maxQuantity = Math.max(0, orderItem.quantity - getNetDispatchedForItem(orderItemId))
    const newQuantity = Math.max(0, Math.min(quantity, maxQuantity))

    setDispatchQuantities(prev => ({
      ...prev,
      [orderItemId]: newQuantity
    }))
  }

  const handleCreateDispatch = async () => {
    if (!dispatchType || !order) return

    // Validate quantities
    const dispatchItems = Object.entries(dispatchQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([orderItemId, quantity]) => ({ order_item_id: orderItemId, quantity }))

    if (dispatchItems.length === 0) {
      setError("Please specify quantities for at least one item")
      return
    }

    setDispatching(true)
    setError(null)

    try {
      const result = await createDispatch(
        order.id,
        dispatchType,
        dispatchItems,
        dispatchNotes || undefined,
        selectedCourierCompany || undefined,
        trackingId || undefined
      )

      if (result.success) {
        setSuccess(`Order ${dispatchType === "full" ? "fully" : "partially"} dispatched successfully!`)
        setShowDispatchModal(false)
        setDispatchType(null)
        setDispatchQuantities({})
        setDispatchNotes("")
        setSelectedCourierCompany("")
        setTrackingId("")
        await loadOrderDetails()
        await loadDispatches()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error || "Failed to create dispatch")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setDispatching(false)
    }
  }

  const handleUpdatePayment = async () => {
    setError(null)
    try {
      let zohoDetails = null
      if (zohoBillingDetails.trim()) {
        try {
          zohoDetails = JSON.parse(zohoBillingDetails)
        } catch {
          // If not valid JSON, store as string in a JSON object
          zohoDetails = { details: zohoBillingDetails }
        }
      }

      // Derive status from actual payment summary so "Update" reflects collected payments
      const statusToSend =
        paymentSummary.amountDue === 0
          ? "complete"
          : paymentSummary.totalPaid > 0
            ? "partial"
            : "pending"
      const partialAmt = statusToSend === "partial" ? paymentSummary.totalPaid : undefined
      const remainingAmt = statusToSend === "partial" ? paymentSummary.amountDue : undefined

      const result = await updateOrderPayment(
        orderId,
        invoiceNumber || undefined,
        zohoDetails,
        statusToSend,
        paymentDate || undefined,
        partialAmt,
        remainingAmt
      )

      if (result.success) {
        setSuccess("Payment details updated successfully!")
        await loadOrderDetails()
        setPaymentStatus(statusToSend)
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error || "Failed to update payment details")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    }
  }

  const handleAddPaymentRecord = async () => {
    setError(null)

    if (!paymentSummary.hasRequestedPayment) {
      setError("Please set Requested Payment before adding payment records.")
      return
    }

    const amount = parseFloat(paymentAmount)
    if (!amount || isNaN(amount) || amount <= 0) {
      setError("Please enter a valid payment amount")
      return
    }

    if (amount > paymentSummary.amountDue) {
      setError(`Amount cannot exceed remaining amount (₹${paymentSummary.amountDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}).`)
      return
    }

    // Use paymentDate state if user selected a date; otherwise the server action defaults to today
    const payDate = paymentDate || undefined

    setAddingPayment(true)
    try {
      const result = await addOrderPayment(
        orderId,
        amount,
        payDate,
        paymentMethod || undefined,
        paymentReference || undefined,
        paymentNotes || undefined
      )

      if (result.success) {
        setSuccess("Payment record added successfully!")
        setPaymentAmount("")
        setPaymentMethod("")
        setPaymentReference("")
        setPaymentNotes("")
        await loadOrderPayments()
        setTimeout(() => setSuccess(null), 2500)
      } else {
        setError(result.error || "Failed to add payment record")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setAddingPayment(false)
    }
  }

  const handleUpdateFollowup = async (
    followupId: string,
    paymentReceived: boolean,
    paymentDate?: string,
    notes?: string
  ) => {
    try {
      const result = await updatePaymentFollowup(followupId, paymentReceived, paymentDate, notes)
      if (result.success) {
        setSuccess("Payment followup updated successfully!")
        await loadPaymentFollowups()
        setTimeout(() => setSuccess(null), 2000)
      } else {
        setError(result.error || "Failed to update followup")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    }
  }

  const handleDeleteOrder = async () => {
    setError(null)
    try {
      const result = await deleteOrder(orderId)
      if (result.success) {
        router.push("/dashboard/orders")
      } else {
        setError(result.error || "Failed to delete order")
        setShowDeleteConfirm(false)
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
      setShowDeleteConfirm(false)
    }
  }

  const handleFileUpload = async (dispatchId: string | null, file: File) => {
    // For now, we'll use a placeholder URL
    // In production, you'd upload to Supabase Storage or another service
    const fileUrl = URL.createObjectURL(file)

    try {
      const result = await uploadProductionPDF(
        orderId,
        dispatchId,
        file.name,
        fileUrl,
        file.size
      )

      if (result.success) {
        setSuccess("Production PDF uploaded successfully!")
        await loadDispatches()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error || "Failed to upload PDF")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    }
  }

  const handleInvoiceAttachmentUpload = async (file: File) => {
    setUploadingInvoiceAttachment(true)
    setError(null)

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64String = reader.result as string
          const base64Data = base64String.split(',')[1] || base64String
          resolve(base64Data)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const result = await uploadInvoiceAttachment(
        orderId,
        base64,
        file.name,
        file.type,
        file.size
      )

      if (result.success) {
        setSuccess("Invoice attachment uploaded successfully!")
        await loadInvoiceAttachments()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error || "Failed to upload invoice attachment")
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload invoice attachment")
    } finally {
      setUploadingInvoiceAttachment(false)
    }
  }

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setError("Quantity must be greater than 0")
      return
    }

    try {
      const result = await updateOrderItemQuantity(itemId, newQuantity)
      if (result.success) {
        setSuccess("Quantity updated successfully!")
        await loadOrderDetails()
        setTimeout(() => setSuccess(null), 2000)
      } else {
        setError(result.error || "Failed to update quantity")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    }
  }

  const handleRemoveItem = async (itemId: string, itemName?: string) => {
    try {
      const result = await removeItemFromOrder(itemId) as any

      if (result.success) {
        setSuccess("Item removed from order successfully!")
        await loadOrderDetails()
        setTimeout(() => setSuccess(null), 2000)
      } else {
        // Check if this is a dispatched item error
        if (result.canCreateReturn && result.dispatchedQuantity) {
          const confirmReturn = confirm(
            `${result.error}\n\nWould you like to create a return dispatch now?\n\nThis will:\n1. Create a return record for ${result.dispatchedQuantity} dispatched units\n2. Allow you to delete the item afterwards\n\nClick OK to proceed with return dispatch, or Cancel to keep the item.`
          )

          if (confirmReturn) {
            const returnResult = await createReturnDispatch(orderId, [{
              order_item_id: itemId,
              quantity: result.dispatchedQuantity
            }], `Auto return dispatch for item removal${itemName ? `: ${itemName}` : ''}`)

            if (!returnResult.success) {
              setError(returnResult.error || "Failed to create return dispatch")
              return
            }

            const retryResult = await removeItemFromOrder(itemId) as any
            if (retryResult.success) {
              setSuccess("Return dispatch created and item removed successfully!")
              await Promise.all([loadOrderDetails(), loadDispatches()])
              setTimeout(() => setSuccess(null), 3000)
            } else {
              setError(retryResult.error || "Return dispatch created, but item removal failed")
            }
          } else {
            setError(result.error)
          }
        } else {
          setError(result.error || "Failed to remove item")
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 pb-20">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>

        <div className="space-y-4">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    )
  }

  if (error && !order) {
    return (
      <div className="space-y-6 pb-8">
        <div className="p-4 text-sm text-red-700 bg-red-50 border-l-4 border-red-500 rounded-r-md">
          {error}
        </div>
        <Button onClick={() => router.back()} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    )
  }

  if (!order) {
    return null
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header Section */}
      <div className="pb-0 border-b-0">
        {/* Header Top: Back link + Order # + Date */}
        <div className="flex items-baseline gap-4 mb-3">
          <button
            onClick={() => router.back()}
            className="text-sm text-slate-400 hover:text-orange-500 transition-colors cursor-pointer font-medium flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Orders
          </button>
        </div>
        
        {/* Order Title + Date */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-slate-900">
              Order #{order.internal_order_number || order.sales_order_number || order.id.slice(0, 8)}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {new Date(order.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          </div>

          {/* Header Buttons Group */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadLatestTrackingSlip}
              disabled={generatingTrackingSlip !== null}
              className="h-9 px-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2"
            >
              {generatingTrackingSlip !== null ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              <span className="hidden sm:inline text-sm">Tracking Slip</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditModal(true)}
              className="h-9 px-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">Edit</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="h-9 px-3 border border-red-200 bg-white hover:bg-red-50 text-red-600 hover:text-red-700 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">Delete</span>
            </Button>
          </div>
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

      {/* Customer Information - Always visible */}
      <Card className="bg-white border border-slate-200 border-l-4 border-l-orange-500 rounded-none md:rounded-lg shadow-none">
        <div className="pl-0">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Customer Information</h2>
          </div>
          <div className="px-6 py-5 space-y-5">
            {/* Customer Name Row with Initials */}
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-orange-50 text-orange-700 font-semibold text-base flex items-center justify-center flex-shrink-0">
                {order.customers?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || "?"}
              </div>
              <div className="flex-1">
                <p className="text-lg font-semibold text-slate-900">{order.customers?.name || "-"}</p>
                {order.customers?.phone && (
                  <p className="text-sm text-slate-600 mt-0.5 flex items-center gap-2">
                    {order.customers.phone}
                  </p>
                )}
              </div>
            </div>

            {/* Email and Phone Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Email</p>
                <p className="text-sm text-slate-900">{order.customers?.email || "-"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Phone</p>
                <p className="text-sm text-slate-900">{order.customers?.phone || "-"}</p>
              </div>
            </div>

            {/* Address */}
            {order.customers?.address && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Address</p>
                <p className="text-sm text-slate-600 leading-relaxed">{order.customers.address}</p>
              </div>
            )}

            {/* Status Badges */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
              {/* Order Status Badge */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Order Status</p>
                <span 
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${
                    order.order_status === 'Delivered' ? 'bg-green-100 text-green-700' :
                    order.order_status === 'In Transit' ? 'bg-blue-100 text-blue-700' :
                    order.order_status === 'Ready for Dispatch' ? 'bg-purple-100 text-purple-700' :
                    order.order_status === 'Partial Delivered' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-700'
                  }`}
                >
                  {order.order_status}
                </span>
              </div>

              {/* Payment Status Badge */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Payment Status</p>
                <span 
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${
                    derivedPaymentStatus === 'complete' ? 'bg-green-100 text-green-700' :
                    derivedPaymentStatus === 'partial' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}
                >
                  {derivedPaymentStatus === 'complete' ? 'Paid' : 
                   derivedPaymentStatus === 'partial' ? 'Partial' : 
                   'Pending'}
                </span>
              </div>

              {/* Cash Discount Badge */}
              {order.cash_discount && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Discount</p>
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                    Cash Discount
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs Section - horizontal scroll on mobile, grid on desktop */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-nowrap overflow-x-auto lg:overflow-visible gap-0 w-full border-b border-slate-200 bg-transparent p-0">
          <TabsTrigger 
            value="items" 
            className="relative flex-shrink-0 rounded-none border-b-2 border-transparent px-5 py-3 font-medium text-sm text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500 data-[state=active]:text-orange-500 data-[state=active]:bg-transparent"
          >
            <Package className="w-4 h-4 mr-2 inline" />
            Items
          </TabsTrigger>

          <TabsTrigger 
            value="production" 
            className="relative flex-shrink-0 rounded-none border-b-2 border-transparent px-5 py-3 font-medium text-sm text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500 data-[state=active]:text-orange-500 data-[state=active]:bg-transparent flex items-center"
          >
            <Factory className="w-4 h-4 mr-2" />
            Production
            {tabRemainingCounts.productionRemaining > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold bg-orange-500 text-white" title={`${tabRemainingCounts.productionRemaining} item(s) remaining to produce`}>
                {tabRemainingCounts.productionRemaining}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger 
            value="shipment" 
            className="relative flex-shrink-0 rounded-none border-b-2 border-transparent px-5 py-3 font-medium text-sm text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500 data-[state=active]:text-orange-500 data-[state=active]:bg-transparent flex items-center"
          >
            <Truck className="w-4 h-4 mr-2" />
            Shipment
            {tabRemainingCounts.shipmentRemaining > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold bg-orange-500 text-white" title="Items remaining to dispatch or dispatch(es) not yet delivered">
                {tabRemainingCounts.shipmentRemaining}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger 
            value="payment" 
            className="relative flex-shrink-0 rounded-none border-b-2 border-transparent px-5 py-3 font-medium text-sm text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500 data-[state=active]:text-orange-500 data-[state=active]:bg-transparent flex items-center"
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Payment
            {tabRemainingCounts.paymentDue && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold bg-orange-500 text-white" title={`₹${paymentSummary.amountDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })} due`}>
                Due
              </span>
            )}
          </TabsTrigger>

          {(order.cash_discount || paymentFollowups.length > 0 || paymentSummary.amountDue > 0) && (
            <TabsTrigger 
              value="followup" 
              className="relative flex-shrink-0 rounded-none border-b-2 border-transparent px-5 py-3 font-medium text-sm text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500 data-[state=active]:text-orange-500 data-[state=active]:bg-transparent"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Payment Followup
            </TabsTrigger>
          )}
        </TabsList>

        {/* Items Tab */}
        <TabsContent value="items" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-6">
              {/* Add Items Section */}
              <div className="bg-white border border-slate-200 rounded-lg shadow-none">
                <div className="px-6 py-5 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <Plus className="w-4 h-4 text-orange-500" />
                    Add Items to Order
                  </h2>
                  <p className="text-xs text-slate-400 mt-2">Select items from inventory and specify quantities</p>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="md:col-span-2 relative">
                        <Label htmlFor="item-select" className="text-sm font-semibold text-slate-700 mb-2 block">
                          Select Item <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="flex h-10 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:ring-3 focus:ring-orange-500 focus:ring-opacity-10 transition-all"
                          >
                            <span className={selectedItem ? "text-slate-900" : "text-slate-400"}>
                              {getSelectedItemName()}
                            </span>
                            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                          </button>

                          {isDropdownOpen && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setIsDropdownOpen(false)}
                              />
                              <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-80 overflow-hidden flex flex-col">
                                {/* Search Input */}
                                <div className="p-2 border-b border-slate-200 bg-slate-50 sticky top-0">
                                  <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <Input
                                      type="text"
                                      placeholder="Type to search items..."
                                      value={searchTerm}
                                      onChange={(e) => setSearchTerm(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Escape") {
                                          setIsDropdownOpen(false)
                                        }
                                        e.stopPropagation()
                                      }}
                                      className="pl-8 pr-8 h-9 text-sm border-slate-200 focus:border-orange-500 focus:ring-orange-500"
                                      autoFocus
                                    />
                                    {searchTerm && (
                                      <button
                                        onClick={() => setSearchTerm("")}
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded hover:bg-slate-200"
                                        title="Clear search"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Items List */}
                                <div className="overflow-y-auto flex-1">
                                  {filteredItems.length === 0 ? (
                                    <div className="px-3 py-4 text-sm text-slate-500 text-center">
                                      No items found matching &quot;{searchTerm}&quot;
                                    </div>
                                  ) : (
                                    <div className="py-1">
                                      {filteredItems.map((item) => {
                                        // Filter sub-items based on search term
                                        const filteredSubItems = item.sub_items?.filter(sub => {
                                          if (!searchTerm) return true
                                          return sub.item_name.toLowerCase().includes(searchTerm.toLowerCase())
                                        })

                                        // Show parent item if it matches or has matching sub-items
                                        const showParent = !searchTerm ||
                                          item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          item.sr_no?.toString().includes(searchTerm) ||
                                          (filteredSubItems && filteredSubItems.length > 0)

                                        if (!showParent) return null

                                        return (
                                          <div key={item.id}>
                                            {/* Parent Item */}
                                            <div
                                              className={`px-3 py-2 text-sm cursor-pointer hover:bg-orange-50 transition-colors ${selectedItem === item.id ? "bg-orange-100" : ""
                                                }`}
                                              onClick={() => handleItemSelect(item.id)}
                                            >
                                              <div className="flex items-center justify-between">
                                                <span className="font-medium text-slate-900">
                                                  #{item.sr_no} - {item.item_name}
                                                </span>
                                                {item.sub_items && item.sub_items.length > 0 && (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      toggleItemExpansion(item.id)
                                                    }}
                                                    className="p-1 hover:bg-orange-200 rounded transition-colors"
                                                  >
                                                    {expandedItems.has(item.id) ? (
                                                      <ChevronDown className="w-4 h-4 text-slate-600" />
                                                    ) : (
                                                      <ChevronRight className="w-4 h-4 text-slate-600" />
                                                    )}
                                                  </button>
                                                )}
                                              </div>
                                            </div>

                                            {/* Sub-items */}
                                            {item.sub_items && item.sub_items.length > 0 && expandedItems.has(item.id) && (
                                              <div className="bg-slate-50 border-l-2 border-orange-300">
                                                {filteredSubItems && filteredSubItems.length > 0 ? (
                                                  filteredSubItems.map((subItem) => (
                                                    <div
                                                      key={subItem.id}
                                                      className={`px-6 py-2 text-sm cursor-pointer hover:bg-orange-50 transition-colors ${selectedItem === subItem.id ? "bg-orange-100" : ""
                                                        }`}
                                                      onClick={() => handleItemSelect(subItem.id)}
                                                    >
                                                      <div className="flex items-center gap-2">
                                                        <span className="text-slate-400">└─</span>
                                                        <span className="text-slate-700">
                                                          {subItem.item_name}
                                                        </span>
                                                        <span className="text-xs text-slate-500 ml-auto">
                                                          Sub Item
                                                        </span>
                                                      </div>
                                                    </div>
                                                  ))
                                                ) : (
                                                  searchTerm && (
                                                    <div className="px-6 py-2 text-xs text-slate-400">
                                                      No sub-items match your search
                                                    </div>
                                                  )
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="quantity" className="text-sm font-semibold text-slate-700 mb-2 block">
                          Quantity <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="quantity"
                          type="text"
                          inputMode="numeric"
                          value={quantity}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, "")
                            const num = raw === "" ? 1 : Math.max(1, parseInt(raw, 10))
                            setQuantity(num)
                          }}
                          className="h-10 border border-slate-200 rounded-lg focus:border-orange-500 focus:ring-orange-500 focus:ring-opacity-10"
                          placeholder="e.g. 1, 10, 100"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleAddItem}
                      disabled={addingItem || !selectedItem || quantity <= 0}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white h-10 rounded-lg font-medium transition-colors"
                    >
                      {addingItem ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Item to Order
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Order Items */}
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-lg shadow-none overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    Order Items
                    <span className="text-xs font-normal text-slate-400 ml-1">
                      ({order.items?.length || 0})
                    </span>
                  </h2>
                </div>
                <div className="p-0">
                  {!order.items || order.items.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 font-medium">No items added yet</p>
                      <p className="text-sm text-slate-400 mt-1">Add items using the form on the left</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left px-4 py-3 font-semibold text-xs text-slate-600 uppercase tracking-wider">Item</th>
                            <th className="text-left px-4 py-3 font-semibold text-xs text-slate-600 uppercase tracking-wider">Qty</th>
                            <th className="text-left px-4 py-3 font-semibold text-xs text-slate-600 uppercase tracking-wider">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items.map((item, index) => {
                            // Find inventory item by matching inventory_item_id or product_id with inventory item id
                            let inventoryItem: InventoryItem | undefined
                            let subItem: SubItem | undefined

                            // Check if it's a parent item
                            inventoryItem = inventoryItems.find(inv =>
                              inv.id === item.inventory_item_id || inv.id === item.product_id
                            )

                            // If not found as parent, check if it's a sub-item
                            if (!inventoryItem) {
                              for (const parentItem of inventoryItems) {
                                subItem = parentItem.sub_items?.find(sub =>
                                  sub.id === item.inventory_item_id || sub.id === item.product_id
                                )
                                if (subItem) {
                                  inventoryItem = parentItem
                                  break
                                }
                              }
                            }

                            const displayName = subItem
                              ? `${inventoryItem?.item_name || ""} → ${subItem.item_name}`
                              : inventoryItem?.item_name || `Item ${index + 1}`

                            return (
                              <tr key={item.id} className="border-b border-slate-100 hover:bg-orange-50 transition-colors h-12">
                                <td className="px-4 py-3">
                                  <span className="text-sm font-medium text-slate-900">
                                    {displayName}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => {
                                        const newQty = parseInt(e.target.value) || 1
                                        handleUpdateQuantity(item.id, newQty)
                                      }}
                                      className="w-16 h-8 text-sm border border-slate-200 rounded-lg focus:border-orange-500 focus:ring-orange-500"
                                    />
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <button
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="w-7 h-7 flex items-center justify-center rounded-full text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                                    title="Remove item"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Production Tab */}
        <TabsContent value="production" className="space-y-6 mt-6">
          {/* Production Management Card */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-none">
            <div className="px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <Factory className="w-4 h-4" />
                  Production Management
                </h2>
              </div>

              {/* Order Type Toggle - Hidden if Full Order already exists */}
              {!(productionRecords.length > 0 && productionRecords[0]?.production_type === "full") && (
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 self-start md:self-center">
                  <button
                    type="button"
                    onClick={() => {
                      setProductionType("full")
                      setProductionQuantities({})
                    }}
                    disabled={productionRecords.length > 0}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${productionType === "full"
                      ? "bg-orange-500 text-white"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent"
                      }`}
                  >
                    Full Order
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductionType("partial")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${productionType === "partial"
                      ? "bg-orange-500 text-white"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white"
                      }`}
                  >
                    Partial Order
                  </button>
                </div>
              )}
            </div>

            <div className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Item Details</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Ordered</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Produced</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Remaining</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-32">To Produce</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!order?.items || order.items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                          <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                          No items added to this order yet.
                        </td>
                      </tr>
                    ) : (
                      order.items.map((item, index) => {
                        // Find inventory item for display name
                        let inventoryItem: InventoryItem | undefined
                        let subItem: SubItem | undefined

                        inventoryItem = inventoryItems.find(inv =>
                          inv.id === item.inventory_item_id || inv.id === item.product_id
                        )

                        if (!inventoryItem) {
                          for (const parentItem of inventoryItems) {
                            subItem = parentItem.sub_items?.find(sub =>
                              sub.id === item.inventory_item_id || sub.id === item.product_id
                            )
                            if (subItem) {
                              inventoryItem = parentItem
                              break
                            }
                          }
                        }

                        const displayName = subItem
                          ? `${inventoryItem?.item_name || ""} → ${subItem.item_name}`
                          : inventoryItem?.item_name || `Item ${index + 1}`

                        const srNo = inventoryItem?.sr_no

                        // Calculate produced quantity from all production records
                        const producedQty = productionRecords.reduce((sum, record) => {
                          if (record.selected_quantities && record.selected_quantities[item.id]) {
                            return sum + (record.selected_quantities[item.id] as number)
                          }
                          // For full production, use the full item quantity
                          if (record.production_type === "full") {
                            return item.quantity
                          }
                          return sum
                        }, 0)

                        const remainingQty = Math.max(0, item.quantity - producedQty)
                        const isComplete = remainingQty <= 0

                        // For Full Order mode, use remaining quantity as default, otherwise use manual state
                        const displayToProduce = productionType === "full" ? remainingQty : (productionQuantities[item.id] || 0)

                        return (
                          <tr key={item.id} className="hover:bg-orange-50 transition-colors h-13">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                {srNo && (
                                  <span className="text-xs font-semibold text-slate-300 w-6 h-6 rounded flex items-center justify-center flex-shrink-0">
                                    {srNo}
                                  </span>
                                )}
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-slate-900">{displayName}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-center font-medium text-slate-600">{item.quantity}</td>
                            <td className="px-4 py-4 text-sm text-center font-medium text-slate-600">{producedQty}</td>
                            <td className="px-4 py-4 text-center">
                              {isComplete ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full border-0">
                                  <Check className="w-3.5 h-3.5" /> Complete
                                </span>
                              ) : (
                                <span className="text-sm font-semibold text-orange-600">{remainingQty}</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Input
                                type="number"
                                min="0"
                                max={remainingQty}
                                value={displayToProduce}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0
                                  setProductionQuantities(prev => ({
                                    ...prev,
                                    [item.id]: Math.max(0, Math.min(val, remainingQty))
                                  }))
                                  // Switch to partial mode if user edits manually
                                  if (productionType === "full") setProductionType("partial")
                                }}
                                className={`w-16 h-8 text-center font-semibold mx-auto border border-slate-200 rounded-lg transition-all ${productionType === "full"
                                  ? "bg-slate-50 text-slate-600"
                                  : "bg-white"
                                  }`}
                                disabled={isComplete || (productionRecords.length > 0 && productionRecords[0]?.production_type === "full")}
                              />
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Production Action Bar */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                {productionRecords.length > 0 && (
                  <div className="flex items-start gap-2 text-xs text-slate-700 bg-blue-50 border border-blue-200 rounded-lg p-3 flex-1">
                    <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <span>
                      Order Type fixed to <strong>{productionRecords[0].production_type === "full" ? "Full" : "Partial"}</strong> due to existing records.
                    </span>
                  </div>
                )}

                <Button
                  onClick={handleCreateProductionRecord}
                  disabled={
                    !order?.items ||
                    order.items.length === 0 ||
                    order.order_status === "Void" ||
                    creatingRecord ||
                    (productionType === "partial" && Object.values(productionQuantities).every(qty => qty === 0)) ||
                    (productionRecords.length > 0 && productionRecords[0]?.production_type === "full")
                  }
                  className="bg-orange-500 hover:bg-orange-600 text-white h-9 px-4 rounded-lg font-medium transition-colors whitespace-nowrap"
                >
                  {creatingRecord ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin inline" />
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2 inline" />
                      Create Production Record
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Existing Production Records History */}
          {productionRecords.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg shadow-none overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <File className="w-4 h-4" />
                  Production History
                </h2>
              </div>
              <div className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Record</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">PDF</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {productionRecords.slice().reverse().map((record) => (
                        <tr key={record.id} className="hover:bg-orange-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1.5">
                              <span className="text-sm font-semibold text-slate-900">{record.production_number}</span>
                              <span className="text-xs text-slate-500">All items produced</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${record.production_type === "full"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-orange-100 text-orange-700"
                              }`}>
                              {record.production_type.charAt(0).toUpperCase() + record.production_type.slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${record.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : record.status === "in_production"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                              }`}>
                              {record.status === "completed" ? "✓ Complete" : record.status.replace('_', ' ').charAt(0).toUpperCase() + record.status.slice(1).replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center text-xs text-slate-600">
                            {new Date(record.created_at).toLocaleDateString('en-IN')}
                          </td>
                          <td className="px-4 py-4 text-center">
                            {record.pdf_file_url ? (
                              <button
                                onClick={() => window.open(record.pdf_file_url, '_blank')}
                                className="text-orange-500 hover:text-orange-600 font-medium text-xs transition-colors"
                              >
                                <FileDown className="w-4 h-4 inline mr-1" />
                                View PDF
                              </button>
                            ) : (
                              <span className="text-xs text-slate-300">No PDF</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {record.status === "pending" && (
                                <Button
                                  size="sm"
                                  onClick={async () => {
                                    const result = await updateProductionRecordStatus(record.id, "in_production")
                                    if (result.success) {
                                      await loadProductionRecords()
                                      setSuccess("Started!")
                                      setTimeout(() => setSuccess(null), 2000)
                                    } else {
                                      setError(result.error || "Failed")
                                    }
                                  }}
                                  className="h-7 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-3"
                                >
                                  START
                                </Button>
                              )}
                              {record.status === "in_production" && (
                                <Button
                                  size="sm"
                                  onClick={async () => {
                                    const result = await updateProductionRecordStatus(record.id, "completed")
                                    if (result.success) {
                                      await loadProductionRecords()
                                      setSuccess("Completed!")
                                      setTimeout(() => setSuccess(null), 2000)
                                    } else {
                                      setError(result.error || "Failed")
                                    }
                                  }}
                                  className="h-7 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg px-3"
                                >
                                  DONE
                                </Button>
                              )}
                              {(record.status === "pending" || record.status === "in_production") && (
                                <button
                                  onClick={async () => {
                                    if (confirm("Delete this record?")) {
                                      const result = await deleteProductionRecord(record.id)
                                      if (result.success) {
                                        await loadProductionRecords()
                                        setSuccess("Deleted!")
                                        setTimeout(() => setSuccess(null), 2000)
                                      } else {
                                        setError(result.error || "Failed")
                                      }
                                    }
                                  }}
                                  className="w-7 h-7 flex items-center justify-center rounded-full text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </TabsContent>


        {/* Shipment Tab */}
        <TabsContent value="shipment" className="space-y-6 mt-6">
          <Card className="shadow-sm">
            <CardHeader className="bg-gray-50 border-b">
              <CardTitle className="flex items-center gap-2.5 text-lg font-semibold text-gray-900">
                <Truck className="w-5 h-5 text-blue-600" />
                Dispatch & Shipment Details
              </CardTitle>
              <CardDescription className="mt-1">
                Manage order dispatches, courier information, and tracking
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {/* Show Production Records Ready for Dispatch (without dispatches) */}
              {productionRecords.length > 0 && (
                <div className="mb-6">
                  {productionRecords
                    .filter(record => {
                      // Show only completed records that don't have a dispatch yet
                      const hasDispatch = dispatches.some(d => d.production_records?.id === record.id)
                      return record.status === "completed" && !hasDispatch
                    })
                    .map((record) => (
                      <Card key={record.id} className="border border-blue-200 bg-blue-50/30 mb-4">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-base font-semibold text-gray-900">{record.production_number}</span>
                              <span className={`text-xs px-2 py-1 rounded ${record.production_type === "full"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-orange-100 text-orange-700"
                                }`}>
                                {record.production_type === "full" ? "Full" : "Partial"}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded ${record.status === "completed"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                                }`}>
                                {record.status === "completed" ? "Completed" : "In Production"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {record.pdf_file_url && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(record.pdf_file_url, '_blank')}
                                  className="h-8 text-xs"
                                >
                                  <File className="w-4 h-4 mr-1" />
                                  View PDF
                                </Button>
                              )}
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedProductionRecord(record)
                                  setShowDispatchForm(true)
                                  setSelectedCourierCompany("")
                                  setTrackingId("")
                                  setDispatchNotes("")
                                }}
                                className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                              >
                                <Truck className="w-4 h-4 mr-1" />
                                Create Dispatch
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}

              {dispatches.length === 0 && productionRecords.length === 0 ? (
                <div className="text-center py-12">
                  <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No dispatches yet</p>
                  <p className="text-sm text-gray-400 mt-1">Create a production record first, then create a dispatch from here</p>
                </div>
              ) : dispatches.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 font-medium">No dispatches created yet</p>
                  <p className="text-sm text-gray-400 mt-1">Use the &quot;Create Dispatch&quot; button above to create a dispatch for a production record</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dispatches.map((dispatch) => {
                    const shipmentStatus = dispatch.shipment_status || 'ready'
                    const statusSteps = [
                      { value: 'ready', label: 'Ready', icon: Package, color: 'yellow' },
                      { value: 'picked_up', label: 'Picked Up', icon: Truck, color: 'blue' },
                      { value: 'delivered', label: 'Delivered', icon: CheckCircle2, color: 'green' }
                    ]
                    const currentStepIndex = statusSteps.findIndex(s => s.value === shipmentStatus)

                    // Use production record from dispatch (already included in query)
                    const productionRecord = dispatch.production_records

                    return (
                      <Card key={dispatch.id} className="border border-gray-200 shadow-sm">
                        <CardHeader className="bg-white border-b pb-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-base font-semibold text-gray-900 mb-1">
                                {dispatch.dispatch_type === "full" ? "Full" : "Partial"} Dispatch
                              </CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-500">
                                  {new Date(dispatch.dispatch_date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </span>
                              </div>
                            </div>
                            <span className={`px-2.5 py-1 rounded text-xs font-medium ${dispatch.dispatch_type === "full"
                              ? "bg-green-100 text-green-700"
                              : "bg-blue-100 text-blue-700"
                              }`}>
                              {dispatch.dispatch_type === "full" ? "Full" : "Partial"}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-5">
                          <div className="space-y-5">
                            {/* Production Record Info */}
                            {productionRecord && (
                              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <Label className="text-sm font-semibold text-gray-700 mb-3 block">Production Record</Label>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <span className="text-base font-semibold text-gray-900">{productionRecord.production_number}</span>
                                    <span className={`text-xs px-2 py-1 rounded ${productionRecord.production_type === "full"
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-orange-100 text-orange-700"
                                      }`}>
                                      {productionRecord.production_type === "full" ? "Full" : "Partial"}
                                    </span>
                                    <span className={`text-xs px-2 py-1 rounded ${productionRecord.status === "completed"
                                      ? "bg-green-100 text-green-700"
                                      : "bg-yellow-100 text-yellow-700"
                                      }`}>
                                      {productionRecord.status === "completed" ? "Completed" : "In Production"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {productionRecord.pdf_file_url && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.open(productionRecord.pdf_file_url, '_blank')}
                                        className="h-8 text-xs"
                                      >
                                        <File className="w-4 h-4 mr-1" />
                                        View PDF
                                      </Button>
                                    )}
                                    <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                      <Check className="w-4 h-4" />
                                      Dispatched
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <Label className="text-sm font-semibold text-gray-700">
                                  Shipment Status
                                </Label>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setExpandedShipments(prev => ({
                                    ...prev,
                                    [dispatch.id]: !prev[dispatch.id]
                                  }))}
                                  className="h-8 py-0 px-2 text-blue-600 hover:text-blue-800 hover:bg-orange-50 gap-1.5"
                                >
                                  {expandedShipments[dispatch.id] ? (
                                    <>
                                      <span className="text-xs font-bold uppercase tracking-wider">Hide Details</span>
                                      <ChevronDown className="w-4 h-4" />
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-xs font-bold uppercase tracking-wider">View Details</span>
                                      <ChevronRight className="w-4 h-4" />
                                    </>
                                  )}
                                </Button>
                              </div>
                              <select
                                value={shipmentStatus}
                                onChange={async (e) => {
                                  const newStatus = e.target.value as 'ready' | 'picked_up' | 'delivered'
                                  const result = await updateDispatchStatus(dispatch.id, newStatus)
                                  if (result.success) {
                                    await loadDispatches()
                                    setSuccess(`Status updated to ${statusSteps.find(s => s.value === newStatus)?.label}!`)
                                    setTimeout(() => setSuccess(null), 3000)
                                  } else {
                                    setError(result.error || "Failed to update status")
                                  }
                                }}
                                className={`w-full h-10 px-4 border-2 rounded-lg font-medium text-sm focus:outline-none focus:ring-2 focus:ring-sk-primary focus:border-sk-primary transition-all ${shipmentStatus === 'ready' ? 'border-yellow-300 bg-yellow-50 text-yellow-800' :
                                  shipmentStatus === 'picked_up' ? 'border-blue-300 bg-blue-50 text-blue-800' :
                                    'border-green-300 bg-green-50 text-green-800'
                                  }`}
                              >
                                {statusSteps.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Collapsible Details Section */}
                            {expandedShipments[dispatch.id] && (
                              <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                                {/* Information Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {dispatch.courier_companies && (
                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100/80 transition-colors">
                                      <div className="flex items-center gap-4">
                                        <div className="p-2.5 bg-white rounded-lg shadow-sm">
                                          <Truck className="w-5 h-5 text-indigo-600" />
                                        </div>
                                        <div className="space-y-1">
                                          <span className="text-sm font-semibold text-gray-900">
                                            {dispatch.courier_companies?.name || "Standard Delivery"}
                                          </span>
                                          <p className="text-xs text-gray-500 font-medium">
                                            Shipment on {new Date(dispatch.dispatch_date).toLocaleDateString('en-IN', {
                                              day: '2-digit',
                                              month: 'short',
                                              year: 'numeric'
                                            })}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                                        {dispatch.tracking_id && (
                                          <div className="flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-md text-xs font-bold border border-indigo-100">
                                            ID: {dispatch.tracking_id}
                                          </div>
                                        )}
                                        <div className="flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-xs font-bold border border-blue-100">
                                          {dispatch.dispatch_type === 'full' ? 'Full Dispatch' : 'Partial'}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  {dispatch.tracking_id && (
                                    <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                                      <div className="flex items-center gap-2 mb-2">
                                        <FileText className="w-4 h-4 text-gray-600" />
                                        <Label className="text-xs font-semibold text-gray-600">Tracking ID</Label>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <p className="text-base font-mono font-bold text-gray-900">{dispatch.tracking_id}</p>
                                        {dispatch.courier_companies?.tracking_url && (
                                          <a
                                            href={dispatch.courier_companies.tracking_url.replace('{tracking_number}', dispatch.tracking_id)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium flex items-center gap-1"
                                          >
                                            <Truck className="w-3 h-3" />
                                            Track
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Items Section */}
                                {dispatch.dispatch_items && dispatch.dispatch_items.length > 0 && (
                                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <Label className="text-sm font-semibold text-gray-700 mb-3 block">Items Dispatched</Label>
                                    <div className="space-y-2">
                                      {dispatch.dispatch_items.map((di: any, idx: number) => {
                                        const orderItem = di.order_items
                                        let itemName = `Item ${idx + 1}`

                                        if (orderItem) {
                                          let inventoryItem: InventoryItem | undefined
                                          let subItem: SubItem | undefined

                                          inventoryItem = inventoryItems.find(inv =>
                                            inv.id === orderItem.inventory_item_id || inv.id === orderItem.product_id
                                          )

                                          if (!inventoryItem) {
                                            for (const parentItem of inventoryItems) {
                                              subItem = parentItem.sub_items?.find(sub =>
                                                sub.id === orderItem.inventory_item_id || sub.id === orderItem.product_id
                                              )
                                              if (subItem) {
                                                inventoryItem = parentItem
                                                break
                                              }
                                            }
                                          }

                                          itemName = subItem
                                            ? `${inventoryItem?.item_name || ""} → ${subItem.item_name}`
                                            : inventoryItem?.item_name || `Item ${idx + 1}`
                                        }

                                        return (
                                          <div key={di.id} className="flex items-center justify-between py-2.5 px-3 bg-white rounded border border-gray-200 hover:border-blue-300 transition-colors">
                                            <span className="text-sm text-gray-700">{itemName}</span>
                                            <span className="text-sm font-bold text-gray-900">{di.quantity} units</span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Notes */}
                                {dispatch.notes && (
                                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                                    <Label className="text-xs font-semibold text-gray-700 mb-1 block">Notes</Label>
                                    <p className="text-sm text-gray-700">{dispatch.notes}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dispatch Creation Form Modal */}
          {showDispatchForm && selectedProductionRecord && (
            <Card className="shadow-lg border-2 border-blue-300">
              <CardHeader className="bg-blue-50 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    Create Dispatch for {selectedProductionRecord.production_number}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowDispatchForm(false)
                      setSelectedProductionRecord(null)
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <CardDescription className="mt-1">
                  {selectedProductionRecord.production_type === "full"
                    ? "Create a dispatch for the full order production"
                    : "Create a dispatch for the partial production quantities"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* Production Record Info */}
                  <div className="p-4 bg-gray-50 rounded-lg border">
                    <Label className="text-sm font-semibold text-gray-700 mb-2 block">Production Record Details</Label>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Production Number:</span>
                        <span className="font-medium text-gray-900">{selectedProductionRecord.production_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Type:</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${selectedProductionRecord.production_type === "full"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-orange-100 text-orange-700"
                          }`}>
                          {selectedProductionRecord.production_type === "full" ? "Full" : "Partial"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Items to Dispatch */}
                  {order && order.items && (
                    <div>
                      <Label className="text-sm font-semibold text-gray-700 mb-2 block">Items to Dispatch</Label>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Item</th>
                              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700">Quantity</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {order.items.map((item, index) => {
                              // Find inventory item for display name
                              let inventoryItem: InventoryItem | undefined
                              let subItem: SubItem | undefined

                              inventoryItem = inventoryItems.find(inv =>
                                inv.id === item.inventory_item_id || inv.id === item.product_id
                              )

                              if (!inventoryItem) {
                                for (const parentItem of inventoryItems) {
                                  subItem = parentItem.sub_items?.find(sub =>
                                    sub.id === item.inventory_item_id || sub.id === item.product_id
                                  )
                                  if (subItem) {
                                    inventoryItem = parentItem
                                    break
                                  }
                                }
                              }

                              const displayName = subItem
                                ? `${inventoryItem?.item_name || ""} → ${subItem.item_name}`
                                : inventoryItem?.item_name || `Item ${index + 1}`

                              // Get quantity from production record
                              let dispatchQty = 0
                              if (selectedProductionRecord.production_type === "full") {
                                dispatchQty = item.quantity
                              } else if (selectedProductionRecord.selected_quantities && selectedProductionRecord.selected_quantities[item.id]) {
                                dispatchQty = selectedProductionRecord.selected_quantities[item.id] as number
                              }

                              if (dispatchQty === 0) return null

                              return (
                                <tr key={item.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 text-sm text-gray-900">{displayName}</td>
                                  <td className="px-4 py-2 text-sm text-center text-gray-600 font-medium">{dispatchQty}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Courier Company */}
                  <div>
                    <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                      Courier Company <span className="text-red-500">*</span>
                    </Label>
                    <select
                      value={selectedCourierCompany}
                      onChange={(e) => setSelectedCourierCompany(e.target.value)}
                      disabled={creatingDispatch}
                      className="w-full h-10 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sk-primary"
                      required
                    >
                      <option value="">Select courier company...</option>
                      {courierCompanies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tracking ID */}
                  <div>
                    <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                      Tracking ID (Optional)
                    </Label>
                    <Input
                      type="text"
                      placeholder="Enter tracking ID..."
                      value={trackingId}
                      onChange={(e) => setTrackingId(e.target.value)}
                      disabled={creatingDispatch}
                      className="h-10"
                    />
                    {selectedCourierCompany && trackingId && (() => {
                      const company = courierCompanies.find(c => c.id === selectedCourierCompany)
                      if (company?.tracking_url) {
                        const trackingUrl = company.tracking_url.replace('{tracking_number}', trackingId)
                        return (
                          <p className="text-xs text-blue-600 mt-1">
                            <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              Track shipment →
                            </a>
                          </p>
                        )
                      }
                      return null
                    })()}
                  </div>

                  {/* Notes */}
                  <div>
                    <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                      Notes (Optional)
                    </Label>
                    <textarea
                      value={dispatchNotes}
                      onChange={(e) => setDispatchNotes(e.target.value)}
                      disabled={creatingDispatch}
                      placeholder="Add any notes about this dispatch..."
                      className="w-full min-h-[80px] rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sk-primary"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDispatchForm(false)
                        setSelectedProductionRecord(null)
                        setSelectedCourierCompany("")
                        setTrackingId("")
                        setDispatchNotes("")
                      }}
                      disabled={creatingDispatch}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={async () => {
                        if (!selectedCourierCompany) {
                          setError("Please select a courier company")
                          return
                        }

                        if (!order || !order.items) {
                          setError("Order items not available")
                          return
                        }

                        setCreatingDispatch(true)
                        setError(null)

                        try {
                          // Prepare dispatch items based on production record
                          const dispatchItems: Array<{ order_item_id: string; quantity: number }> = []

                          order.items.forEach((item) => {
                            let qty = 0
                            if (selectedProductionRecord.production_type === "full") {
                              qty = item.quantity
                            } else if (selectedProductionRecord.selected_quantities && selectedProductionRecord.selected_quantities[item.id]) {
                              qty = selectedProductionRecord.selected_quantities[item.id] as number
                            }

                            if (qty > 0) {
                              dispatchItems.push({
                                order_item_id: item.id,
                                quantity: qty
                              })
                            }
                          })

                          if (dispatchItems.length === 0) {
                            setError("No items to dispatch")
                            setCreatingDispatch(false)
                            return
                          }

                          const result = await createDispatch(
                            orderId,
                            selectedProductionRecord.production_type === "full" ? "full" : "partial",
                            dispatchItems,
                            dispatchNotes || undefined,
                            selectedCourierCompany,
                            trackingId || undefined,
                            selectedProductionRecord.id
                          )

                          if (result.success) {
                            setSuccess(`Dispatch created successfully for ${selectedProductionRecord.production_number}!`)
                            setShowDispatchForm(false)
                            setSelectedProductionRecord(null)
                            setSelectedCourierCompany("")
                            setTrackingId("")
                            setDispatchNotes("")
                            await loadDispatches()
                            setTimeout(() => setSuccess(null), 3000)
                          } else {
                            setError(result.error || "Failed to create dispatch")
                          }
                        } catch (err: any) {
                          setError(err.message || "Failed to create dispatch")
                        } finally {
                          setCreatingDispatch(false)
                        }
                      }}
                      disabled={creatingDispatch || !selectedCourierCompany}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Truck className="w-4 h-4 mr-2" />
                      {creatingDispatch ? "Creating..." : "Create Dispatch"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Payment Tab */}
        <TabsContent value="payment" className="mt-6">
          <div className="max-w-[1200px] mx-auto px-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">Invoiced Total</p>
                <p className="text-2xl font-semibold text-slate-900">
                  ₹{paymentSummary.requested.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">Total Paid</p>
                <p className="text-2xl font-semibold text-green-600">
                  ₹{paymentSummary.totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">Amount Due</p>
                <p className={`text-2xl font-semibold ${paymentSummary.amountDue > 0 ? "text-red-600" : "text-slate-900"}`}>
                  ₹{paymentSummary.amountDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">Payment Status</p>
                <div>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${derivedPaymentStatus === "complete"
                      ? "bg-green-100 text-green-800"
                      : derivedPaymentStatus === "partial"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-amber-100 text-amber-800"
                      }`}
                  >
                    {derivedPaymentStatus === "complete" ? "Paid" : derivedPaymentStatus === "partial" ? "Partial" : "Pending"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {paymentSummary.amountDue > 0 && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
                  aria-live="polite"
                >
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
                  <p className="text-sm text-amber-800">
                    <span className="font-semibold">Pending amount: ₹{paymentSummary.amountDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    {" "}— Record payments below or follow up if overdue.
                  </p>
                </div>
              )}

              {!canRecordPayment && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    <div>
                      <h3 className="mb-1 text-sm font-semibold text-red-900">Payment Recording Not Available</h3>
                      <p className="text-sm text-red-800">
                        Orders must be dispatched before adding payment records. Current order status: <strong>{order?.order_status || "New Order"}</strong>. Complete production and create a dispatch in the <strong>Shipment</strong> tab first.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {order.cash_discount && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div className="flex-1">
                      <h3 className="mb-1 text-sm font-semibold text-amber-900">Cash Discount Applied</h3>
                      <p className="text-sm text-amber-800">
                        If payment is not received within 14 days of dispatch, a single payment follow-up will appear in the <strong>Payment Followup</strong> tab.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.6fr_1fr]">
              <div className="flex flex-col gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-900">Requested Payment</h3>
                    <p className="mt-1 text-xs text-slate-400">Total amount for this order (used for payment tracking)</p>
                  </div>

                  <div className="space-y-3">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={requestedPaymentAmount}
                        onChange={(e) => setRequestedPaymentAmount(e.target.value)}
                        placeholder="Enter amount"
                        className="h-10 rounded-lg border-slate-200 pl-7 focus-visible:border-orange-500 focus-visible:ring-[3px] focus-visible:ring-orange-500/15"
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        onClick={async () => {
                          setError(null)
                          const num = requestedPaymentAmount.trim() === "" ? null : parseFloat(requestedPaymentAmount)
                          if (num !== null && (Number.isNaN(num) || num < 0)) {
                            setError("Enter a valid amount")
                            return
                          }
                          setSavingRequestedPayment(true)
                          try {
                            const result = await updateOrderPayment(orderId, undefined, undefined, undefined, undefined, undefined, undefined, num)
                            if (result.success) {
                              setSuccess("Requested payment saved!")
                              await loadOrderDetails()
                              setTimeout(() => setSuccess(null), 2500)
                            } else {
                              setError(result.error || "Failed to save")
                            }
                          } finally {
                            setSavingRequestedPayment(false)
                          }
                        }}
                        disabled={savingRequestedPayment}
                        className="h-9 w-20 rounded-lg bg-orange-500 text-white hover:bg-orange-600"
                      >
                        {savingRequestedPayment ? (
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-900">Invoice Number</h3>
                    <p className="mt-1 text-xs text-slate-400">Required before adding invoice attachments</p>
                  </div>

                  <div className="flex flex-col gap-2 md:flex-row md:items-start">
                    <Input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="Enter invoice number or generate from dispatch"
                      className="h-10 flex-1 rounded-lg border-slate-200 focus-visible:border-orange-500 focus-visible:ring-[3px] focus-visible:ring-orange-500/15"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const baseOrderNumber = order?.internal_order_number || "ORD"
                        const generatedInvoice = `INV-${baseOrderNumber}`
                        setInvoiceNumber(generatedInvoice)
                      }}
                      className="h-10 whitespace-nowrap rounded-lg border-slate-200 px-3.5 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      Regenerate
                    </Button>
                    <Button
                      type="button"
                      onClick={async () => {
                        const result = await updateOrderPayment(orderId, invoiceNumber || undefined)
                        if (result.success) {
                          setSuccess("Invoice number saved!")
                          await loadOrderDetails()
                          setTimeout(() => setSuccess(null), 2000)
                        } else {
                          setError(result.error || "Failed to save invoice number")
                        }
                      }}
                      disabled={!invoiceNumber}
                      className="h-10 w-16 rounded-lg bg-orange-500 text-white hover:bg-orange-600"
                    >
                      Save
                    </Button>
                  </div>

                  {!invoiceNumber && (
                    <p className="mt-2 text-xs text-slate-500">
                      Invoice number will be generated automatically once production is completed.
                    </p>
                  )}
                </div>

                {productionRecords && productionRecords.length > 0 && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setPaymentProductionRecordsOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-orange-50"
                    >
                      <div className="flex items-center gap-2 text-slate-900">
                        <Factory className="h-4 w-4 text-slate-500" />
                        <span className="text-[13px] font-medium">Production Records</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                          {productionRecords.length}
                        </span>
                        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${paymentProductionRecordsOpen ? "rotate-180" : ""}`} />
                      </div>
                    </button>

                    {paymentProductionRecordsOpen && (
                      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                        {productionRecords.map((record: any) => (
                          <div key={record.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900">{record.production_number}</span>
                                <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">
                                  {record.production_type === "full" ? "Full" : "Partial"}
                                </span>
                                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${record.status === "completed"
                                  ? "bg-green-100 text-green-700"
                                  : record.status === "in_production"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-slate-200 text-slate-700"
                                  }`}>
                                  {record.status === "completed" ? "Completed" : record.status === "in_production" ? "In Production" : "Pending"}
                                </span>
                              </div>
                              {record.pdf_file_url && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(record.pdf_file_url, "_blank")}
                                  className="h-8 rounded-lg border-slate-200 text-xs text-slate-700 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
                                >
                                  <File className="mr-1 h-3 w-3" />
                                  View PDF
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {dispatches && dispatches.length > 0 && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setPaymentDispatchRecordsOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-orange-50"
                    >
                      <div className="flex items-center gap-2 text-slate-900">
                        <Truck className="h-4 w-4 text-slate-500" />
                        <span className="text-[13px] font-medium">Dispatch Records</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                          {dispatches.length}
                        </span>
                        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${paymentDispatchRecordsOpen ? "rotate-180" : ""}`} />
                      </div>
                    </button>

                    {paymentDispatchRecordsOpen && (
                      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                        {dispatches.map((dispatch: any) => (
                          <div key={dispatch.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex flex-wrap items-center gap-2.5">
                                <span className="text-sm font-medium text-slate-900">
                                  {dispatch.dispatch_type === "full" ? "Full" : "Partial"} Dispatch
                                </span>
                                <span className="text-xs text-slate-500">
                                  {new Date(dispatch.dispatch_date).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </span>
                                {dispatch.production_records && (
                                  <span className="text-xs text-slate-600">
                                    Prod: {dispatch.production_records.production_number}
                                  </span>
                                )}
                              </div>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${dispatch.shipment_status === "delivered"
                                ? (dispatch.dispatch_type === "partial" ? "bg-teal-100 text-teal-700" : "bg-green-100 text-green-700")
                                : dispatch.shipment_status === "picked_up"
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-yellow-100 text-yellow-700"
                                }`}>
                                {dispatch.shipment_status === "delivered"
                                  ? (dispatch.dispatch_type === "partial" ? "Partial Delivered" : "Delivered")
                                  : dispatch.shipment_status === "picked_up"
                                    ? "Picked Up"
                                    : "Ready"}
                              </span>
                            </div>
                            {dispatch.courier_companies && (
                              <div className="text-xs text-slate-600">
                                Courier: {dispatch.courier_companies.name}
                                {dispatch.tracking_id && ` • Tracking: ${dispatch.tracking_id}`}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {(!productionRecords || productionRecords.length === 0) && (!dispatches || dispatches.length === 0) && (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                    No production or dispatch records found. Create production records and dispatches to generate invoice.
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">Invoice Attachments</h3>
                    <p className="text-xs text-slate-400">Upload invoice PDF (optional)</p>
                  </div>

                  <div className="space-y-3">
                    <input
                      id="invoice-attachment-input"
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) {
                          handleInvoiceAttachmentUpload(file)
                        }
                        event.target.value = ""
                      }}
                    />

                    <div className="rounded-[10px] border-2 border-dashed border-slate-200 px-5 py-7 text-center transition-colors hover:border-orange-500 hover:bg-orange-50">
                      <Upload className="mx-auto h-7 w-7 text-slate-300" />
                      <p className="mt-3 text-[13px] font-medium text-slate-600">Upload Attachment</p>
                      <p className="mt-1 text-[11px] text-slate-400">Accepts PDF, JPG, PNG</p>
                      <Button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById("invoice-attachment-input") as HTMLInputElement | null
                          input?.click()
                        }}
                        disabled={uploadingInvoiceAttachment}
                        className="mt-3 h-8 rounded-md bg-orange-500 px-4 text-white hover:bg-orange-600"
                      >
                        {uploadingInvoiceAttachment ? (
                          <>
                            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-b-2 border-white"></span>
                            Uploading...
                          </>
                        ) : (
                          "Browse"
                        )}
                      </Button>
                    </div>

                    {invoiceAttachments.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                        No attachments uploaded yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {invoiceAttachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="rounded-full bg-slate-100 p-2 text-slate-500">
                                <File className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-900">{attachment.file_name}</p>
                                <p className="text-xs text-slate-500">
                                  {(attachment.file_size ? (attachment.file_size / 1024).toFixed(1) : "-")}
                                  {attachment.file_size ? " KB" : ""}
                                  {attachment.created_at
                                    ? ` • ${new Date(attachment.created_at).toLocaleDateString()}`
                                    : ""}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(attachment.file_url, "_blank")}
                                className="h-8 rounded-lg border-slate-200 text-xs text-slate-700 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
                              >
                                <Download className="mr-1 h-3 w-3" />
                                Download
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  if (confirm("Delete this attachment?")) {
                                    const result = await deleteInvoiceAttachment(attachment.id)
                                    if (result.success) {
                                      await loadInvoiceAttachments()
                                      setSuccess("Attachment deleted!")
                                      setTimeout(() => setSuccess(null), 2000)
                                    } else {
                                      setError(result.error || "Failed to delete attachment")
                                    }
                                  }
                                }}
                                className="h-8 w-8 rounded-full p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-900">Add Payment to Record</h3>
                    <p className="mt-1 text-xs text-slate-400">Save as entry to payment history</p>
                  </div>

                  <div className="space-y-4">
                    {!invoiceNumber && (
                      <div className="rounded-lg border border-amber-200 bg-amber-100/70 px-3.5 py-2.5 text-xs text-amber-800">
                        Please add invoice number before adding payment records.
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div>
                        <Label className="mb-1.5 block text-xs font-semibold text-slate-600">Amount (₹)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={paymentSummary.hasRequestedPayment ? paymentSummary.amountDue : undefined}
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder="e.g. 25000"
                          className="h-10 rounded-lg border-slate-200 focus-visible:border-orange-500 focus-visible:ring-[3px] focus-visible:ring-orange-500/15"
                          disabled={!invoiceNumber || !canRecordPayment || !paymentSummary.hasRequestedPayment || addingPayment}
                          aria-describedby="payment-remaining-hint"
                        />
                        <p id="payment-remaining-hint" className="mt-1.5 text-xs text-slate-500">
                          {paymentSummary.hasRequestedPayment
                            ? `Remaining: ₹${paymentSummary.amountDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                            : "Set Requested Payment above to record payments."}
                        </p>
                      </div>

                      <div>
                        <Label className="mb-1.5 block text-xs font-semibold text-slate-600">Pay Record Date</Label>
                        <Input
                          type="date"
                          value={paymentDate || new Date().toISOString().split("T")[0]}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          className="h-10 rounded-lg border-slate-200 focus-visible:border-orange-500 focus-visible:ring-[3px] focus-visible:ring-orange-500/15"
                          disabled={!invoiceNumber || !canRecordPayment || !paymentSummary.hasRequestedPayment || addingPayment}
                        />
                      </div>

                      <div>
                        <Label className="mb-1.5 block text-xs font-semibold text-slate-600">Method</Label>
                        <Select
                          value={paymentMethod || "cash"}
                          onValueChange={setPaymentMethod}
                          disabled={!invoiceNumber || !canRecordPayment || !paymentSummary.hasRequestedPayment || addingPayment}
                        >
                          <SelectTrigger className="h-10 rounded-lg border-slate-200 focus:ring-[3px] focus:ring-orange-500/15 focus:ring-offset-0">
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="upi">UPI</SelectItem>
                            <SelectItem value="neft">NEFT</SelectItem>
                            <SelectItem value="cheque">Cheque</SelectItem>
                            <SelectItem value="rtgs">RTGS</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <Label className="mb-1.5 block text-xs font-semibold text-slate-600">Reference</Label>
                        <Input
                          type="text"
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          placeholder="Reference / UTR number"
                          className="h-10 rounded-lg border-slate-200 focus-visible:border-orange-500 focus-visible:ring-[3px] focus-visible:ring-orange-500/15"
                          disabled={!invoiceNumber || !canRecordPayment || !paymentSummary.hasRequestedPayment || addingPayment}
                        />
                      </div>

                      <div>
                        <Label className="mb-1.5 block text-xs font-semibold text-slate-600">Notes</Label>
                        <Input
                          type="text"
                          value={paymentNotes}
                          onChange={(e) => setPaymentNotes(e.target.value)}
                          placeholder="Notes (optional)"
                          className="h-10 rounded-lg border-slate-200 focus-visible:border-orange-500 focus-visible:ring-[3px] focus-visible:ring-orange-500/15"
                          disabled={!invoiceNumber || !canRecordPayment || !paymentSummary.hasRequestedPayment || addingPayment}
                        />
                      </div>
                    </div>

                    {invoiceNumber && !paymentSummary.hasRequestedPayment && (
                      <p className="text-xs text-amber-700">
                        Please set Requested Payment above before adding payment records.
                      </p>
                    )}

                    <Button
                      type="button"
                      onClick={handleAddPaymentRecord}
                      disabled={!invoiceNumber || !canRecordPayment || !paymentSummary.hasRequestedPayment || addingPayment}
                      className="h-10 w-full rounded-lg bg-orange-500 text-[13px] font-medium text-white hover:bg-orange-600"
                    >
                      {addingPayment ? (
                        <>
                          <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-b-2 border-white"></span>
                          Adding...
                        </>
                      ) : (
                        <>
                          <DollarSign className="mr-2 h-4 w-4" />
                          Add Payment
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:sticky lg:top-5">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">Payment History</h3>
                    {loadingPayments ? (
                      <span className="text-xs text-slate-500">Loading...</span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={loadOrderPayments}
                        disabled={loadingPayments}
                        className="h-7 w-7 rounded-full border border-transparent p-0 text-slate-500 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-500"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${loadingPayments ? "animate-spin" : ""}`} />
                      </Button>
                    )}
                  </div>

                  {orderPayments.length === 0 ? (
                    <div className="flex min-h-[140px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-center">
                      <Receipt className="h-8 w-8 text-slate-200" />
                      <p className="mt-3 text-[13px] text-slate-400">No payments recorded yet</p>
                      <p className="mt-1 text-[11px] text-slate-300">Add a payment using the form on the left</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {orderPayments.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-3 transition-colors hover:bg-slate-50"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              <span>{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : "-"}</span>
                              {p.payment_method && (
                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                                  {p.payment_method}
                                </span>
                              )}
                            </div>
                            {(p.reference || p.notes) && (
                              <div className="mt-1 truncate text-xs text-slate-600">
                                {p.reference ? `Ref: ${p.reference}` : ""}
                                {p.reference && p.notes ? " • " : ""}
                                {p.notes || ""}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-green-600">
                              ₹{Number(p.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                if (confirm("Delete this payment record?")) {
                                  const result = await deleteOrderPayment(p.id)
                                  if (result.success) {
                                    await loadOrderPayments()
                                    setSuccess("Payment record deleted!")
                                    setTimeout(() => setSuccess(null), 2000)
                                  } else {
                                    setError(result.error || "Failed to delete payment")
                                  }
                                }
                              }}
                              className="h-8 w-8 rounded-full p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                              title="Delete payment"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900">Payment Summary</h3>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-600">Invoice Number</span>
                        <span className="rounded bg-slate-50 px-2 py-1 font-mono text-xs text-slate-800">
                          {invoiceNumber || "—"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-600">Payment Status</span>
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${derivedPaymentStatus === "complete"
                            ? "bg-green-100 text-green-800"
                            : derivedPaymentStatus === "partial"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-amber-100 text-amber-800"
                            }`}
                        >
                          {derivedPaymentStatus === "complete" ? "Paid" : derivedPaymentStatus === "partial" ? "Partial" : "Pending"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-600">Total Paid</span>
                        <span className="text-sm font-semibold text-green-600">
                          ₹{paymentSummary.totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-600">Amount Due</span>
                        <span className={`text-sm font-semibold ${paymentSummary.amountDue > 0 ? "text-red-600" : "text-slate-900"}`}>
                          ₹{paymentSummary.amountDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="h-px bg-slate-100"></div>

                    {derivedPaymentStatus === "partial" && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Partial Payment Details
                        </Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-slate-600">Amount Paid</p>
                            <p className="text-base font-semibold text-slate-900">
                              ₹{paymentSummary.totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-600">Remaining</p>
                            <p className="text-base font-semibold text-red-600">
                              ₹{paymentSummary.amountDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {(derivedPaymentStatus === "complete" || derivedPaymentStatus === "partial") && paymentDate && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <Label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Payment Date
                        </Label>
                        <p className="text-base font-semibold text-slate-900">
                          {new Date(paymentDate).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    )}

                    {zohoBillingDetails && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          ZOHO Billing Details
                        </Label>
                        <pre className="whitespace-pre-wrap break-words text-xs font-mono text-slate-700">
                          {typeof zohoBillingDetails === "string" ? zohoBillingDetails : JSON.stringify(zohoBillingDetails, null, 2)}
                        </pre>
                      </div>
                    )}

                    {invoiceNumber && paymentSummary.amountDue === 0 && (
                      <div className="space-y-2 pt-1">
                        <Button
                          onClick={handleUpdatePayment}
                          className="h-10 w-full rounded-lg bg-orange-500 text-[13px] font-medium text-white hover:bg-orange-600"
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Update Order Payment Status
                        </Button>
                        <p className="text-center text-[11px] text-slate-400">Updates status in Zoho Billing</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Payment Followup Tab */}
        {(order.cash_discount || paymentFollowups.length > 0 || paymentSummary.amountDue > 0) && (
          <TabsContent value="followup" className="space-y-6 mt-6">
            <Card className="shadow-sm">
              <CardHeader className="bg-gray-50 border-b">
                <CardTitle className="flex items-center gap-2.5 text-lg font-semibold text-gray-900">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Payment Followup (14-day / overdue)
                </CardTitle>
                <CardDescription className="mt-1">
                  One follow-up per order when payment is not received within 14 days of dispatch.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {paymentFollowupDisplay.displayFollowups.length === 0 ? (
                  <div className="text-center py-8">
                    {paymentFollowupDisplay.isBefore14Days ? (
                      <p className="text-gray-600">
                        Follow-up will appear on{" "}
                        <span className="font-medium">
                          {new Date(paymentFollowupDisplay.overdueDateStr + "T12:00:00").toLocaleDateString()}
                        </span>{" "}
                        (14 days after dispatch) if payment is not received.
                        {paymentFollowupDisplay.daysUntil > 0 && (
                          <span className="block mt-2 text-slate-500">
                            Countdown: {paymentFollowupDisplay.daysUntil} day{paymentFollowupDisplay.daysUntil !== 1 ? "s" : ""} until you can record the follow-up.
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="text-gray-500">No followup records found</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {paymentFollowupDisplay.displayFollowups.map((followup: any) => {
                      const paymentDateStr = followup.payment_date ? String(followup.payment_date).split("T")[0] : ""
                      const form = followupFormById[followup.id] ?? {
                        payment_received: !!followup.payment_received,
                        payment_date: paymentDateStr,
                        notes: followup.notes || "",
                      }
                      return (
                        <div
                          key={followup.id}
                          className={`p-4 border rounded-lg ${form.payment_received
                            ? "bg-green-50 border-green-200"
                            : new Date(followup.followup_date) < new Date()
                              ? "bg-red-50 border-red-200"
                              : "bg-gray-50 border-gray-200"
                            }`}
                        >
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                            Follow-up date: {new Date(followup.followup_date).toLocaleDateString()}
                          </p>
                          <div className="space-y-4">
                            <div>
                              <Label className="text-sm font-medium text-gray-700">Payment received?</Label>
                              <div className="flex gap-4 mt-1.5">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`followup-${followup.id}-paid`}
                                    checked={form.payment_received === true}
                                    onChange={() => setFollowupFormById((prev) => ({
                                      ...prev,
                                      [followup.id]: { ...(prev[followup.id] ?? form), payment_received: true },
                                    }))}
                                    className="h-4 w-4"
                                  />
                                  <span className="text-sm">Yes</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`followup-${followup.id}-paid`}
                                    checked={form.payment_received === false}
                                    onChange={() => setFollowupFormById((prev) => ({
                                      ...prev,
                                      [followup.id]: { ...(prev[followup.id] ?? form), payment_received: false },
                                    }))}
                                    className="h-4 w-4"
                                  />
                                  <span className="text-sm">No</span>
                                </label>
                              </div>
                            </div>
                            {form.payment_received && (
                              <div>
                                <Label className="text-sm font-medium text-gray-700">Payment date</Label>
                                <Input
                                  type="date"
                                  value={form.payment_date}
                                  onChange={(e) => setFollowupFormById((prev) => ({
                                    ...prev,
                                    [followup.id]: { ...(prev[followup.id] ?? form), payment_date: e.target.value },
                                  }))}
                                  className="mt-1.5 h-9 max-w-[200px]"
                                />
                              </div>
                            )}
                            <div>
                              <Label className="text-sm font-medium text-gray-700">Answer of follow-up</Label>
                              <textarea
                                value={form.notes}
                                onChange={(e) => setFollowupFormById((prev) => ({
                                  ...prev,
                                  [followup.id]: { ...(prev[followup.id] ?? form), notes: e.target.value },
                                }))}
                                placeholder="Outcome / notes from the follow-up call or action"
                                rows={3}
                                className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sk-primary"
                              />
                            </div>
                            <Button
                              onClick={async () => {
                                setSavingFollowupId(followup.id)
                                await handleUpdateFollowup(
                                  followup.id,
                                  form.payment_received,
                                  form.payment_date || undefined,
                                  form.notes || undefined
                                )
                                setSavingFollowupId(null)
                                setFollowupFormById((prev) => {
                                  const next = { ...prev }
                                  delete next[followup.id]
                                  return next
                                })
                              }}
                              disabled={savingFollowupId === followup.id}
                            >
                              {savingFollowupId === followup.id ? (
                                <>
                                  <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent mr-1.5" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Check className="w-4 h-4 mr-1.5" />
                                  Save follow-up
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Dispatch Modal */}
      {showDispatchModal && dispatchType && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => {
              if (!dispatching) {
                setShowDispatchModal(false)
                setDispatchType(null)
              }
            }}
          >
            <Card
              className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                      <Truck className="w-5 h-5 text-blue-600" />
                      {dispatchType === "full" ? "Full Dispatch" : "Partial Dispatch"}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {dispatchType === "full"
                        ? "Dispatch all items in this order"
                        : "Select quantities to dispatch for each item"}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (!dispatching) {
                        setShowDispatchModal(false)
                        setDispatchType(null)
                      }
                    }}
                    disabled={dispatching}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6 overflow-y-auto flex-1">
                {order && order.items && order.items.length > 0 ? (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      {order.items.map((item) => {
                        const inventoryItem = inventoryItems.find(inv =>
                          inv.id === item.inventory_item_id || inv.id === item.product_id
                        ) || inventoryItems.find(inv =>
                          inv.sub_items?.some(sub => sub.id === item.inventory_item_id || sub.id === item.product_id)
                        )

                        let subItem: SubItem | undefined
                        if (inventoryItem) {
                          subItem = inventoryItem.sub_items?.find(sub =>
                            sub.id === item.inventory_item_id || sub.id === item.product_id
                          )
                        }

                        const itemName = subItem
                          ? `${inventoryItem?.item_name || ""} → ${subItem.item_name}`
                          : inventoryItem?.item_name || `Item`

                        // Get already dispatched quantity from dispatches - FIX: Show context
                        const alreadyDispatched = getNetDispatchedForItem(item.id)

                        const dispatchQty = dispatchQuantities[item.id] || 0
                        const remainingQty = item.quantity - alreadyDispatched - dispatchQty
                        const maxAvailableToDispatch = item.quantity - alreadyDispatched

                        return (
                          <div key={item.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{itemName}</div>
                                {subItem && (
                                  <span className="text-xs text-gray-500 mt-0.5 block">Sub Item</span>
                                )}
                                <div className="text-sm text-gray-600 mt-1">
                                  Order Quantity: <span className="font-semibold">{item.quantity}</span>
                                  {alreadyDispatched > 0 && (
                                    <>
                                      <span className="mx-1">|</span>
                                      Already Dispatched: <span className="font-semibold text-green-600">{alreadyDispatched}</span>
                                    </>
                                  )}
                                  {maxAvailableToDispatch > 0 && (
                                    <>
                                      <span className="mx-1">|</span>
                                      Remaining: <span className="font-semibold text-blue-600">{maxAvailableToDispatch}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 items-end">
                              <div>
                                <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                                  Dispatch Quantity
                                </Label>
                                <Input
                                  type="number"
                                  min="0"
                                  max={maxAvailableToDispatch}
                                  value={dispatchQty}
                                  onChange={(e) => handleDispatchQuantityChange(item.id, parseInt(e.target.value) || 0)}
                                  disabled={dispatchType === "full" || dispatching}
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                                  Remaining
                                </Label>
                                <div className={`h-9 px-3 py-2 text-sm rounded-md border border-gray-300 bg-white flex items-center ${remainingQty < 0 ? "text-red-600" : remainingQty === 0 ? "text-green-600 font-semibold" : "text-gray-700"
                                  }`}>
                                  {remainingQty}
                                </div>
                              </div>
                              <div className="text-right">
                                {dispatchType === "partial" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDispatchQuantityChange(item.id, maxAvailableToDispatch)}
                                    disabled={dispatching}
                                    className="h-9 text-xs"
                                  >
                                    Max
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="pt-4 border-t space-y-4">
                      <div>
                        <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                          Courier Company (Optional)
                        </Label>
                        <select
                          value={selectedCourierCompany}
                          onChange={(e) => setSelectedCourierCompany(e.target.value)}
                          disabled={dispatching}
                          className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sk-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">Select a courier company...</option>
                          {courierCompanies.map((company) => (
                            <option key={company.id} value={company.id}>
                              {company.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                          Tracking ID (Optional)
                        </Label>
                        <Input
                          type="text"
                          placeholder="Enter tracking ID..."
                          value={trackingId}
                          onChange={(e) => setTrackingId(e.target.value)}
                          disabled={dispatching}
                          className="h-10"
                        />
                        {selectedCourierCompany && trackingId && (() => {
                          const company = courierCompanies.find(c => c.id === selectedCourierCompany)
                          if (company?.tracking_url) {
                            const trackingUrl = company.tracking_url.replace('{tracking_number}', trackingId)
                            return (
                              <p className="text-xs text-blue-600 mt-1">
                                <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                  Track shipment →
                                </a>
                              </p>
                            )
                          }
                          return null
                        })()}
                      </div>

                      <div>
                        <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                          Notes (Optional)
                        </Label>
                        <Input
                          type="text"
                          placeholder="Add any notes about this dispatch..."
                          value={dispatchNotes}
                          onChange={(e) => setDispatchNotes(e.target.value)}
                          disabled={dispatching}
                          className="h-10"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No items in this order</p>
                  </div>
                )}
              </CardContent>
              <div className="p-6 border-t bg-gray-50 flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!dispatching) {
                      setShowDispatchModal(false)
                      setDispatchType(null)
                    }
                  }}
                  disabled={dispatching}
                  className="border-gray-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateDispatch}
                  disabled={dispatching || Object.values(dispatchQuantities).every(qty => qty === 0)}
                >
                  {dispatching ? (
                    <>
                      <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                      Dispatching...
                    </>
                  ) : (
                    <>
                      <Truck className="w-4 h-4 mr-2" />
                      {dispatchType === "full" ? "Dispatch All" : "Dispatch Selected"}
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Edit Order Modal */}
      {showEditModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowEditModal(false)}
          >
            <Card
              className="w-full max-w-md shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <CardHeader className="bg-gray-50 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">Edit Order</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-500"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Internal Order Number</Label>
                    <Input
                      type="text"
                      value={order.internal_order_number || ""}
                      disabled
                      className="bg-gray-100 cursor-not-allowed"
                      placeholder="Auto-generated"
                    />
                    <p className="text-xs text-gray-500 mt-1">This is automatically generated and cannot be changed</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Sales Order Number</Label>
                    <Input
                      type="text"
                      value={order.sales_order_number || ""}
                      onChange={(e) => {
                        setOrder({ ...order, sales_order_number: e.target.value })
                      }}
                      placeholder="Enter sales order number from other platform"
                    />
                    <p className="text-xs text-gray-500 mt-1">Optional: Sales order number from other platforms</p>
                  </div>
                  <div className="pt-4 border-t flex items-center justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowEditModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={async () => {
                        const result = await updateOrder(orderId, {
                          sales_order_number: order.sales_order_number || undefined,
                        })
                        if (result.success) {
                          setSuccess("Order updated successfully!")
                          setShowEditModal(false)
                          await loadOrderDetails()
                          setTimeout(() => setSuccess(null), 2000)
                        } else {
                          setError(result.error || "Failed to update order")
                        }
                      }}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <Card
              className="w-full max-w-md shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <CardHeader className="bg-red-50 border-b border-red-200">
                <CardTitle className="text-lg font-semibold text-red-900">Delete Order</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-700 mb-4">
                  Are you sure you want to delete this order? This action cannot be undone and will delete all associated data including items, dispatches, and followups.
                </p>
                <div className="flex items-center justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDeleteOrder}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Trash className="w-4 h-4 mr-2" />
                    Delete Order
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
