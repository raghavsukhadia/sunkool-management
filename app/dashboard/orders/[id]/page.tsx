"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
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
  updateDispatchDetails,
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
  getOrderInvoices,
  createOrUpdateOrderInvoice,
  getOrderPayments,
  addOrderPayment,
  deleteOrderPayment,
} from "@/app/actions/orders"
import { TimelineDrawer } from "@/components/orders/TimelineDrawer"
import { OrderCommentSection } from "@/components/orders/OrderCommentSection"
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
  MessageSquare,
} from "lucide-react"
import { producedQtyForLineItem } from "@/lib/production-quantity"

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
  const [estimatedDelivery, setEstimatedDelivery] = useState<string>("")
  const [dispatchDate, setDispatchDate] = useState<string>(new Date().toISOString().split("T")[0])
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
  const [paymentDate, setPaymentDate] = useState<string>("")
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
  const [editingDispatchId, setEditingDispatchId] = useState<string | null>(null)
  const [editCourierId, setEditCourierId] = useState<string>("")
  const [editTrackingId, setEditTrackingId] = useState<string>("")
  const [editEstimatedDelivery, setEditEstimatedDelivery] = useState<string>("")
  const [savingDispatchEdit, setSavingDispatchEdit] = useState(false)
  const [invoiceAttachments, setInvoiceAttachments] = useState<any[]>([])
  const [uploadingInvoiceAttachment, setUploadingInvoiceAttachment] = useState(false)
  const [orderInvoices, setOrderInvoices] = useState<any[]>([])
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [invoiceDraftId, setInvoiceDraftId] = useState<string | null>(null)
  const [invoiceDraftNumber, setInvoiceDraftNumber] = useState<string>("")
  const [invoiceDraftDate, setInvoiceDraftDate] = useState<string>("")
  const [invoiceDraftAmount, setInvoiceDraftAmount] = useState<string>("")
  const [invoiceDraftDispatchId, setInvoiceDraftDispatchId] = useState<string>("")
  const [invoiceDraftLinkMode, setInvoiceDraftLinkMode] = useState<"manual" | "full" | "batch">("manual")
  const [invoiceDraftNotes, setInvoiceDraftNotes] = useState<string>("")
  const [invoiceDraftAttachment, setInvoiceDraftAttachment] = useState<File | null>(null)
  const [savingInvoice, setSavingInvoice] = useState(false)
  const [showCreateInvoiceForm, setShowCreateInvoiceForm] = useState(false)
  const [paymentTimelineOpen, setPaymentTimelineOpen] = useState(true)
  const [commentCount, setCommentCount] = useState(0)
  const [orderPayments, setOrderPayments] = useState<any[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [addingPayment, setAddingPayment] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const [paymentReference, setPaymentReference] = useState<string>("")
  const [paymentNotes, setPaymentNotes] = useState<string>("")
  const [followupFormById, setFollowupFormById] = useState<Record<string, { payment_received: boolean; payment_date: string; notes: string }>>({})
  const [savingFollowupId, setSavingFollowupId] = useState<string | null>(null)
  const loadedTabsRef = useRef<Record<string, boolean>>({
    production: false,
    shipment: false,
    payment: false,
    followup: false,
  })
  const followupEnsureKeyRef = useRef<string | null>(null)

  // Single source of truth for payment summary (invoiced, total paid, remaining)
  const paymentSummary = useMemo(() => {
    const totalPaid = orderPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const totalInvoiced = orderInvoices.reduce((sum, inv) => sum + Number(inv.invoice_amount || 0), 0)
    const amountDue = Math.max(0, totalInvoiced - totalPaid)
    return { totalPaid, totalInvoiced, amountDue, hasInvoices: totalInvoiced > 0 }
  }, [orderInvoices, orderPayments])

  const invoiceDispatchIds = useMemo(
    () => new Set((orderInvoices || []).map((inv: any) => inv.dispatch_id).filter(Boolean)),
    [orderInvoices]
  )

  const invoiceEligibleDispatches = useMemo(() => {
    return (dispatches || []).filter((dispatch: any) => dispatch.dispatch_type !== "return")
  }, [dispatches])

  const fullDispatchOptions = useMemo(
    () => invoiceEligibleDispatches.filter((dispatch: any) => dispatch.dispatch_type === "full" && !invoiceDispatchIds.has(dispatch.id)),
    [invoiceEligibleDispatches, invoiceDispatchIds]
  )

  const batchDispatchOptions = useMemo(
    () => invoiceEligibleDispatches.filter((dispatch: any) => dispatch.dispatch_type !== "full" && !invoiceDispatchIds.has(dispatch.id)),
    [invoiceEligibleDispatches, invoiceDispatchIds]
  )

  const hasExistingFullDispatchInvoice = useMemo(() => {
    return (orderInvoices || []).some((invoice: any) => {
      const dispatch = (invoice as any).dispatches
      return dispatch?.dispatch_type === "full"
    })
  }, [orderInvoices])

  const resolveProductionNumber = useCallback((dispatch: any) => {
    const production = Array.isArray(dispatch?.production_records)
      ? dispatch.production_records[0]
      : dispatch?.production_records
    return production?.production_number || null
  }, [])

  const formatDispatchOptionLabel = useCallback((dispatch: any) => {
    const dateText = dispatch?.dispatch_date
      ? new Date(dispatch.dispatch_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      : "—"
    const productionNumber = resolveProductionNumber(dispatch)
    if (dispatch?.dispatch_type === "full") {
      return `Full Dispatch • ${dateText}`
    }
    if (productionNumber) {
      return `${productionNumber} • ${dateText}`
    }
    return `Partial Dispatch • ${dateText}`
  }, [resolveProductionNumber])

  const getInvoiceDispatchContextLabel = useCallback((invoice: any) => {
    const dispatch = invoice?.dispatches
    if (!dispatch) return "Manual / Not linked"
    const productionNumber = resolveProductionNumber(dispatch)
    if (dispatch.dispatch_type === "full") return "Full Dispatch"
    if (productionNumber) return `Batch ${productionNumber}`
    return "Batch Dispatch"
  }, [resolveProductionNumber])

  // Derived payment status from actual amounts. Only show Paid when there was an amount to pay and it's fully covered.
  const derivedPaymentStatus = useMemo((): "complete" | "partial" | "pending" => {
    const { amountDue, totalInvoiced, totalPaid } = paymentSummary
    if (amountDue === 0 && (totalInvoiced > 0 || totalPaid > 0)) return "complete"
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
      const producedQty = producedQtyForLineItem(productionRecords || [], item.id, item.quantity)
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
      const result = await getOrderDetailPageData(orderId, {
        includeProductionLists: false,
        includeInvoiceAttachments: true,
        includePaymentFollowups: false,
      })
      if (result.success && result.data) {
        const d = result.data
        setOrder(d.order as any)
        setInventoryItems(d.inventoryItems as any)
        setDispatches(d.dispatches)
        setCourierCompanies(d.courierCompanies)
        setProductionLists(d.productionLists)
        setProductionRecords(d.productionRecords)
        setInvoiceAttachments(d.invoiceAttachments)
        setOrderInvoices((d as any).orderInvoices ?? [])
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

  const loadOrderPayments = useCallback(async () => {
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
  }, [orderId])

  const loadProductionLists = useCallback(async () => {
    try {
      const result = await getOrderProductionLists(orderId)
      if (result.success && result.data) {
        setProductionLists(result.data)
      }
    } catch (err: any) {
      console.error("Failed to load production lists:", err)
    }
  }, [orderId])

  const loadProductionRecords = useCallback(async () => {
    try {
      const result = await getOrderProductionRecords(orderId)
      if (result.success && result.data) {
        setProductionRecords(result.data)
      }
    } catch (err: any) {
      console.error("Failed to load production records:", err)
    }
  }, [orderId])

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
    if (!order) return

    if (order.cash_discount) {
      loadPaymentFollowups()
    }
  }, [order, loadPaymentFollowups])

  // Default invoice selection + draft hydration
  useEffect(() => {
    if (!orderInvoices || orderInvoices.length === 0) {
      setSelectedInvoiceId(null)
      setInvoiceDraftId(null)
      setInvoiceDraftNumber("")
      setInvoiceDraftDate(new Date().toISOString().split("T")[0])
      setInvoiceDraftAmount("")
      setInvoiceDraftDispatchId("")
      setInvoiceDraftLinkMode("manual")
      setInvoiceDraftNotes("")
      setShowCreateInvoiceForm(true)
      return
    }
    const current = selectedInvoiceId
      ? orderInvoices.find((i: any) => i.id === selectedInvoiceId)
      : orderInvoices[0]
    if (!current) return
    setSelectedInvoiceId(current.id)
    setInvoiceDraftId(current.id)
    setInvoiceDraftNumber(current.invoice_number ?? "")
    setInvoiceDraftDate((current.invoice_date ?? "").split("T")[0] || new Date().toISOString().split("T")[0])
    setInvoiceDraftAmount(String(current.invoice_amount ?? ""))
    setInvoiceDraftDispatchId(current.dispatch_id ?? "")
    const dispatchType = (current as any)?.dispatches?.dispatch_type
    if (!current.dispatch_id) setInvoiceDraftLinkMode("manual")
    else if (dispatchType === "full") setInvoiceDraftLinkMode("full")
    else setInvoiceDraftLinkMode("batch")
    setInvoiceDraftNotes(current.notes ?? "")
    if (!showCreateInvoiceForm) setShowCreateInvoiceForm(false)
  }, [orderInvoices, selectedInvoiceId, showCreateInvoiceForm])

  useEffect(() => {
    if (!showCreateInvoiceForm) return
    const linkable = invoiceEligibleDispatches.filter((d: any) => !invoiceDispatchIds.has(d.id))
    const stillValid = linkable.some((d: any) => d.id === invoiceDraftDispatchId)
    if (invoiceDraftDispatchId && !stillValid) setInvoiceDraftDispatchId("")
  }, [showCreateInvoiceForm, invoiceEligibleDispatches, invoiceDispatchIds, invoiceDraftDispatchId])

  // When Payment or Followup tab is active and order has amount due, ensure single 14-day followup exists and reload followups
  useEffect(() => {
    if ((activeTab === "payment" || activeTab === "followup") && order?.id && paymentSummary.amountDue > 0) {
      const key = `${orderId}:${Math.round(paymentSummary.amountDue * 100)}:${activeTab}`
      if (followupEnsureKeyRef.current === key) return
      followupEnsureKeyRef.current = key
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

  const loadDispatches = useCallback(async () => {
    try {
      const result = await getOrderDispatches(orderId)
      if (result.success && result.data) {
        setDispatches(result.data)
      }
    } catch (err: any) {
      console.error("Failed to load dispatches:", err)
    }
  }, [orderId])

  const loadCourierCompanies = useCallback(async () => {
    try {
      const result = await getCourierCompanies()
      if (result.success && result.data) {
        setCourierCompanies(result.data)
      }
    } catch (err: any) {
      console.error("Failed to load courier companies:", err)
    }
  }, [])

  const loadInvoiceAttachments = useCallback(async () => {
    try {
      const result = await getInvoiceAttachments(orderId)
      if (result.success && result.data) {
        setInvoiceAttachments(result.data)
      }
    } catch (err: any) {
      console.error("Failed to load invoice attachments:", err)
    }
  }, [orderId])

  useEffect(() => {
    if (!orderId) return
    if (activeTab === "production" && !loadedTabsRef.current.production) {
      loadedTabsRef.current.production = true
      void Promise.all([loadProductionLists(), loadProductionRecords()])
      return
    }
    if (activeTab === "shipment" && !loadedTabsRef.current.shipment) {
      loadedTabsRef.current.shipment = true
      void Promise.all([loadDispatches(), loadCourierCompanies(), loadInvoiceAttachments()])
      return
    }
    if (activeTab === "payment" && !loadedTabsRef.current.payment) {
      loadedTabsRef.current.payment = true
      void Promise.all([loadOrderPayments(), loadInvoiceAttachments()])
      return
    }
    if (activeTab === "followup" && !loadedTabsRef.current.followup) {
      loadedTabsRef.current.followup = true
      void loadPaymentFollowups()
    }
  }, [
    activeTab,
    orderId,
    loadDispatches,
    loadInvoiceAttachments,
    loadOrderPayments,
    loadPaymentFollowups,
    loadProductionLists,
    loadProductionRecords,
    loadCourierCompanies,
  ])

  useEffect(() => {
    if (activeTab !== "payment") return
    if (!selectedInvoiceId) return
    void loadInvoiceAttachments()
  }, [activeTab, selectedInvoiceId, loadInvoiceAttachments])

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
      const { generateProductionPDF } = await import("@/lib/pdf-generator")

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
      const { generateProductionPDF } = await import("@/lib/pdf-generator")

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
          // Calculate produced quantity up to now for this item.
          // Pending records should not reduce remaining until work is started.
          const producedQty = producedQtyForLineItem(productionRecords, item.id, item.quantity)

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
    const { generateTrackingSlipPDF } = await import("@/lib/pdf-generator")
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
    setEstimatedDelivery("")
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

    if (!estimatedDelivery) {
      setError("Expected Delivery date is required")
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
        trackingId || undefined,
        undefined,
        estimatedDelivery,
        dispatchDate || new Date().toISOString().split("T")[0]
      )

      if (result.success) {
        setSuccess(`Order ${dispatchType === "full" ? "fully" : "partially"} dispatched successfully!`)
        setShowDispatchModal(false)
        setDispatchType(null)
        setDispatchQuantities({})
        setDispatchNotes("")
        setEstimatedDelivery("")
        setSelectedCourierCompany("")
        setTrackingId("")
        setDispatchDate(new Date().toISOString().split("T")[0])
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


  const handleAddPaymentRecord = async () => {
    setError(null)

    if (!selectedInvoiceId) {
      setError("Select an invoice (or create one) before recording a payment.")
      return
    }

    const amount = parseFloat(paymentAmount)
    if (!amount || isNaN(amount) || amount <= 0) {
      setError("Please enter a valid payment amount")
      return
    }

    const inv = orderInvoices.find((i: any) => i.id === selectedInvoiceId)
    // amount_due from server already equals invoice_amount − total_paid; do not subtract again
    const invoiceDue = Number(inv?.amount_due ?? Math.max(0, Number(inv?.invoice_amount ?? 0) - Number(inv?.total_paid ?? 0)))
    if (amount > invoiceDue) {
      setError(`Amount cannot exceed invoice balance due (₹${invoiceDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}).`)
      return
    }

    const payDate = paymentDate || undefined

    setAddingPayment(true)
    try {
      const result = await addOrderPayment(
        orderId,
        selectedInvoiceId,
        amount,
        payDate,
        paymentMethod || undefined,
        paymentReference || undefined,
        paymentNotes || undefined
      )

      if (result.success) {
        setSuccess("Payment saved!")
        setPaymentAmount("")
        setPaymentMethod("")
        setPaymentReference("")
        setPaymentNotes("")
        await loadOrderPayments()
        const invRes = await getOrderInvoices(orderId)
        if (invRes.success) setOrderInvoices(invRes.data)
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

  const handleInvoiceAttachmentUpload = async (
    file: File,
    invoiceIdOverride?: string | null,
    silent = false
  ): Promise<{ success: boolean; error?: string }> => {
    setUploadingInvoiceAttachment(true)
    setError(null)

    try {
      const targetInvoiceId = invoiceIdOverride ?? selectedInvoiceId
      if (!targetInvoiceId) {
        const message = "Please save/select an invoice before uploading attachments."
        if (!silent) setError(message)
        return { success: false, error: message }
      }

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
        targetInvoiceId,
        base64,
        file.name,
        file.type,
        file.size
      )

      if (result.success) {
        if ((result as any).data?.id) {
          const created = (result as any).data
          setInvoiceAttachments((prev) => {
            const next = Array.isArray(prev) ? prev.filter((row: any) => row.id !== created.id) : []
            return [created, ...next]
          })
        }
        if (!silent) setSuccess("Invoice attachment uploaded successfully!")
        await Promise.all([
          loadInvoiceAttachments(),
          (async () => {
            const invRes = await getOrderInvoices(orderId)
            if (invRes.success) setOrderInvoices(invRes.data)
          })(),
        ])
        if (!silent) setTimeout(() => setSuccess(null), 3000)
        return { success: true }
      } else {
        const message = result.error || "Failed to upload invoice attachment"
        if (!silent) setError(message)
        return { success: false, error: message }
      }
    } catch (err: any) {
      const message = err.message || "Failed to upload invoice attachment"
      if (!silent) setError(message)
      return { success: false, error: message }
    } finally {
      setUploadingInvoiceAttachment(false)
    }
  }

  const startCreateInvoiceDraft = useCallback(() => {
    setSelectedInvoiceId(null)
    setInvoiceDraftId(null)
    setInvoiceDraftDispatchId("")
    setInvoiceDraftNumber(`INV-${order?.internal_order_number || orderId.slice(0, 8)}-${(orderInvoices.length || 0) + 1}`)
    setInvoiceDraftDate(new Date().toISOString().split("T")[0])
    setInvoiceDraftAmount("")
    setInvoiceDraftNotes("")
    setInvoiceDraftAttachment(null)
    const firstDispatch = invoiceEligibleDispatches.find((d: any) => !invoiceDispatchIds.has(d.id))
    setInvoiceDraftDispatchId(firstDispatch?.id ?? "")
    setShowCreateInvoiceForm(true)
  }, [
    order?.internal_order_number,
    orderId,
    orderInvoices.length,
    invoiceEligibleDispatches,
    invoiceDispatchIds,
  ])

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
      {/* Header Section — single compact bar */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Back */}
        <button
          onClick={() => router.back()}
          title="Back to Orders"
          className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white text-slate-500 hover:text-orange-600 hover:border-orange-300 hover:bg-orange-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="h-5 w-px bg-slate-200 flex-shrink-0" />

        {/* Order identity */}
        <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
          <h1 className="text-base font-bold text-slate-900 whitespace-nowrap">
            Order #{order.internal_order_number || order.id.slice(0, 8)}
          </h1>
          {order.sales_order_number && (
            <>
              <span className="text-slate-300 text-xs hidden sm:inline">·</span>
              <span className="text-xs text-slate-500 whitespace-nowrap hidden sm:inline">
                SO# <span className="font-medium text-slate-700">{order.sales_order_number}</span>
              </span>
            </>
          )}
          <span className="text-slate-300 text-xs hidden sm:inline">·</span>
          <span className="text-xs text-slate-400 whitespace-nowrap hidden sm:inline">
            {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>

        {/* Action buttons — right-aligned, compact */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <TimelineDrawer orderId={orderId} orderNumber={order.internal_order_number} />

          <button
            onClick={handleDownloadLatestTrackingSlip}
            disabled={generatingTrackingSlip !== null}
            title="Download Tracking Slip"
            className="flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors text-xs font-medium disabled:opacity-50"
          >
            {generatingTrackingSlip !== null
              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              : <FileDown className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Slip</span>
          </button>

          <button
            onClick={() => setShowEditModal(true)}
            title="Edit Order"
            className="flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:text-orange-700 hover:border-orange-300 hover:bg-orange-50 transition-colors text-xs font-medium"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Edit</span>
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            title="Delete Order"
            className="flex items-center justify-center h-8 w-8 rounded-md border border-slate-200 bg-white text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
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
      <Card className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-orange-500" />
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer Information</h2>
          </div>
          {/* Status badges — compact, in the header */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                order.order_status === 'Delivered' ? 'bg-green-100 text-green-700' :
                order.order_status === 'In Transit' ? 'bg-blue-100 text-blue-700' :
                order.order_status === 'Ready for Dispatch' ? 'bg-purple-100 text-purple-700' :
                order.order_status === 'Partial Delivered' ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-600'
              }`}
            >
              {order.order_status}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                derivedPaymentStatus === 'complete' ? 'bg-green-100 text-green-700' :
                derivedPaymentStatus === 'partial' ? 'bg-blue-100 text-blue-700' :
                'bg-amber-100 text-amber-700'
              }`}
            >
              {derivedPaymentStatus === 'complete' ? 'Paid' :
               derivedPaymentStatus === 'partial' ? 'Partial Payment' :
               'Payment Pending'}
            </span>
            {order.cash_discount && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                Cash Discount
              </span>
            )}
          </div>
        </div>

        {/* Card Body */}
        <div className="px-5 py-4">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            {/* Avatar + Name + Contact Person */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-700 font-bold text-base flex items-center justify-center flex-shrink-0 select-none">
                {order.customers?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-900 truncate">{order.customers?.name || '—'}</p>
                {order.customers?.contact_person && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    Contact: <span className="font-medium text-slate-700">{order.customers.contact_person}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Contact details: Phone, Email, Address */}
            <div className="flex flex-col gap-2 sm:items-end text-sm sm:min-w-[220px]">
              {order.customers?.phone ? (
                <a
                  href={`tel:${order.customers.phone}`}
                  className="flex items-center gap-2 text-slate-700 hover:text-orange-600 transition-colors group"
                >
                  <span className="w-5 h-5 rounded bg-slate-100 group-hover:bg-orange-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-slate-500 group-hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </span>
                  <span className="font-medium">{order.customers.phone}</span>
                </a>
              ) : (
                <p className="flex items-center gap-2 text-slate-400 text-xs">
                  <span className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </span>
                  No phone
                </p>
              )}

              {order.customers?.email ? (
                <a
                  href={`mailto:${order.customers.email}`}
                  className="flex items-center gap-2 text-slate-700 hover:text-orange-600 transition-colors group"
                >
                  <span className="w-5 h-5 rounded bg-slate-100 group-hover:bg-orange-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-slate-500 group-hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <span className="font-medium truncate max-w-[180px]">{order.customers.email}</span>
                </a>
              ) : (
                <p className="flex items-center gap-2 text-slate-400 text-xs">
                  <span className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  No email
                </p>
              )}

              {order.customers?.address && (
                <p className="flex items-start gap-2 text-slate-600 text-xs sm:text-right">
                  <span className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </span>
                  <span className="leading-relaxed">{order.customers.address}</span>
                </p>
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

          <TabsTrigger
            value="comments"
            className="relative flex-shrink-0 rounded-none border-b-2 border-transparent px-5 py-3 font-medium text-sm text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500 data-[state=active]:text-orange-500 data-[state=active]:bg-transparent flex items-center"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Comments
            {commentCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold bg-orange-500 text-white" title={`${commentCount} comment${commentCount !== 1 ? "s" : ""}`}>
                {commentCount}
              </span>
            )}
          </TabsTrigger>

        </TabsList>

        {/* Items Tab */}
        <TabsContent value="items" className="space-y-4 mt-5">

          {/* ── Add Item — compact bar ─────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-lg">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2 rounded-t-lg">
              <Plus className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Add Item to Order</span>
            </div>
            <div className="p-4">
              <div className="flex flex-col sm:flex-row gap-3 items-end">

                {/* Item picker */}
                <div className="flex-1 min-w-0 relative">
                  <Label className="text-xs font-medium text-slate-600 mb-1.5 block">
                    Item <span className="text-red-500">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex h-9 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:border-slate-300 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                  >
                    <span className={selectedItem ? "text-slate-900 font-medium" : "text-slate-400"}>
                      {getSelectedItemName()}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-slate-400 flex-shrink-0 ml-2 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                      <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-72 overflow-hidden flex flex-col">
                        {/* Search */}
                        <div className="p-2 border-b border-slate-100 bg-slate-50">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                            <Input
                              type="text"
                              placeholder="Search items…"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Escape") setIsDropdownOpen(false); e.stopPropagation() }}
                              className="pl-8 pr-8 h-8 text-sm border-slate-200 focus:border-orange-400 focus:ring-orange-100"
                              autoFocus
                            />
                            {searchTerm && (
                              <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        {/* List */}
                        <div className="overflow-y-auto flex-1 py-1">
                          {filteredItems.length === 0 ? (
                            <div className="px-3 py-6 text-sm text-slate-400 text-center">No items match &ldquo;{searchTerm}&rdquo;</div>
                          ) : (
                            filteredItems.map((item) => {
                              const filteredSubItems = item.sub_items?.filter(sub =>
                                !searchTerm || sub.item_name.toLowerCase().includes(searchTerm.toLowerCase())
                              )
                              const showParent = !searchTerm ||
                                item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                item.sr_no?.toString().includes(searchTerm) ||
                                (filteredSubItems && filteredSubItems.length > 0)
                              if (!showParent) return null
                              return (
                                <div key={item.id}>
                                  <div
                                    className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors ${selectedItem === item.id ? "bg-orange-50 text-orange-700" : "hover:bg-slate-50 text-slate-800"}`}
                                    onClick={() => handleItemSelect(item.id)}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded px-1 flex-shrink-0">#{item.sr_no}</span>
                                      <span className="font-medium truncate">{item.item_name}</span>
                                    </div>
                                    {item.sub_items && item.sub_items.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); toggleItemExpansion(item.id) }}
                                        className="ml-2 p-1 rounded hover:bg-slate-200 flex-shrink-0"
                                      >
                                        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${expandedItems.has(item.id) ? "rotate-180" : ""}`} />
                                      </button>
                                    )}
                                  </div>
                                  {item.sub_items && item.sub_items.length > 0 && expandedItems.has(item.id) && (
                                    <div className="border-l-2 border-orange-200 ml-4">
                                      {filteredSubItems && filteredSubItems.length > 0 ? filteredSubItems.map((subItem) => (
                                        <div
                                          key={subItem.id}
                                          className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors ${selectedItem === subItem.id ? "bg-orange-50 text-orange-700" : "hover:bg-slate-50 text-slate-700"}`}
                                          onClick={() => handleItemSelect(subItem.id)}
                                        >
                                          <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                                          <span className="truncate">{subItem.item_name}</span>
                                          <span className="ml-auto text-[10px] font-medium text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 flex-shrink-0">Sub</span>
                                        </div>
                                      )) : searchTerm && (
                                        <div className="px-5 py-1.5 text-xs text-slate-400">No sub-items match</div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Quantity */}
                <div className="w-28 flex-shrink-0">
                  <Label className="text-xs font-medium text-slate-600 mb-1.5 block">
                    Quantity <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={quantity}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "")
                      setQuantity(raw === "" ? 1 : Math.max(1, parseInt(raw, 10)))
                    }}
                    className="h-9 text-sm text-center font-semibold border-slate-200 focus:border-orange-400 focus:ring-orange-100"
                    placeholder="1"
                  />
                </div>

                {/* Add button */}
                <Button
                  onClick={handleAddItem}
                  disabled={addingItem || !selectedItem || quantity <= 0}
                  className="h-9 px-5 bg-orange-500 hover:bg-orange-600 text-white font-medium gap-2 flex-shrink-0 w-full sm:w-auto"
                >
                  {addingItem
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Adding…</>
                    : <><Plus className="w-3.5 h-3.5" /> Add Item</>}
                </Button>
              </div>
            </div>
          </div>

          {/* ── Order Items list ───────────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Order Items</span>
              {order.items && order.items.length > 0 && (
                <span className="ml-auto inline-flex items-center justify-center rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5">
                  {order.items.length}
                </span>
              )}
            </div>

            {!order.items || order.items.length === 0 ? (
              <div className="py-14 flex flex-col items-center gap-3 text-slate-400">
                <div className="p-3 bg-slate-100 rounded-full">
                  <Package className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-500">No items added yet</p>
                <p className="text-xs text-slate-400">Use the form above to add items to this order</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-8">#</th>
                        <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Item</th>
                        <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-32">Quantity</th>
                        <th className="px-4 py-2.5 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {order.items.map((item, index) => {
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
                            if (subItem) { inventoryItem = parentItem; break }
                          }
                        }

                        const displayName = subItem
                          ? `${inventoryItem?.item_name || ""}`
                          : inventoryItem?.item_name || `Item ${index + 1}`
                        const subName = subItem?.item_name
                        const srNo = inventoryItem?.sr_no

                        return (
                          <tr key={item.id} className="hover:bg-orange-50/40 transition-colors group">
                            {/* Row # */}
                            <td className="px-4 py-3 text-xs font-bold text-slate-300 text-center">
                              {srNo ?? index + 1}
                            </td>
                            {/* Item name */}
                            <td className="px-2 py-3">
                              <p className="text-sm font-semibold text-slate-800 leading-tight">{displayName}</p>
                              {subName && (
                                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                  <ChevronRight className="w-3 h-3" />
                                  {subName}
                                </p>
                              )}
                            </td>
                            {/* Quantity stepper */}
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                  className="w-7 h-7 rounded-md border border-slate-200 bg-white text-slate-500 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition-colors flex items-center justify-center font-bold text-base leading-none"
                                  title="Decrease"
                                >−</button>
                                <span className="w-8 text-center text-sm font-bold text-slate-800 tabular-nums">{item.quantity}</span>
                                <button
                                  onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                  className="w-7 h-7 rounded-md border border-slate-200 bg-white text-slate-500 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition-colors flex items-center justify-center font-bold text-base leading-none"
                                  title="Increase"
                                >+</button>
                              </div>
                            </td>
                            {/* Remove */}
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                className="w-7 h-7 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Summary footer */}
                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {order.items.length} line item{order.items.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xs font-semibold text-slate-700">
                    Total qty: <span className="text-orange-600 font-bold">{order.items.reduce((s, i) => s + i.quantity, 0)}</span>
                  </span>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Production Tab */}
        <TabsContent value="production" className="space-y-5 mt-6">
          {/* Production Management Card */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0">
                  <Factory className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Production Management</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Plan and track item manufacturing quantities</p>
                </div>
              </div>

              {/* Order Type Toggle - Hidden if Full Order already exists */}
              {!(productionRecords.length > 0 && productionRecords[0]?.production_type === "full") && (
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-start sm:self-center">
                  <button
                    type="button"
                    onClick={() => {
                      setProductionType("full")
                      setProductionQuantities({})
                    }}
                    disabled={productionRecords.length > 0}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${productionType === "full"
                      ? "bg-orange-500 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      }`}
                  >
                    Full Order
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductionType("partial")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${productionType === "partial"
                      ? "bg-orange-500 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                      }`}
                  >
                    Partial Order
                  </button>
                </div>
              )}
            </div>

            {/* Items List */}
            <div className="divide-y divide-slate-100">
              {!order?.items || order.items.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-400 font-medium">No items added to this order yet</p>
                </div>
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

                  // Calculate produced quantity from started/completed production records only.
                  const producedQty = producedQtyForLineItem(productionRecords, item.id, item.quantity)

                  const remainingQty = Math.max(0, item.quantity - producedQty)
                  const isComplete = remainingQty <= 0
                  const progressPct = item.quantity > 0 ? Math.round((producedQty / item.quantity) * 100) : 0

                  // For Full Order mode, use remaining quantity as default, otherwise use manual state
                  const displayToProduce = productionType === "full" ? remainingQty : (productionQuantities[item.id] || 0)

                  return (
                    <div key={item.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/70 transition-colors">
                      {/* Sr No */}
                      <span className="w-5 text-xs font-bold text-slate-300 flex-shrink-0 text-center select-none">
                        {srNo ?? index + 1}
                      </span>

                      {/* Item name + progress bar */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{displayName}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-500 ${isComplete ? "bg-green-500" : "bg-orange-400"}`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 flex-shrink-0 tabular-nums">{progressPct}%</span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="hidden sm:flex items-center gap-5 flex-shrink-0">
                        <div className="text-center w-12">
                          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Ordered</p>
                          <p className="text-sm font-semibold text-slate-700 mt-0.5 tabular-nums">{item.quantity}</p>
                        </div>
                        <div className="text-center w-12">
                          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Produced</p>
                          <p className="text-sm font-semibold text-slate-700 mt-0.5 tabular-nums">{producedQty}</p>
                        </div>
                        <div className="text-center w-16">
                          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Remaining</p>
                          <div className="mt-0.5">
                            {isComplete ? (
                              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-green-600">
                                <Check className="w-3 h-3" /> Done
                              </span>
                            ) : (
                              <p className="text-sm font-semibold text-orange-500 tabular-nums">{remainingQty}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* To Produce Input */}
                      <div className="flex-shrink-0 w-20">
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide text-center mb-1">To Produce</p>
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
                          className={`h-8 text-center text-sm font-semibold border border-slate-200 rounded-lg transition-all ${productionType === "full"
                            ? "bg-slate-50 text-slate-500"
                            : "bg-white text-slate-900"
                            }`}
                          disabled={isComplete || (productionRecords.length > 0 && productionRecords[0]?.production_type === "full")}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Action Bar */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              {productionRecords.length > 0 ? (
                <div className="flex items-center gap-2 text-xs text-slate-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <span>
                    Order type locked to <strong>{productionRecords[0].production_type === "full" ? "Full" : "Partial"}</strong> due to existing records.
                  </span>
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  {productionType === "full"
                    ? "Full mode — all remaining quantities will be included."
                    : "Partial mode — enter quantities for each item to produce."}
                </p>
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
                className="bg-orange-500 hover:bg-orange-600 text-white h-9 px-5 rounded-lg font-medium text-sm transition-colors whitespace-nowrap"
              >
                {creatingRecord ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5 mr-2" />
                    Create Production Record
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Production History */}
          {productionRecords.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
                  <File className="w-4 h-4 text-slate-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Production History</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {productionRecords.length} record{productionRecords.length !== 1 ? "s" : ""} created
                  </p>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {productionRecords.slice().reverse().map((record) => (
                  <div key={record.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                    {/* Record info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">{record.production_number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${record.production_type === "full"
                          ? "bg-purple-50 text-purple-600 border-purple-100"
                          : "bg-orange-50 text-orange-600 border-orange-100"
                          }`}>
                          {record.production_type === "full" ? "Full" : "Partial"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(record.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    {/* Status */}
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border flex-shrink-0 ${record.status === "completed"
                      ? "bg-green-50 text-green-700 border-green-100"
                      : record.status === "in_production"
                        ? "bg-amber-50 text-amber-700 border-amber-100"
                        : "bg-slate-50 text-slate-500 border-slate-200"
                      }`}>
                      {record.status === "completed"
                        ? "✓ Completed"
                        : record.status === "in_production"
                          ? "In Production"
                          : "Pending"}
                    </span>

                    {/* PDF link */}
                    {record.pdf_file_url ? (
                      <button
                        onClick={() => window.open(record.pdf_file_url, '_blank')}
                        className="flex items-center gap-1.5 text-xs font-medium text-orange-500 hover:text-orange-600 transition-colors flex-shrink-0"
                      >
                        <FileDown className="w-4 h-4" />
                        <span className="hidden sm:inline">View PDF</span>
                      </button>
                    ) : (
                      <span className="w-16 text-xs text-slate-300 text-center flex-shrink-0">No PDF</span>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(record.status === "in_production" || record.status === "pending") && (
                        <Button
                          size="sm"
                          onClick={async () => {
                            const result = await updateProductionRecordStatus(record.id, "completed")
                            if (result.success) {
                              await loadProductionRecords()
                              setSuccess("Marked as completed!")
                              setTimeout(() => setSuccess(null), 2000)
                            } else {
                              setError(result.error || "Failed")
                            }
                          }}
                          className="h-7 text-xs font-semibold bg-green-500 hover:bg-green-600 text-white rounded-lg px-3"
                        >
                          <Check className="w-3 h-3 mr-1" />Done
                        </Button>
                      )}
                      {(record.status === "pending" || record.status === "in_production") && (
                        <button
                          onClick={async () => {
                            if (confirm("Delete this record?")) {
                              const result = await deleteProductionRecord(record.id)
                              if (result.success) {
                                await loadProductionRecords()
                                setSuccess("Record deleted.")
                                setTimeout(() => setSuccess(null), 2000)
                              } else {
                                setError(result.error || "Failed")
                              }
                            }
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>


        {/* Shipment Tab */}
        <TabsContent value="shipment" className="space-y-4 mt-6">

          {/* ── Create Dispatch Form ──────────────────────────────────── */}
          {showDispatchForm && selectedProductionRecord && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm ring-2 ring-orange-300 ring-offset-1">
              <div className="px-6 py-4 bg-gradient-to-r from-orange-50 to-white border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-0.5">New Dispatch</p>
                  <h2 className="text-sm font-bold text-slate-900">{selectedProductionRecord.production_number}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedProductionRecord.production_type === "full" ? "Full order — all items" : "Partial order — selected quantities only"}
                  </p>
                </div>
                <button
                  onClick={() => { setShowDispatchForm(false); setSelectedProductionRecord(null) }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Items summary */}
                  {order?.items && (
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Items in this dispatch</p>
                      <div className="rounded-lg border border-slate-200 overflow-hidden">
                        {order.items.map((item, index) => {
                          let inventoryItem: InventoryItem | undefined
                          let subItem: SubItem | undefined
                          inventoryItem = inventoryItems.find(inv => inv.id === item.inventory_item_id || inv.id === item.product_id)
                          if (!inventoryItem) {
                            for (const parentItem of inventoryItems) {
                              subItem = parentItem.sub_items?.find(sub => sub.id === item.inventory_item_id || sub.id === item.product_id)
                              if (subItem) { inventoryItem = parentItem; break }
                            }
                          }
                          const displayName = subItem
                            ? `${inventoryItem?.item_name || ""} → ${subItem.item_name}`
                            : inventoryItem?.item_name || `Item ${index + 1}`
                          let dispatchQty = 0
                          if (selectedProductionRecord.production_type === "full") {
                            dispatchQty = item.quantity
                          } else if (selectedProductionRecord.selected_quantities && selectedProductionRecord.selected_quantities[item.id]) {
                            dispatchQty = selectedProductionRecord.selected_quantities[item.id] as number
                          }
                          if (dispatchQty === 0) return null
                          return (
                            <div key={item.id} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 last:border-0 bg-slate-50/40">
                              <span className="text-sm text-slate-700">{displayName}</span>
                              <span className="text-sm font-bold text-slate-900 tabular-nums">
                                {dispatchQty} <span className="font-normal text-slate-400 text-xs">units</span>
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {/* Right: Form fields */}
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                        Dispatch Date
                      </Label>
                      <Input
                        type="date"
                        value={dispatchDate}
                        onChange={(e) => setDispatchDate(e.target.value || new Date().toISOString().split("T")[0])}
                        disabled={creatingDispatch}
                        className="h-9 text-sm"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">Defaults to today if not changed</p>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                        Courier Company <span className="text-red-400">*</span>
                      </Label>
                      <select
                        value={selectedCourierCompany}
                        onChange={(e) => setSelectedCourierCompany(e.target.value)}
                        disabled={creatingDispatch}
                        className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                        required
                      >
                        <option value="">Select courier...</option>
                        {courierCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                        Expected Delivery <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        type="date"
                        value={estimatedDelivery}
                        onChange={(e) => setEstimatedDelivery(e.target.value)}
                        disabled={creatingDispatch}
                        min={new Date().toISOString().split("T")[0]}
                        className={`h-9 text-sm ${!estimatedDelivery ? "border-red-300" : ""}`}
                        required
                      />
                      {!estimatedDelivery && <p className="mt-1 text-xs text-red-400">Required — needed to track on-time delivery</p>}
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                        Tracking ID <span className="text-slate-400 font-normal">(optional)</span>
                      </Label>
                      <Input
                        type="text"
                        placeholder="e.g. 1Z999AA10123456784"
                        value={trackingId}
                        onChange={(e) => setTrackingId(e.target.value)}
                        disabled={creatingDispatch}
                        className="h-9 text-sm font-mono"
                      />
                      {selectedCourierCompany && trackingId && (() => {
                        const co = courierCompanies.find(c => c.id === selectedCourierCompany)
                        return co?.tracking_url
                          ? <a href={co.tracking_url.replace('{tracking_number}', trackingId)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-1 block">Preview tracking link →</a>
                          : null
                      })()}
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                        Notes <span className="text-slate-400 font-normal">(optional)</span>
                      </Label>
                      <textarea
                        value={dispatchNotes}
                        onChange={(e) => setDispatchNotes(e.target.value)}
                        disabled={creatingDispatch}
                        placeholder="e.g. Handle with care, call before delivery..."
                        className="w-full h-[68px] rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                      />
                    </div>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowDispatchForm(false); setSelectedProductionRecord(null)
                      setSelectedCourierCompany(""); setTrackingId(""); setEstimatedDelivery(""); setDispatchNotes("")
                      setDispatchDate(new Date().toISOString().split("T")[0])
                    }}
                    disabled={creatingDispatch}
                    className="h-8 text-sm text-slate-500"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!selectedCourierCompany) { setError("Please select a courier company"); return }
                      if (!estimatedDelivery) { setError("Expected Delivery date is required"); return }
                      if (!order?.items) { setError("Order items not available"); return }
                      setCreatingDispatch(true); setError(null)
                      try {
                        const dispatchItems: Array<{ order_item_id: string; quantity: number }> = []
                        order.items.forEach((item) => {
                          let qty = 0
                          if (selectedProductionRecord.production_type === "full") qty = item.quantity
                          else if (selectedProductionRecord.selected_quantities && selectedProductionRecord.selected_quantities[item.id]) qty = selectedProductionRecord.selected_quantities[item.id] as number
                          if (qty > 0) dispatchItems.push({ order_item_id: item.id, quantity: qty })
                        })
                        if (dispatchItems.length === 0) { setError("No items to dispatch"); setCreatingDispatch(false); return }
                        const result = await createDispatch(
                          orderId,
                          selectedProductionRecord.production_type === "full" ? "full" : "partial",
                          dispatchItems,
                          dispatchNotes || undefined,
                          selectedCourierCompany,
                          trackingId || undefined,
                          selectedProductionRecord.id,
                          estimatedDelivery,
                          dispatchDate || new Date().toISOString().split("T")[0]
                        )
                        if (result.success) {
                          setSuccess(`Dispatch created for ${selectedProductionRecord.production_number}!`)
                          setShowDispatchForm(false); setSelectedProductionRecord(null)
                          setSelectedCourierCompany(""); setTrackingId(""); setEstimatedDelivery(""); setDispatchNotes("")
                          setDispatchDate(new Date().toISOString().split("T")[0])
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
                    disabled={creatingDispatch || !selectedCourierCompany || !estimatedDelivery}
                    className="h-8 text-sm bg-orange-500 hover:bg-orange-600 text-white px-5"
                  >
                    <Truck className="w-3.5 h-3.5 mr-2" />
                    {creatingDispatch ? "Creating..." : "Confirm Dispatch"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Ready to Dispatch Banner ──────────────────────────────── */}
          {!showDispatchForm && (() => {
            const readyRecords = productionRecords.filter(r =>
              r.status === "completed" && !dispatches.some(d => d.production_records?.id === r.id)
            )
            if (!readyRecords.length) return null
            return (
              <div className="rounded-xl border border-green-200 bg-green-50/50 px-5 py-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-green-800 mb-2.5">
                      {readyRecords.length === 1 ? "1 production record" : `${readyRecords.length} production records`} ready to dispatch
                    </p>
                    <div className="space-y-2">
                      {readyRecords.map(record => (
                        <div key={record.id} className="flex items-center justify-between gap-3 bg-white rounded-lg px-4 py-2.5 border border-green-100">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">{record.production_number}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${record.production_type === "full" ? "bg-purple-100 text-purple-700" : "bg-orange-100 text-orange-700"}`}>
                              {record.production_type === "full" ? "Full" : "Partial"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {record.pdf_file_url && (
                              <button onClick={() => window.open(record.pdf_file_url, '_blank')}
                                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors">
                                <FileDown className="w-3.5 h-3.5" /> PDF
                              </button>
                            )}
                            <Button size="sm"
                              onClick={() => {
                                setSelectedProductionRecord(record)
                                setShowDispatchForm(true)
                                setSelectedCourierCompany(""); setTrackingId(""); setEstimatedDelivery(""); setDispatchNotes("")
                              }}
                              className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white px-3">
                              <Truck className="w-3 h-3 mr-1.5" /> Dispatch
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── Dispatches ───────────────────────────────────────────── */}
          {dispatches.length === 0 && !showDispatchForm ? (
            <div className="bg-white border border-slate-200 rounded-xl px-6 py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4">
                <Truck className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-400">No dispatches yet</p>
              <p className="text-xs text-slate-300 mt-1">
                {productionRecords.length === 0
                  ? "Complete production first, then dispatch from here"
                  : "Mark a production record complete, then use the Dispatch button above"}
              </p>
            </div>
          ) : dispatches.length > 0 ? (
            <div className="space-y-3">
              {dispatches.map((dispatch) => {
                const shipmentStatus = dispatch.shipment_status || 'ready'
                const statusMeta = {
                  ready:     { label: 'Ready to Ship', leftBorder: 'border-l-amber-400',  badgeCls: 'bg-amber-50 text-amber-700 border-amber-200'  },
                  picked_up: { label: 'In Transit',    leftBorder: 'border-l-blue-400',   badgeCls: 'bg-blue-50 text-blue-700 border-blue-200'    },
                  delivered: { label: 'Delivered',     leftBorder: 'border-l-green-400',  badgeCls: 'bg-green-50 text-green-700 border-green-200'  },
                }
                const statusSteps = [
                  { value: 'ready',     label: 'Ready',     icon: Package      },
                  { value: 'picked_up', label: 'Picked Up', icon: Truck        },
                  { value: 'delivered', label: 'Delivered', icon: CheckCircle2 },
                ]
                const currentStepIndex = statusSteps.findIndex(s => s.value === shipmentStatus)
                const meta = statusMeta[shipmentStatus as keyof typeof statusMeta] || statusMeta.ready
                const productionRecord = dispatch.production_records
                const isOverdue = dispatch.estimated_delivery &&
                  shipmentStatus !== 'delivered' &&
                  new Date(dispatch.estimated_delivery) < new Date(new Date().setHours(0, 0, 0, 0))

                return (
                  <div key={dispatch.id} className={`bg-white border border-slate-200 border-l-4 ${meta.leftBorder} rounded-xl overflow-hidden`}>

                    {/* Card Header */}
                    <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-slate-100">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900">
                            {dispatch.dispatch_type === "full" ? "Full" : "Partial"} Dispatch
                          </span>
                          {productionRecord && (
                            <span className="text-xs text-slate-400 font-medium">· {productionRecord.production_number}</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Dispatched on {new Date(dispatch.dispatch_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${meta.badgeCls}`}>
                          {meta.label}
                        </span>
                        {(shipmentStatus === 'ready' || shipmentStatus === 'picked_up') && editingDispatchId !== dispatch.id && (
                          <button
                            onClick={() => {
                              setEditingDispatchId(dispatch.id)
                              setEditCourierId(dispatch.courier_company_id || "")
                              setEditTrackingId(dispatch.tracking_id || "")
                              setEditEstimatedDelivery(dispatch.estimated_delivery || "")
                              setExpandedShipments(prev => ({ ...prev, [dispatch.id]: true }))
                            }}
                            className="text-xs font-medium text-slate-400 hover:text-slate-700 hover:bg-slate-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="px-5 py-5 space-y-5">

                      {/* ── Shipment Progress Stepper ── */}
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">
                          Shipment Progress <span className="normal-case font-normal">· click a step to update</span>
                        </p>
                        <div className="flex items-center">
                          {statusSteps.map((step, idx) => {
                            const isActive = step.value === shipmentStatus
                            const isDone = idx < currentStepIndex
                            const StepIcon = step.icon
                            return (
                              <div key={step.value} className={`flex items-center ${idx < statusSteps.length - 1 ? "flex-1" : ""}`}>
                                <button
                                  onClick={async () => {
                                    if (step.value === shipmentStatus) return
                                    const newStatus = step.value as 'ready' | 'picked_up' | 'delivered'
                                    const result = await updateDispatchStatus(dispatch.id, newStatus)
                                    if (result.success) {
                                      await loadDispatches()
                                      setSuccess(`Status updated to ${step.label}!`)
                                      setTimeout(() => setSuccess(null), 3000)
                                    } else {
                                      setError(result.error || "Failed to update status")
                                    }
                                  }}
                                  className="flex flex-col items-center gap-1.5 group flex-shrink-0"
                                  title={`Set to ${step.label}`}
                                >
                                  <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
                                    isActive
                                      ? shipmentStatus === 'ready'     ? 'bg-amber-500  border-amber-500  text-white'
                                      : shipmentStatus === 'picked_up' ? 'bg-blue-500   border-blue-500   text-white'
                                      :                                   'bg-green-500  border-green-500  text-white'
                                    : isDone
                                      ? 'bg-green-400 border-green-400 text-white'
                                      : 'bg-white border-slate-200 text-slate-300 hover:border-slate-400 hover:text-slate-500'
                                  }`}>
                                    {isDone ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                                  </div>
                                  <span className={`text-[10px] font-bold whitespace-nowrap ${
                                    isActive ? 'text-slate-800' : isDone ? 'text-green-600' : 'text-slate-400 group-hover:text-slate-600'
                                  }`}>
                                    {step.label}
                                  </span>
                                </button>
                                {idx < statusSteps.length - 1 && (
                                  <div className={`flex-1 h-0.5 mx-2 mb-5 rounded-full transition-colors ${
                                    idx < currentStepIndex ? 'bg-green-400' : 'bg-slate-200'
                                  }`} />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* ── Edit Form ── */}
                      {editingDispatchId === dispatch.id ? (
                        <div className="rounded-xl border border-orange-200 bg-orange-50/30 p-4 space-y-3">
                          <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">Edit Shipment Details</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <Label className="text-xs font-semibold text-slate-500 mb-1.5 block">Courier</Label>
                              <select value={editCourierId} onChange={(e) => setEditCourierId(e.target.value)}
                                className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                                <option value="">— No courier —</option>
                                {courierCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                            <div>
                              <Label className="text-xs font-semibold text-slate-500 mb-1.5 block">Tracking ID</Label>
                              <Input value={editTrackingId} onChange={(e) => setEditTrackingId(e.target.value)}
                                placeholder="Tracking ID" className="h-9 text-sm font-mono" />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold text-slate-500 mb-1.5 block">Estimated Delivery</Label>
                              <Input type="date" value={editEstimatedDelivery} onChange={(e) => setEditEstimatedDelivery(e.target.value)}
                                className="h-9 text-sm" />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <Button size="sm" disabled={savingDispatchEdit}
                              onClick={async () => {
                                setSavingDispatchEdit(true)
                                const result = await updateDispatchDetails(dispatch.id, {
                                  courier_company_id: editCourierId || null,
                                  tracking_id: editTrackingId || null,
                                  estimated_delivery: editEstimatedDelivery || null,
                                })
                                setSavingDispatchEdit(false)
                                if (result.success) {
                                  setEditingDispatchId(null)
                                  await loadDispatches()
                                  setSuccess("Shipment details updated!")
                                  setTimeout(() => setSuccess(null), 3000)
                                } else {
                                  setError(result.error || "Failed to save changes")
                                }
                              }}
                              className="h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white">
                              {savingDispatchEdit ? "Saving…" : "Save Changes"}
                            </Button>
                            <Button variant="ghost" size="sm" disabled={savingDispatchEdit}
                              onClick={() => setEditingDispatchId(null)} className="h-8 text-xs text-slate-500">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* ── Shipment Details (read-only) ── */
                        (dispatch.courier_companies || dispatch.tracking_id || dispatch.estimated_delivery) && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 px-4 py-4 bg-slate-50/70 rounded-xl border border-slate-100">
                            {dispatch.courier_companies && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Via Courier</p>
                                <div className="flex items-center gap-1.5">
                                  <Truck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                  <span className="text-sm font-semibold text-slate-800">{dispatch.courier_companies.name}</span>
                                </div>
                              </div>
                            )}
                            {dispatch.tracking_id && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tracking No.</p>
                                <p className="text-sm font-mono font-semibold text-slate-800">{dispatch.tracking_id}</p>
                                {dispatch.courier_companies?.tracking_url && (
                                  <a
                                    href={dispatch.courier_companies.tracking_url.replace('{tracking_number}', dispatch.tracking_id)}
                                    target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-blue-500 hover:text-blue-700 hover:underline font-medium mt-0.5 block">
                                    Track package →
                                  </a>
                                )}
                              </div>
                            )}
                            {dispatch.estimated_delivery && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Expected Delivery</p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-sm font-semibold ${isOverdue ? 'text-red-600' : 'text-slate-800'}`}>
                                    {new Date(dispatch.estimated_delivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </span>
                                  {isOverdue && (
                                    <span className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                                      Overdue
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      )}

                      {/* ── Items Dispatched ── */}
                      {dispatch.dispatch_items && dispatch.dispatch_items.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Items Dispatched</p>
                          <div className="rounded-lg border border-slate-100 overflow-hidden divide-y divide-slate-100">
                            {dispatch.dispatch_items.map((di: any, idx: number) => {
                              const orderItem = di.order_items
                              let itemName = `Item ${idx + 1}`
                              if (orderItem) {
                                let inventoryItem: InventoryItem | undefined
                                let subItem: SubItem | undefined
                                inventoryItem = inventoryItems.find(inv => inv.id === orderItem.inventory_item_id || inv.id === orderItem.product_id)
                                if (!inventoryItem) {
                                  for (const parentItem of inventoryItems) {
                                    subItem = parentItem.sub_items?.find(sub => sub.id === orderItem.inventory_item_id || sub.id === orderItem.product_id)
                                    if (subItem) { inventoryItem = parentItem; break }
                                  }
                                }
                                itemName = subItem
                                  ? `${inventoryItem?.item_name || ""} → ${subItem.item_name}`
                                  : inventoryItem?.item_name || `Item ${idx + 1}`
                              }
                              return (
                                <div key={di.id} className="flex items-center justify-between px-4 py-2.5 bg-slate-50/30 hover:bg-slate-50 transition-colors">
                                  <span className="text-sm text-slate-700">{itemName}</span>
                                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                                    {di.quantity} <span className="font-normal text-slate-400 text-xs">units</span>
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* ── Notes ── */}
                      {dispatch.notes && (
                        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-lg">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-800">{dispatch.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </TabsContent>

        {/* Payment Tab */}
        <TabsContent value="payment" className="mt-6">
          <div className="mx-auto max-w-4xl px-4">
            <div className="space-y-4">

            {/* ── KPI Summary ── */}
            {(() => {
              const paidPct = paymentSummary.totalInvoiced > 0
                ? Math.min(100, (paymentSummary.totalPaid / paymentSummary.totalInvoiced) * 100)
                : 0
              const statusMeta = derivedPaymentStatus === "complete"
                ? { label: "Fully Paid", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", accent: "border-l-emerald-500", bar: "bg-emerald-500" }
                : derivedPaymentStatus === "partial"
                ? { label: "Partial Payment", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200", accent: "border-l-amber-400", bar: "bg-amber-400" }
                : { label: "Payment Pending", dot: "bg-slate-400", badge: "bg-slate-100 text-slate-500 border-slate-200", accent: "border-l-slate-300", bar: "bg-slate-200" }

              return (
                <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm border-l-4 ${statusMeta.accent}`}>
                  {/* ── Metrics row ── */}
                  <div className="grid grid-cols-2 divide-slate-100 sm:grid-cols-4 sm:divide-x sm:divide-y-0 divide-y">

                    {/* Total Invoiced */}
                    <div className="px-5 py-4">
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <div className="flex h-5 w-5 items-center justify-center rounded bg-indigo-50">
                          <FileText className="h-3 w-3 text-indigo-500" />
                        </div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Total Invoiced</p>
                      </div>
                      <p className="text-xl font-bold tracking-tight text-slate-800">
                        ₹{paymentSummary.totalInvoiced.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                      {paymentSummary.totalInvoiced === 0 && (
                        <p className="mt-0.5 text-[10px] text-slate-400">No invoices raised</p>
                      )}
                    </div>

                    {/* Total Received */}
                    <div className="px-5 py-4">
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <div className="flex h-5 w-5 items-center justify-center rounded bg-emerald-50">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        </div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Received</p>
                      </div>
                      <p className="text-xl font-bold tracking-tight text-emerald-600">
                        ₹{paymentSummary.totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                      {paymentSummary.totalPaid === 0 && paymentSummary.totalInvoiced > 0 && (
                        <p className="mt-0.5 text-[10px] text-amber-500">Awaiting payment</p>
                      )}
                    </div>

                    {/* Balance Due */}
                    <div className={`px-5 py-4 ${paymentSummary.amountDue > 0 ? "bg-red-50/40" : ""}`}>
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <div className={`flex h-5 w-5 items-center justify-center rounded ${paymentSummary.amountDue > 0 ? "bg-red-100" : "bg-slate-100"}`}>
                          <AlertCircle className={`h-3 w-3 ${paymentSummary.amountDue > 0 ? "text-red-500" : "text-slate-300"}`} />
                        </div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Balance Due</p>
                      </div>
                      <p className={`text-xl font-bold tracking-tight ${paymentSummary.amountDue > 0 ? "text-red-600" : "text-slate-400"}`}>
                        ₹{paymentSummary.amountDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                      {paymentSummary.amountDue > 0 && (
                        <p className="mt-0.5 text-[10px] font-medium text-red-400">Outstanding balance</p>
                      )}
                    </div>

                    {/* Status */}
                    <div className="flex flex-col justify-center px-5 py-4">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Status</p>
                      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusMeta.badge}`}>
                        <span className={`h-2 w-2 rounded-full ${statusMeta.dot}`} />
                        {statusMeta.label}
                      </span>
                      {derivedPaymentStatus === "complete" && (
                        <p className="mt-1.5 text-[10px] text-emerald-600">All invoices cleared</p>
                      )}
                    </div>
                  </div>

                  {/* ── Progress bar ── */}
                  <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-[10px] text-slate-400">Collection progress</p>
                      <p className={`text-[10px] font-bold ${paidPct >= 100 ? "text-emerald-600" : paidPct > 0 ? "text-amber-600" : "text-slate-400"}`}>
                        {paidPct.toFixed(0)}%
                      </p>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${statusMeta.bar}`}
                        style={{ width: `${paidPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* ── Alerts ── */}
            {(!canRecordPayment || order.cash_discount) && (
              <div className="space-y-2">
                {!canRecordPayment && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Dispatch required before recording payment</p>
                      <p className="mt-0.5 text-xs text-amber-700">
                        Create at least one dispatch in the <strong>Shipment</strong> tab before you can record payments or save invoices.
                      </p>
                    </div>
                  </div>
                )}
                {order.cash_discount && (
                  <div className="flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3.5">
                    <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
                    <div>
                      <p className="text-sm font-semibold text-indigo-800">Cash Discount Active</p>
                      <p className="mt-0.5 text-xs text-indigo-700">
                        A payment follow-up reminder will be auto-created 14 days after the first dispatch.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}


            <div className="flex items-center justify-end">
              <Button
                type="button"
                size="sm"
                onClick={startCreateInvoiceDraft}
                className="h-8 rounded-md bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New Invoice
              </Button>
            </div>

            {/* ── Create Invoice form ── */}
            {showCreateInvoiceForm && (
              <div className="overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-sm">
                <input
                  id="create-invoice-attachment-input"
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    setInvoiceDraftAttachment(file)
                    event.target.value = ""
                  }}
                />
                {/* Form header */}
                <div className="flex items-center gap-3 border-b border-indigo-100 bg-indigo-50 px-5 py-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-indigo-900">New Invoice</h3>
                    <p className="text-[11px] text-indigo-600">Fill in the details below and click Save Invoice</p>
                  </div>
                </div>
                {/* Form fields */}
                <div className="p-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="mb-1.5 block text-xs font-medium text-slate-600">Invoice Number <span className="text-red-400">*</span></Label>
                      <Input
                        value={invoiceDraftNumber}
                        onChange={(e) => setInvoiceDraftNumber(e.target.value)}
                        className="h-9 border-slate-200 bg-white text-sm focus-visible:ring-indigo-400"
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs font-medium text-slate-600">Invoice Date <span className="text-red-400">*</span></Label>
                      <Input
                        type="date"
                        value={invoiceDraftDate || new Date().toISOString().split("T")[0]}
                        onChange={(e) => setInvoiceDraftDate(e.target.value)}
                        className="h-9 border-slate-200 bg-white text-sm focus-visible:ring-indigo-400"
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs font-medium text-slate-600">Invoice Amount (₹) <span className="text-red-400">*</span></Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={invoiceDraftAmount}
                        onChange={(e) => setInvoiceDraftAmount(e.target.value)}
                        placeholder="0.00"
                        className="h-9 border-slate-200 bg-white text-sm focus-visible:ring-indigo-400"
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs font-medium text-slate-600">Link to Dispatch</Label>
                      <select
                        value={invoiceDraftDispatchId}
                        onChange={(e) => setInvoiceDraftDispatchId(e.target.value)}
                        className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        <option value="">Not linked to a dispatch</option>
                        {invoiceEligibleDispatches
                          .filter((d: any) => !invoiceDispatchIds.has(d.id))
                          .map((dispatch: any) => (
                            <option key={dispatch.id} value={dispatch.id}>
                              {formatDispatchOptionLabel(dispatch)}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="mb-1.5 block text-xs font-medium text-slate-600">Notes (optional)</Label>
                      <Input
                        value={invoiceDraftNotes}
                        onChange={(e) => setInvoiceDraftNotes(e.target.value)}
                        placeholder="Any additional notes about this invoice..."
                        className="h-9 border-slate-200 bg-white text-sm focus-visible:ring-indigo-400"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="mb-1.5 block text-xs font-medium text-slate-600">Attachment (optional)</Label>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 border-slate-200 text-[11px] text-slate-600 hover:bg-slate-50"
                          onClick={() => (document.getElementById("create-invoice-attachment-input") as HTMLInputElement | null)?.click()}
                        >
                          <Upload className="mr-1 h-3.5 w-3.5" />
                          {invoiceDraftAttachment ? "Change file" : "Upload PDF / Image"}
                        </Button>
                        {invoiceDraftAttachment ? (
                          <>
                            <span className="rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700">
                              {invoiceDraftAttachment.name} ({(invoiceDraftAttachment.size / 1024).toFixed(1)} KB)
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-7 px-2 text-[11px] text-red-500 hover:bg-red-50 hover:text-red-700"
                              onClick={() => setInvoiceDraftAttachment(null)}
                            >
                              Remove
                            </Button>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-400">PDF · JPG · PNG accepted</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                    {orderInvoices.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={savingInvoice}
                        onClick={() => {
                          const last = orderInvoices[orderInvoices.length - 1]
                          setSelectedInvoiceId(last.id)
                          setInvoiceDraftId(last.id)
                          setInvoiceDraftNumber(last.invoice_number ?? "")
                          setInvoiceDraftDate(String(last.invoice_date || "").split("T")[0] || new Date().toISOString().split("T")[0])
                          setInvoiceDraftAmount(String(last.invoice_amount ?? ""))
                          setInvoiceDraftDispatchId(last.dispatch_id ?? "")
                          setInvoiceDraftNotes(last.notes ?? "")
                          setInvoiceDraftAttachment(null)
                          setShowCreateInvoiceForm(false)
                        }}
                        className="h-9 rounded-lg border-slate-200 px-4 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      type="button"
                      disabled={savingInvoice || !invoiceDraftNumber.trim() || invoiceDraftAmount.trim() === ""}
                      onClick={async () => {
                        setError(null)
                        const amt = Number(invoiceDraftAmount)
                        if (!Number.isFinite(amt) || amt < 0) {
                          setError("Enter a valid invoice amount.")
                          return
                        }
                        const dispatchIdForSave = invoiceDraftDispatchId || null
                        const selectedDispatch = invoiceEligibleDispatches.find((d: any) => d.id === dispatchIdForSave)
                        const autoLinkMode = !dispatchIdForSave ? "manual" : selectedDispatch?.dispatch_type === "full" ? "full" : "batch"
                        setSavingInvoice(true)
                        try {
                          const res = await createOrUpdateOrderInvoice({
                            orderId,
                            invoiceId: undefined,
                            invoiceNumber: invoiceDraftNumber,
                            invoiceDate: invoiceDraftDate || undefined,
                            invoiceAmount: amt,
                            notes: invoiceDraftNotes || undefined,
                            dispatchId: dispatchIdForSave,
                            dispatchLinkMode: autoLinkMode,
                          })
                          if (!res.success) {
                            setError(res.error || "Failed to save invoice")
                            return
                          }
                          const invRes = await getOrderInvoices(orderId)
                          if (invRes.success) setOrderInvoices(invRes.data)
                          const savedId = (res as any).data?.id
                          if (savedId) setSelectedInvoiceId(savedId)
                          let attachmentUploaded = false
                          if (savedId && invoiceDraftAttachment) {
                            const attachmentResult = await handleInvoiceAttachmentUpload(invoiceDraftAttachment, savedId, true)
                            if (!attachmentResult.success) {
                              setError(attachmentResult.error || "Invoice saved but attachment upload failed.")
                            } else {
                              attachmentUploaded = true
                              setInvoiceDraftAttachment(null)
                            }
                          }
                          setSuccess(attachmentUploaded ? "Invoice and attachment saved!" : "Invoice saved successfully!")
                          setShowCreateInvoiceForm(false)
                          setTimeout(() => setSuccess(null), 2000)
                        } finally {
                          setSavingInvoice(false)
                        }
                      }}
                      className="h-9 rounded-lg bg-indigo-600 px-6 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {savingInvoice ? "Saving..." : "Save Invoice"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Invoices list ── */}
            <div className="space-y-3">
              {/* Section header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Invoices
                  </h3>
                  {orderInvoices.length > 0 && (
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
                      {orderInvoices.length}
                    </span>
                  )}
                </div>
                {orderInvoices.length > 1 && (
                  <div className="flex items-center gap-2">
                    <Label className="text-[11px] text-slate-500">Viewing</Label>
                    <select
                      value={selectedInvoiceId ?? orderInvoices[0]?.id ?? ""}
                      onChange={(e) => {
                        const selected = orderInvoices.find((invoice: any) => invoice.id === e.target.value)
                        if (!selected) return
                        setSelectedInvoiceId(selected.id)
                        setInvoiceDraftId(selected.id)
                        setInvoiceDraftNumber(selected.invoice_number ?? "")
                        setInvoiceDraftDate(String(selected.invoice_date || "").split("T")[0] || new Date().toISOString().split("T")[0])
                        setInvoiceDraftAmount(String(selected.invoice_amount ?? ""))
                        setInvoiceDraftDispatchId(selected.dispatch_id ?? "")
                        setInvoiceDraftNotes(selected.notes ?? "")
                        setShowCreateInvoiceForm(false)
                      }}
                      className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      {orderInvoices.map((invoice: any) => (
                        <option key={invoice.id} value={invoice.id}>
                          {invoice.invoice_number} — {getInvoiceDispatchContextLabel(invoice)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Empty state */}
              {orderInvoices.length === 0 && !showCreateInvoiceForm && (
                <div className="flex min-h-[120px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
                  <FileText className="h-8 w-8 text-slate-200" />
                  <p className="mt-2 text-sm font-medium text-slate-400">No invoices yet</p>
                  <p className="text-[11px] text-slate-400">Click &quot;New Invoice&quot; above to create one</p>
                </div>
              )}

              {/* Invoice cards */}
              {(selectedInvoiceId
                ? orderInvoices.filter((invoice: any) => invoice.id === selectedInvoiceId)
                : orderInvoices.slice(0, 1)
              ).map((inv: any) => {
                const invPayments    = orderPayments.filter((p: any) => p.invoice_id === inv.id)
                const invAttachments = invoiceAttachments.filter((a: any) => a.invoice_id === inv.id)
                const invPaid        = Number(inv.total_paid || 0)
                const invDue         = Number(inv.amount_due || 0)
                const invAmt         = Number(inv.invoice_amount || 0)
                const isFullyPaid    = invDue === 0 && invAmt > 0
                const invStatusMeta  = isFullyPaid
                  ? { label: "Paid", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" }
                  : invPaid > 0
                  ? { label: "Partial", cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" }
                  : { label: "Pending", cls: "bg-slate-100 text-slate-500 border-slate-200", dot: "bg-slate-400" }

                return (
                  <div key={inv.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

                    {/* Card header strip */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
                          <FileText className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{inv.invoice_number}</p>
                          <p className="text-[10px] text-slate-400">{getInvoiceDispatchContextLabel(inv)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400">Invoice Amount</p>
                          <p className="text-sm font-bold text-slate-800">₹{invAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${invStatusMeta.cls}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${invStatusMeta.dot}`} />
                          {invStatusMeta.label}
                        </span>
                      </div>
                    </div>

                    {/* Hidden file input */}
                    <input
                      id={`invoice-attachment-input-${inv.id}`}
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) handleInvoiceAttachmentUpload(file, inv.id)
                        event.target.value = ""
                      }}
                    />

                    <div className="grid grid-cols-1 divide-y divide-slate-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">

                      {/* ── LEFT: Invoice Details + Attachments ── */}
                      <div className="space-y-5 p-4">

                        {/* Invoice detail fields */}
                        <div>
                          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-indigo-400">Invoice Details</p>
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="mb-1.5 block text-xs font-medium text-slate-500">Invoice No.</Label>
                                <Input value={invoiceDraftNumber} onChange={(e) => setInvoiceDraftNumber(e.target.value)}
                                  className="h-8 rounded-md border-slate-200 bg-white text-xs focus-visible:ring-indigo-400" disabled={savingInvoice} />
                              </div>
                              <div>
                                <Label className="mb-1.5 block text-xs font-medium text-slate-500">Date</Label>
                                <Input type="date" value={invoiceDraftDate || new Date().toISOString().split("T")[0]}
                                  onChange={(e) => setInvoiceDraftDate(e.target.value)}
                                  className="h-8 rounded-md border-slate-200 bg-white text-xs focus-visible:ring-indigo-400" disabled={savingInvoice} />
                              </div>
                            </div>
                            <div>
                              <Label className="mb-1.5 block text-xs font-medium text-slate-500">Amount (₹)</Label>
                              <Input type="number" min={0} step="0.01" value={invoiceDraftAmount} placeholder="0.00"
                                onChange={(e) => setInvoiceDraftAmount(e.target.value)}
                                className="h-8 rounded-md border-slate-200 bg-white text-xs focus-visible:ring-indigo-400" disabled={savingInvoice} />
                            </div>
                            <div>
                              <Label className="mb-1.5 block text-xs font-medium text-slate-500">Link to Dispatch</Label>
                              <select value={invoiceDraftDispatchId} onChange={(e) => setInvoiceDraftDispatchId(e.target.value)}
                                disabled={savingInvoice}
                                className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50">
                                <option value="">Not linked to a dispatch</option>
                                {(dispatches || []).filter((d: any) => d.dispatch_type !== "return").map((d: any) => {
                                  const dispDate = d.dispatch_date
                                    ? new Date(d.dispatch_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                                    : "—"
                                  return (
                                    <option key={d.id} value={d.id}>
                                      {d.dispatch_type === "full" ? "Full Dispatch" : "Partial Dispatch"} — {dispDate}
                                    </option>
                                  )
                                })}
                              </select>
                            </div>
                            <div>
                              <Label className="mb-1.5 block text-xs font-medium text-slate-500">Notes</Label>
                              <Input value={invoiceDraftNotes} placeholder="Optional notes..." onChange={(e) => setInvoiceDraftNotes(e.target.value)}
                                className="h-8 rounded-md border-slate-200 bg-white text-xs focus-visible:ring-indigo-400" disabled={savingInvoice} />
                            </div>

                            {/* Paid / Balance summary */}
                            <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-100">
                              <div className="bg-emerald-50 px-3 py-2.5">
                                <p className="text-[10px] font-medium text-emerald-600">Paid</p>
                                <p className="text-sm font-bold text-emerald-700">₹{invPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                              </div>
                              <div className={`px-3 py-2.5 ${invDue > 0 ? "bg-red-50" : "bg-slate-50"}`}>
                                <p className={`text-[10px] font-medium ${invDue > 0 ? "text-red-500" : "text-slate-400"}`}>Balance Due</p>
                                <p className={`text-sm font-bold ${invDue > 0 ? "text-red-600" : "text-slate-400"}`}>
                                  ₹{invDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Attachments */}
                        <div>
                          <div className="mb-2.5 flex items-center justify-between">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400">
                              Attachments{invAttachments.length > 0 ? ` (${invAttachments.length})` : ""}
                            </p>
                            <span className="text-[10px] text-slate-400">PDF · JPG · PNG</span>
                          </div>
                          {invAttachments.length === 0 ? (
                            <div onClick={() => (document.getElementById(`invoice-attachment-input-${inv.id}`) as HTMLInputElement | null)?.click()}
                              className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-200 py-6 transition-colors hover:border-indigo-300 hover:bg-indigo-50/30">
                              <Upload className="h-5 w-5 text-slate-300" />
                              <p className="text-[11px] font-medium text-slate-400">
                                {uploadingInvoiceAttachment ? "Uploading..." : "Click to upload attachment"}
                              </p>
                              <p className="text-[10px] text-slate-300">PDF, JPG or PNG</p>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {invAttachments.map((attachment: any) => (
                                <div key={attachment.id} className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                  <File className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-medium text-slate-700">{attachment.file_name}</p>
                                    <p className="text-[10px] text-slate-400">
                                      {attachment.file_size ? `${(attachment.file_size / 1024).toFixed(1)} KB` : ""}
                                      {attachment.created_at ? ` · ${new Date(attachment.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}` : ""}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => window.open(attachment.file_url, "_blank")}
                                      className="h-7 w-7 rounded-md p-0 text-indigo-400 hover:bg-indigo-50 hover:text-indigo-600">
                                      <Download className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="sm"
                                      onClick={async () => {
                                        if (confirm("Delete this attachment?")) {
                                          const result = await deleteInvoiceAttachment(attachment.id)
                                          if (result.success) { await loadInvoiceAttachments(); setSuccess("Attachment deleted!"); setTimeout(() => setSuccess(null), 2000) }
                                          else setError(result.error || "Failed to delete attachment")
                                        }
                                      }}
                                      className="h-7 w-7 rounded-md p-0 text-slate-400 hover:bg-red-50 hover:text-red-500">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              <Button type="button" variant="outline" size="sm" disabled={uploadingInvoiceAttachment}
                                onClick={() => (document.getElementById(`invoice-attachment-input-${inv.id}`) as HTMLInputElement | null)?.click()}
                                className="h-7 w-full rounded-lg border-dashed border-slate-200 text-[11px] text-slate-500 hover:border-indigo-300 hover:bg-indigo-50/30 hover:text-indigo-600 disabled:opacity-50">
                                <Plus className="mr-1 h-3 w-3" />
                                {uploadingInvoiceAttachment ? "Uploading..." : "Add another file"}
                              </Button>
                            </div>
                          )}
                        </div>

                        <Button
                          type="button"
                          disabled={savingInvoice || !invoiceDraftNumber.trim() || invoiceDraftAmount.trim() === ""}
                          onClick={async () => {
                            const amt = Number(invoiceDraftAmount)
                            if (!Number.isFinite(amt) || amt < 0) { setError("Enter a valid invoice amount."); return }
                            setSavingInvoice(true)
                            try {
                              const res = await createOrUpdateOrderInvoice({
                                orderId, invoiceId: inv.id,
                                invoiceNumber: invoiceDraftNumber,
                                invoiceDate: invoiceDraftDate || undefined,
                                invoiceAmount: amt,
                                notes: invoiceDraftNotes || undefined,
                                dispatchId: invoiceDraftDispatchId || null,
                              })
                              if (!res.success) { setError(res.error || "Failed to update invoice"); return }
                              const invRes = await getOrderInvoices(orderId)
                              if (invRes.success) setOrderInvoices(invRes.data)
                              setSuccess("Invoice updated successfully!")
                              setTimeout(() => setSuccess(null), 2000)
                            } finally { setSavingInvoice(false) }
                          }}
                          className="h-9 w-full rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
                        >
                          {savingInvoice ? "Saving..." : "Update Invoice"}
                        </Button>
                      </div>

                      {/* ── RIGHT: Record Payment + History ── */}
                      <div className="space-y-5 p-4">

                        {/* Record Payment */}
                        <div>
                          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-emerald-600">Record Payment</p>

                          {isFullyPaid ? (
                            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                              <div>
                                <p className="text-sm font-semibold text-emerald-800">Invoice Fully Paid</p>
                                <p className="mt-0.5 text-xs text-emerald-700">
                                  ₹{invAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })} received in full. No further payment needed.
                                </p>
                              </div>
                            </div>
                          ) : !canRecordPayment ? (
                            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
                              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                              <div>
                                <p className="text-sm font-semibold text-amber-800">Dispatch Required</p>
                                <p className="mt-0.5 text-xs text-amber-700">
                                  Create a dispatch in the <strong>Shipment</strong> tab before recording payments.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {invDue > 0 && (
                                <div className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                                  <p className="text-xs text-red-600">Balance remaining on this invoice</p>
                                  <p className="text-sm font-bold text-red-700">₹{invDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="mb-1.5 block text-xs font-medium text-slate-500">Amount (₹) <span className="text-red-400">*</span></Label>
                                  <Input type="number" step="0.01" min="0" value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    placeholder={`Max ₹${invDue.toLocaleString("en-IN")}`}
                                    className="h-8 rounded-md border-slate-200 bg-white text-xs focus-visible:ring-emerald-400" disabled={addingPayment} />
                                </div>
                                <div>
                                  <Label className="mb-1.5 block text-xs font-medium text-slate-500">Date</Label>
                                  <Input type="date" value={paymentDate || new Date().toISOString().split("T")[0]}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                    className="h-8 rounded-md border-slate-200 bg-white text-xs focus-visible:ring-emerald-400" disabled={addingPayment} />
                                </div>
                              </div>
                              <div>
                                <Label className="mb-1.5 block text-xs font-medium text-slate-500">Payment Method</Label>
                                <Select value={paymentMethod || "cash"} onValueChange={setPaymentMethod} disabled={addingPayment}>
                                  <SelectTrigger className="h-8 rounded-md border-slate-200 bg-white text-xs focus:ring-emerald-400">
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
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="mb-1.5 block text-xs font-medium text-slate-500">Reference / UTR</Label>
                                  <Input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)}
                                    placeholder="e.g. UTR12345"
                                    className="h-8 rounded-md border-slate-200 bg-white text-xs focus-visible:ring-emerald-400" disabled={addingPayment} />
                                </div>
                                <div>
                                  <Label className="mb-1.5 block text-xs font-medium text-slate-500">Notes</Label>
                                  <Input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)}
                                    placeholder="Optional"
                                    className="h-8 rounded-md border-slate-200 bg-white text-xs focus-visible:ring-emerald-400" disabled={addingPayment} />
                                </div>
                              </div>
                              <Button type="button" onClick={handleAddPaymentRecord}
                                disabled={addingPayment || !paymentAmount}
                                className="h-9 w-full rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">
                                {addingPayment ? "Recording..." : "Record Payment"}
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Payment history */}
                        <div>
                          <div className="mb-3 flex items-center gap-2">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600">
                              Payment History
                            </p>
                            {invPayments.length > 0 && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                                {invPayments.length}
                              </span>
                            )}
                          </div>
                          {invPayments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-6 text-center">
                              <CreditCard className="h-6 w-6 text-slate-200" />
                              <p className="mt-2 text-[11px] font-medium text-slate-400">No payments recorded yet</p>
                              <p className="text-[10px] text-slate-300">Payments will appear here once added</p>
                            </div>
                          ) : (
                            <div className="overflow-hidden rounded-xl border border-slate-100">
                              <table className="min-w-full border-collapse text-[11px]">
                                <thead>
                                  <tr className="bg-slate-50">
                                    <th className="border-b border-slate-100 px-3 py-2 text-left font-semibold text-slate-500">#</th>
                                    <th className="border-b border-slate-100 px-3 py-2 text-left font-semibold text-slate-500">Date</th>
                                    <th className="border-b border-slate-100 px-3 py-2 text-left font-semibold text-slate-500">Method</th>
                                    <th className="border-b border-slate-100 px-3 py-2 text-left font-semibold text-slate-500">Ref.</th>
                                    <th className="border-b border-slate-100 px-3 py-2 text-right font-semibold text-slate-500">Amount</th>
                                    <th className="border-b border-slate-100 px-2 py-2 text-center font-semibold text-slate-500"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {invPayments.map((p: any, idx: number) => (
                                    <tr key={p.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"} hover:bg-emerald-50/30`}>
                                      <td className="border-b border-slate-100 px-3 py-2 text-slate-400">{idx + 1}</td>
                                      <td className="border-b border-slate-100 px-3 py-2 text-slate-600">
                                        {p.payment_date
                                          ? new Date(p.payment_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                                          : "—"}
                                      </td>
                                      <td className="border-b border-slate-100 px-3 py-2">
                                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-600">
                                          {p.payment_method || "—"}
                                        </span>
                                      </td>
                                      <td className="max-w-[100px] truncate border-b border-slate-100 px-3 py-2 text-slate-500">{p.reference || "—"}</td>
                                      <td className="border-b border-slate-100 px-3 py-2 text-right font-bold text-emerald-600">
                                        ₹{Number(p.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                      </td>
                                      <td className="border-b border-slate-100 px-2 py-2 text-center">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={async () => {
                                            if (confirm("Delete this payment record? This cannot be undone.")) {
                                              const result = await deleteOrderPayment(p.id)
                                              if (result.success) {
                                                await loadOrderPayments()
                                                const invRes = await getOrderInvoices(orderId)
                                                if (invRes.success) setOrderInvoices(invRes.data)
                                                setSuccess("Payment record deleted.")
                                                setTimeout(() => setSuccess(null), 2000)
                                              } else {
                                                setError(result.error || "Failed to delete payment")
                                              }
                                            }
                                          }}
                                          className="h-6 w-6 rounded-md p-0 text-slate-300 hover:bg-red-50 hover:text-red-500"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-emerald-50">
                                    <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-emerald-700">Total Received</td>
                                    <td className="px-3 py-2 text-right text-xs font-bold text-emerald-700">
                                      ₹{invPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </td>
                                    <td />
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Payment Timeline (inline, only when there are events) ── */}
            {(orderInvoices.length + orderPayments.length) > 0 && (() => {
              const tlEvents = [
                ...orderInvoices.map((inv: any) => ({
                  id:        `inv-${inv.id}`,
                  isPayment: false,
                  date:      inv.invoice_date || inv.created_at || "",
                  title:     `Invoice ${inv.invoice_number}`,
                  subtitle:  inv.dispatch_id ? "Dispatch Invoice" : "Manual Invoice",
                  amount:    Number(inv.invoice_amount || 0),
                  badge:     null as string | null,
                })),
                ...orderPayments.map((p: any) => ({
                  id:        `pay-${p.id}`,
                  isPayment: true,
                  date:      p.payment_date || p.created_at || "",
                  title:     "Payment Received",
                  subtitle:  [p.payment_method, p.reference].filter(Boolean).join(" · ") || (p.notes || ""),
                  amount:    Number(p.amount || 0),
                  badge:     p.payment_method || null,
                })),
              ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

              return (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setPaymentTimelineOpen((v) => !v)}
                    className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-100">
                        <Receipt className="h-3.5 w-3.5 text-indigo-600" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-800">Payment Timeline</h3>
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
                        {tlEvents.length}
                      </span>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${paymentTimelineOpen ? "rotate-180" : ""}`} />
                  </button>

                  {paymentTimelineOpen && (
                    <div className="border-t border-slate-100 px-4 pb-4 pt-4">
                      <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-3">
                        {tlEvents.map((ev) => (
                          <div key={ev.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50">
                            <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                              ev.isPayment ? "bg-emerald-100" : "bg-indigo-100"
                            }`}>
                              {ev.isPayment
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                : <FileText className="h-3.5 w-3.5 text-indigo-600" />
                              }
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-xs font-semibold text-slate-700">{ev.title}</p>
                                <span className="shrink-0 text-[10px] text-slate-400">
                                  {ev.date ? new Date(ev.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                                </span>
                              </div>
                              {ev.subtitle && (
                                <p className="truncate text-[10px] text-slate-400">{ev.subtitle}</p>
                              )}
                              {ev.amount > 0 && (
                                <p className={`mt-0.5 text-xs font-bold ${ev.isPayment ? "text-emerald-600" : "text-indigo-600"}`}>
                                  ₹{ev.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

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

        {/* Comments Tab */}
        <TabsContent value="comments" className="mt-6">
          <div className="mx-auto max-w-[860px] px-1">
            <OrderCommentSection orderId={orderId} onCountChange={setCommentCount} />
          </div>
        </TabsContent>

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
                          Dispatch Date
                        </Label>
                        <Input
                          type="date"
                          value={dispatchDate}
                          onChange={(e) => setDispatchDate(e.target.value || new Date().toISOString().split("T")[0])}
                          disabled={dispatching}
                          className="h-10"
                        />
                        <p className="mt-1 text-xs text-gray-500">Defaults to today if not changed</p>
                      </div>

                      <div>
                        <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                          Expected Delivery Date <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          type="date"
                          value={estimatedDelivery}
                          onChange={(e) => setEstimatedDelivery(e.target.value)}
                          disabled={dispatching}
                          min={new Date().toISOString().split("T")[0]}
                          className={`h-10 ${!estimatedDelivery ? "border-red-300 focus-visible:ring-red-400" : ""}`}
                          required
                        />
                        {!estimatedDelivery && (
                          <p className="mt-1 text-xs text-red-500">Required — helps track on-time delivery</p>
                        )}
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
                      setDispatchDate(new Date().toISOString().split("T")[0])
                    }
                  }}
                  disabled={dispatching}
                  className="border-gray-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateDispatch}
                  disabled={dispatching || Object.values(dispatchQuantities).every(qty => qty === 0) || !estimatedDelivery}
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
