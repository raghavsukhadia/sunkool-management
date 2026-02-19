"use client"

import { useState, useEffect } from "react"
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
  getOrderDetails,
  getInventoryItemsForOrder,
  addItemToOrder,
  updateOrderItemQuantity,
  removeItemFromOrder,
  createDispatch,
  getOrderDispatches,
  updateDispatchStatus,
  updateOrderPayment,
  getOrderPaymentFollowups,
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
  ArrowRight,
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

  const fetchAllOrderData = async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        loadOrderDetails(),
        loadInventoryItems(),
        loadDispatches(),
        loadCourierCompanies(),
        loadProductionLists(),
        loadProductionRecords(),
        loadInvoiceAttachments(),
        loadOrderPayments()
      ])
    } catch (err: any) {
      console.error("Parallel fetch error:", err)
      setError("Some data failed to load. Please refresh.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (orderId) {
      fetchAllOrderData()
    }
  }, [orderId])

  // Predicate used across the payment UI to determine whether payments can be recorded.
  // An order is eligible for payment recording if its status indicates dispatch OR if
  // there are existing dispatch records (handles legacy/stale status cases).
  const dispatchedStates = ['Partial Dispatch', 'Dispatched', 'Delivered']
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
  }, [order])

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

  const loadPaymentFollowups = async () => {
    try {
      const result = await getOrderPaymentFollowups(orderId)
      if (result.success && result.data) {
        setPaymentFollowups(result.data)
      }
    } catch (err: any) {
      console.error("Failed to load payment followups:", err)
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
        if (productionType === "full" || order?.order_status !== "Partial Order") {
          setProductionType("full")
          setProductionQuantities({})
        } else {
          // For partial orders, reset quantities but keep type as partial
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
      const initialQuantities: Record<string, number> = {}
      order.items.forEach(item => {
        // Calculate produced quantity up to now for this item
        const producedQty = productionRecords.reduce((sum, record) => {
          if (record.selected_quantities && record.selected_quantities[item.id]) {
            return sum + (record.selected_quantities[item.id] as number)
          }
          if (record.production_type === "full") return item.quantity
          return sum
        }, 0)

        const remainingQty = Math.max(0, item.quantity - producedQty)

        if (!productionQuantities[item.id]) {
          initialQuantities[item.id] = remainingQty // Default to remaining quantity
        }
      })
      if (Object.keys(initialQuantities).length > 0) {
        setProductionQuantities(prev => ({ ...prev, ...initialQuantities }))
      }
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

  // Get next workflow step
  const getNextWorkflowStep = () => {
    if (!order) return null

    switch (order.order_status) {
      case "Pending":
        return {
          message: "Add items to this order to proceed",
          action: null,
          color: "yellow"
        }
      case "Approved":
        return {
          message: "Order is approved and ready for production. Generate PDF for production team.",
          action: "In Production",
          color: "blue"
        }
      case "In Production":
        return {
          message: "Order is in production. Once ready, proceed to dispatch.",
          action: null,
          color: "purple"
        }
      case "Partial Dispatch":
        return {
          message: "Order is partially dispatched. Complete remaining items or mark as fully dispatched.",
          action: null,
          color: "orange"
        }
      case "Dispatched":
        return {
          message: "Order has been dispatched. Awaiting delivery confirmation.",
          action: "Delivered",
          color: "green"
        }
      case "Delivered":
        return {
          message: "Order has been delivered successfully.",
          action: null,
          color: "emerald"
        }
      default:
        return null
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
        initialQuantities[item.id] = dispatchType === "full" ? item.quantity : 0
      })
      setDispatchQuantities(initialQuantities)
    }
  }, [showDispatchModal, dispatchType, order?.items])

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

    const maxQuantity = orderItem.quantity
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

      const result = await updateOrderPayment(
        orderId,
        invoiceNumber || undefined,
        zohoDetails,
        paymentStatus,
        paymentDate || undefined,
        paymentStatus === 'partial' ? parseFloat(partialPaymentAmount) || undefined : undefined,
        paymentStatus === 'partial' ? parseFloat(remainingPaymentAmount) || undefined : undefined
      )

      if (result.success) {
        setSuccess("Payment details updated successfully!")
        await loadOrderDetails()
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

    const amount = parseFloat(paymentAmount)
    if (!amount || isNaN(amount) || amount <= 0) {
      setError("Please enter a valid payment amount")
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

  const handleUpdateFollowup = async (followupId: string, paymentReceived: boolean) => {
    try {
      const result = await updatePaymentFollowup(followupId, paymentReceived)
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
            // User wants to create return dispatch
            setError("Return dispatch feature coming soon. For now, please contact support to process the return before deleting this item.")
            // TODO: Implement return dispatch UI
            // This would open a modal/dialog to create the return dispatch
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
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Order Details</h1>
          <p className="text-gray-600 mt-1.5 text-sm">
            Order #{order.internal_order_number || order.sales_order_number || order.id.slice(0, 8)}
            {order.sales_order_number && order.internal_order_number && (
              <span className="text-gray-500 ml-2">(Sales Order: {order.sales_order_number})</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash className="w-4 h-4" />
            Delete
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

      {/* Workflow Guidance */}
      {getNextWorkflowStep() && (
        <Card className={`shadow-sm border-l-4 ${getNextWorkflowStep()?.color === "yellow" ? "border-yellow-500 bg-yellow-50" :
          getNextWorkflowStep()?.color === "blue" ? "border-blue-500 bg-blue-50" :
            getNextWorkflowStep()?.color === "purple" ? "border-purple-500 bg-purple-50" :
              getNextWorkflowStep()?.color === "orange" ? "border-orange-500 bg-orange-50" :
                getNextWorkflowStep()?.color === "green" ? "border-green-500 bg-green-50" :
                  "border-emerald-500 bg-emerald-50"
          }`}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className={`w-5 h-5 mt-0.5 ${getNextWorkflowStep()?.color === "yellow" ? "text-yellow-600" :
                getNextWorkflowStep()?.color === "blue" ? "text-blue-600" :
                  getNextWorkflowStep()?.color === "purple" ? "text-purple-600" :
                    getNextWorkflowStep()?.color === "orange" ? "text-orange-600" :
                      getNextWorkflowStep()?.color === "green" ? "text-green-600" :
                        "text-emerald-600"
                }`} />
              <div className="flex-1">
                <p className={`text-sm font-medium ${getNextWorkflowStep()?.color === "yellow" ? "text-yellow-800" :
                  getNextWorkflowStep()?.color === "blue" ? "text-blue-800" :
                    getNextWorkflowStep()?.color === "purple" ? "text-purple-800" :
                      getNextWorkflowStep()?.color === "orange" ? "text-orange-800" :
                        getNextWorkflowStep()?.color === "green" ? "text-green-800" :
                          "text-emerald-800"
                  }`}>
                  {getNextWorkflowStep()?.message}
                </p>
                {getNextWorkflowStep()?.action && (
                  <Button
                    size="sm"
                    onClick={() => handleUpdateOrderStatus(getNextWorkflowStep()!.action!)}
                    className={`mt-3 ${getNextWorkflowStep()?.color === "blue" ? "bg-blue-600 hover:bg-blue-700" :
                      getNextWorkflowStep()?.color === "green" ? "bg-green-600 hover:bg-green-700" :
                        "bg-gray-600 hover:bg-gray-700"
                      } text-white`}
                  >
                    Move to {getNextWorkflowStep()?.action}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Information - Always visible */}
      <Card className="shadow-sm">
        <CardHeader className="bg-gray-50 border-b">
          <div className="flex items-center justify-between gap-4 w-full">
            <CardTitle className="flex items-center gap-2.5 text-lg font-semibold text-gray-900">
              <div className="p-1.5 bg-blue-100 rounded-md">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              Customer Information
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 bg-white text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 shadow-sm transition-all"
              onClick={handleDownloadLatestTrackingSlip}
              disabled={generatingTrackingSlip !== null}
            >
              {generatingTrackingSlip !== null ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Tracking Slip</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold text-gray-500 uppercase">Customer Name</Label>
              <p className="text-sm font-medium text-gray-900 mt-1">{order.customers?.name || "-"}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-gray-500 uppercase">Email</Label>
                <p className="text-sm text-gray-600 mt-1">{order.customers?.email || "-"}</p>
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-500 uppercase">Phone</Label>
                <p className="text-sm text-gray-600 mt-1">{order.customers?.phone || "-"}</p>
              </div>
            </div>
            {order.customers?.address && (
              <div>
                <Label className="text-xs font-semibold text-gray-500 uppercase">Address</Label>
                <p className="text-sm text-gray-600 mt-1">{order.customers.address}</p>
              </div>
            )}
            <div className="pt-3 border-t">
              <div className="flex items-center gap-4">
                <div>
                  <Label className="text-xs font-semibold text-gray-500 uppercase">Order Status</Label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{order.order_status}</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-500 uppercase">Payment Status</Label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{order.payment_status}</p>
                </div>
                {order.cash_discount && (
                  <div className="ml-auto">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Cash Discount Applied
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full" style={{ gridTemplateColumns: order.cash_discount ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)' }}>
          <TabsTrigger value="items">
            <Package className="w-4 h-4 mr-2" />
            Items
          </TabsTrigger>
          <TabsTrigger value="production">
            <Factory className="w-4 h-4 mr-2" />
            Production
          </TabsTrigger>
          <TabsTrigger value="shipment">
            <Truck className="w-4 h-4 mr-2" />
            Shipment
          </TabsTrigger>
          <TabsTrigger value="payment">
            <DollarSign className="w-4 h-4 mr-2" />
            Payment
          </TabsTrigger>
          {order.cash_discount && (
            <TabsTrigger value="followup">
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
              <Card className="border-2 border-blue-100 shadow-md">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                  <CardTitle className="text-xl font-semibold text-gray-900 flex items-center">
                    <Plus className="w-5 h-5 mr-2" />
                    Add Items to Order
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Select items from inventory and specify quantities
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="md:col-span-2 relative">
                        <Label htmlFor="item-select" className="text-sm font-semibold text-gray-700 mb-2 block">
                          Select Item <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-left ring-offset-background placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span className={selectedItem ? "text-gray-900" : "text-gray-500"}>
                              {getSelectedItemName()}
                            </span>
                            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
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
                                      placeholder="Type to search items..."
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

                                {/* Items List */}
                                <div className="overflow-y-auto flex-1">
                                  {filteredItems.length === 0 ? (
                                    <div className="px-3 py-4 text-sm text-gray-500 text-center">
                                      No items found matching "{searchTerm}"
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
                                              className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 transition-colors ${selectedItem === item.id ? "bg-blue-100" : ""
                                                }`}
                                              onClick={() => handleItemSelect(item.id)}
                                            >
                                              <div className="flex items-center justify-between">
                                                <span className="font-medium text-gray-900">
                                                  #{item.sr_no} - {item.item_name}
                                                </span>
                                                {item.sub_items && item.sub_items.length > 0 && (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      toggleItemExpansion(item.id)
                                                    }}
                                                    className="p-1 hover:bg-blue-200 rounded transition-colors"
                                                  >
                                                    {expandedItems.has(item.id) ? (
                                                      <ChevronDown className="w-4 h-4 text-gray-600" />
                                                    ) : (
                                                      <ChevronRight className="w-4 h-4 text-gray-600" />
                                                    )}
                                                  </button>
                                                )}
                                              </div>
                                            </div>

                                            {/* Sub-items */}
                                            {item.sub_items && item.sub_items.length > 0 && expandedItems.has(item.id) && (
                                              <div className="bg-gray-50 border-l-2 border-blue-300">
                                                {filteredSubItems && filteredSubItems.length > 0 ? (
                                                  filteredSubItems.map((subItem) => (
                                                    <div
                                                      key={subItem.id}
                                                      className={`px-6 py-2 text-sm cursor-pointer hover:bg-blue-50 transition-colors ${selectedItem === subItem.id ? "bg-blue-100" : ""
                                                        }`}
                                                      onClick={() => handleItemSelect(subItem.id)}
                                                    >
                                                      <div className="flex items-center gap-2">
                                                        <span className="text-gray-400">└─</span>
                                                        <span className="text-gray-700">
                                                          {subItem.item_name}
                                                        </span>
                                                        <span className="text-xs text-gray-500 ml-auto">
                                                          Sub Item
                                                        </span>
                                                      </div>
                                                    </div>
                                                  ))
                                                ) : (
                                                  searchTerm && (
                                                    <div className="px-6 py-2 text-xs text-gray-400">
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
                        <Label htmlFor="quantity" className="text-sm font-semibold text-gray-700 mb-2 block">
                          Quantity <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="quantity"
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                          className="h-10"
                          placeholder="Enter quantity"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleAddItem}
                      disabled={addingItem || !selectedItem || quantity <= 0}
                      className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {addingItem ? (
                        <>
                          <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
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
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Order Items */}
            <div className="space-y-6">
              <Card className="shadow-sm">
                <CardHeader className="bg-gray-50 border-b">
                  <CardTitle className="flex items-center gap-2.5 text-lg font-semibold text-gray-900">
                    <div className="p-1.5 bg-blue-100 rounded-md">
                      <Package className="w-4 h-4 text-blue-600" />
                    </div>
                    Order Items
                    <span className="text-sm font-normal text-gray-500 ml-1">
                      ({order.items?.length || 0})
                    </span>
                  </CardTitle>
                  <CardDescription className="mt-1.5">Items added to this order</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {!order.items || order.items.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No items added yet</p>
                      <p className="text-sm text-gray-400 mt-1">Add items using the form above</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b bg-gray-50/50">
                            <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Sr No</th>
                            <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Item Name</th>
                            <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Quantity</th>
                            <th className="text-left p-4 font-semibold text-xs text-gray-700 uppercase tracking-wider">Actions</th>
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

                            // For sub-items, show parent's serial number; for parent items, show their serial number
                            const displaySrNo = subItem
                              ? inventoryItem?.sr_no || null
                              : inventoryItem?.sr_no || index + 1

                            return (
                              <tr key={item.id} className="border-b hover:bg-blue-50/30 transition-colors">
                                <td className="p-4">
                                  <span className="text-sm font-medium text-gray-900">
                                    {displaySrNo || "-"}
                                  </span>
                                </td>
                                <td className="p-4">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium text-gray-900">
                                      {displayName}
                                    </span>
                                    {subItem && (
                                      <span className="text-xs text-gray-500 mt-0.5">Sub Item</span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => {
                                        const newQty = parseInt(e.target.value) || 1
                                        handleUpdateQuantity(item.id, newQty)
                                      }}
                                      className="w-20 h-8 text-sm"
                                    />
                                  </div>
                                </td>
                                <td className="p-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                                    title="Remove item"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Production Tab */}
        <TabsContent value="production" className="space-y-6 mt-6">
          {/* Production Management Card */}
          <Card className="shadow-sm">
            <CardHeader className="bg-gray-50 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 py-4">
              <div>
                <CardTitle className="flex items-center gap-2.5 text-lg font-semibold text-gray-900">
                  <Factory className="w-5 h-5 text-blue-600" />
                  Production Management
                </CardTitle>
                <CardDescription className="mt-1">
                  Manage items ready for production and generate checklists
                </CardDescription>
              </div>

              {/* Order Type Toggle - Hidden if Full Order already exists */}
              {!(productionRecords.length > 0 && productionRecords[0]?.production_type === "full") && (
                <div className="flex bg-white p-1 rounded-lg border border-gray-200 self-start md:self-center shadow-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setProductionType("full")
                      setProductionQuantities({})
                    }}
                    disabled={productionRecords.length > 0}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${productionType === "full"
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent"
                      }`}
                  >
                    Full Order
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductionType("partial")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${productionType === "partial"
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    Partial Order
                  </button>
                </div>
              )}
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item Details</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Ordered</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Produced</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Remaining</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">To Produce</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {!order?.items || order.items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                          <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
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
                          <tr key={item.id} className="hover:bg-blue-50/20 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                {srNo && (
                                  <span className="text-xs font-bold text-gray-400 bg-gray-100 w-6 h-6 rounded flex items-center justify-center flex-shrink-0">
                                    {srNo}
                                  </span>
                                )}
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-gray-900">{displayName}</span>
                                  {subItem && <span className="text-[10px] text-blue-600 font-semibold uppercase tracking-tight">Sub-Item</span>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-center font-medium text-gray-600">{item.quantity}</td>
                            <td className="px-4 py-4 text-sm text-center font-medium text-gray-600">{producedQty}</td>
                            <td className="px-4 py-4 text-center">
                              {isComplete ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                                  <Check className="w-3 h-3" /> Complete
                                </span>
                              ) : (
                                <span className="text-sm font-bold text-orange-600">{remainingQty}</span>
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
                                className={`w-24 h-9 text-center font-semibold mx-auto transition-all ${productionType === "full"
                                  ? "bg-blue-50/50 border-blue-200 text-blue-700"
                                  : "bg-white border-gray-200"
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
              <div className="p-4 bg-gray-50 border-t flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2 text-xs text-gray-500 italic">
                  {productionRecords.length > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-md border shadow-sm">
                      <AlertCircle className="w-3.5 h-3.5 text-blue-500" />
                      <span>
                        Order Type fixed to <strong>{productionRecords[0].production_type === "full" ? "Full" : "Partial"}</strong> due to existing records.
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleCreateProductionRecord}
                    disabled={
                      !order?.items ||
                      order.items.length === 0 ||
                      order.order_status === "Cancelled" ||
                      creatingRecord ||
                      (productionType === "partial" && Object.values(productionQuantities).every(qty => qty === 0)) ||
                      (productionRecords.length > 0 && productionRecords[0]?.production_type === "full")
                    }
                    className="bg-blue-600 hover:bg-blue-700 text-white min-w-[180px] shadow-sm"
                  >
                    {creatingRecord ? (
                      <>
                        <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                        Generating PDF...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        Create Production Record
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Existing Production Records History */}
          {productionRecords.length > 0 && (
            <Card className="shadow-sm border-gray-200 overflow-hidden">
              <CardHeader className="bg-white border-b py-4">
                <CardTitle className="text-md font-semibold text-gray-800 flex items-center gap-2">
                  <File className="w-4 h-4 text-gray-400" />
                  Production History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50/50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">ID</th>
                        <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type</th>
                        <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                        <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Created</th>
                        <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Document</th>
                        <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest w-40">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {productionRecords.slice().reverse().map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-900">{record.production_number}</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {record.selected_quantities && Object.entries(record.selected_quantities).map(([itemId, qty]) => {
                                  const item = order?.items.find(i => i.id === itemId)
                                  if (!item || (qty as number) <= 0) return null

                                  // Find display name
                                  let invItem = inventoryItems.find(inv => inv.id === item.inventory_item_id || inv.id === item.product_id)
                                  let subI: SubItem | undefined
                                  if (!invItem) {
                                    for (const p of inventoryItems) {
                                      subI = p.sub_items?.find(s => s.id === item.inventory_item_id || s.id === item.product_id)
                                      if (subI) { invItem = p; break; }
                                    }
                                  }
                                  const name = subI ? subI.item_name : (invItem?.item_name || "Item")

                                  return (
                                    <span key={itemId} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                                      {name}: <span className="font-bold">{qty as number}</span>
                                    </span>
                                  )
                                })}
                                {record.production_type === "full" && (
                                  <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 italic">
                                    All items produced
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${record.production_type === "full"
                              ? "bg-indigo-50 text-indigo-700"
                              : "bg-orange-50 text-orange-700"
                              }`}>
                              {record.production_type}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${record.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : record.status === "in_production"
                                ? "bg-amber-100 text-amber-700 animate-pulse"
                                : "bg-gray-100 text-gray-600"
                              }`}>
                              {record.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center text-xs text-gray-500">
                            {new Date(record.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-4 text-center">
                            {record.pdf_file_url ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(record.pdf_file_url, '_blank')}
                                className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 transition-all"
                              >
                                <FileDown className="w-3.5 h-3.5 mr-1.5" />
                                View PDF
                              </Button>
                            ) : (
                              <span className="text-xs text-gray-300">No PDF</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {record.status === "pending" && (
                                <Button
                                  variant="outline"
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
                                  className="h-7 text-[10px] font-bold border-blue-200 text-blue-600 hover:bg-blue-50 uppercase"
                                >
                                  Start
                                </Button>
                              )}
                              {record.status === "in_production" && (
                                <Button
                                  variant="outline"
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
                                  className="h-7 text-[10px] font-bold border-green-200 text-green-700 bg-green-50 hover:bg-green-100 uppercase"
                                >
                                  Done
                                </Button>
                              )}
                              {(record.status === "pending" || record.status === "in_production") && (
                                <Button
                                  variant="ghost"
                                  size="sm"
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
                                  className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
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
                  <p className="text-sm text-gray-400 mt-1">Use the "Create Dispatch" button above to create a dispatch for a production record</p>
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
                                  className="h-8 py-0 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 gap-1.5"
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
                                className={`w-full h-10 px-4 border-2 rounded-lg font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${shipmentStatus === 'ready' ? 'border-yellow-300 bg-yellow-50 text-yellow-800' :
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
                      className="w-full h-10 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
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
          <div className="max-w-[1200px] mx-auto px-6 space-y-6">
            {/* Payment Overview - Always visible at top */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="shadow-sm border border-gray-200">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Order Total</p>
                  <p className="text-xl font-bold text-gray-900">₹{(order?.total_price ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm border border-gray-200">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Paid</p>
                  <p className="text-xl font-bold text-green-600">
                    ₹{orderPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-sm border border-gray-200">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Amount Due</p>
                  <p className="text-xl font-bold text-orange-600">
                    ₹{Math.max(0, (order?.total_price ?? 0) - orderPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-sm border border-gray-200">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Payment Status</p>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${paymentStatus === 'complete'
                    ? "bg-green-100 text-green-700"
                    : paymentStatus === 'partial'
                      ? "bg-blue-100 text-blue-700"
                      : "bg-amber-100 text-amber-700"
                    }`}>
                    {paymentStatus === 'complete' ? 'Paid' : paymentStatus === 'partial' ? 'Partial' : 'Pending'}
                  </span>
                </CardContent>
              </Card>
            </div>

            {/* Dispatch Required Alert - show only when order has no dispatch records */}
            {!canRecordPayment && (
              <Card className="shadow-sm border-2 border-red-200 bg-red-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="text-sm font-semibold text-red-900 mb-1">Payment Recording Not Available</h3>
                      <p className="text-sm text-red-800">
                        Orders must be dispatched before adding payment records. Current order status: <strong>{order?.order_status || 'Pending'}</strong>. Complete production and create a dispatch in the <strong>Shipment</strong> tab first.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cash Discount Alert */}
            {order.cash_discount && (
              <Card className="shadow-sm border border-amber-200 bg-amber-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-amber-900 mb-1">
                        Cash Discount Applied
                      </h3>
                      <p className="text-sm text-amber-800">
                        Track payment followup in the <strong>Payment Followup</strong> tab. Payment reminders will be generated automatically.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Invoice + Payment Flow */}
            <Card className="shadow-sm border border-gray-200">
              <CardHeader className="bg-gray-50 border-b border-gray-200 pb-4">
                <CardTitle className="flex items-center gap-2.5 text-xl font-semibold text-gray-900 mb-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Payment
                </CardTitle>
                <CardDescription className="text-sm text-gray-600">
                  Step-by-step flow: Invoice Number → Attachments → Payment Record
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  {/* Step 1: Invoice Number */}
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <Label className="text-sm font-semibold text-gray-700">
                        1) Invoice Number
                      </Label>
                      <span className="text-xs text-gray-500">Required before recording payment</span>
                    </div>
                    <div className="flex gap-3 items-start">
                      <Input
                        type="text"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="Enter invoice number or generate from dispatch"
                        className="flex-1 h-10"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const baseOrderNumber = order?.internal_order_number || 'ORD'
                          const generatedInvoice = `INV-${baseOrderNumber}`
                          setInvoiceNumber(generatedInvoice)
                        }}
                        className="h-10 whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4 mr-1.5" />
                        Regenerate
                      </Button>
                      <Button
                        type="button"
                        onClick={async () => {
                          // Save invoice number only (no payment status update)
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
                        className="h-10 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Check className="w-4 h-4 mr-1.5" />
                        Save
                      </Button>
                    </div>
                    {!invoiceNumber && (
                      <p className="text-xs text-gray-500 mt-2">
                        Invoice number will be generated automatically once production is completed.
                      </p>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-gray-200"></div>

                  {/* Production Records */}
                  {productionRecords && productionRecords.length > 0 && (
                    <div>
                      <Label className="text-sm font-semibold text-gray-700 mb-3 block">
                        Production Records
                      </Label>
                      <div className="space-y-2">
                        {productionRecords.map((record: any) => (
                          <div key={record.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-semibold text-gray-900">{record.production_number}</span>
                                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                  {record.production_type === "full" ? "Full" : "Partial"}
                                </span>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${record.status === "completed"
                                  ? "bg-green-100 text-green-700"
                                  : record.status === "in_production"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-gray-100 text-gray-700"
                                  }`}>
                                  {record.status === "completed" ? "Completed" : record.status === "in_production" ? "In Production" : "Pending"}
                                </span>
                              </div>
                              {record.pdf_file_url && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(record.pdf_file_url, '_blank')}
                                  className="h-8 text-xs"
                                >
                                  <File className="w-3 h-3 mr-1" />
                                  View PDF
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dispatch Records */}
                  {dispatches && dispatches.length > 0 && (
                    <div>
                      <Label className="text-sm font-semibold text-gray-700 mb-3 block">
                        Dispatch Records
                      </Label>
                      <div className="space-y-2">
                        {dispatches.map((dispatch: any) => (
                          <div key={dispatch.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-gray-900">
                                  {dispatch.dispatch_type === "full" ? "Full" : "Partial"} Dispatch
                                </span>
                                <span className="text-xs text-gray-500">
                                  {new Date(dispatch.dispatch_date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </span>
                                {dispatch.production_records && (
                                  <span className="text-xs text-gray-600">
                                    Prod: {dispatch.production_records.production_number}
                                  </span>
                                )}
                              </div>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${dispatch.shipment_status === 'delivered'
                                ? "bg-green-100 text-green-700"
                                : dispatch.shipment_status === 'picked_up'
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-yellow-100 text-yellow-700"
                                }`}>
                                {dispatch.shipment_status === 'delivered' ? 'Delivered' : dispatch.shipment_status === 'picked_up' ? 'Picked Up' : 'Ready'}
                              </span>
                            </div>
                            {dispatch.courier_companies && (
                              <div className="text-xs text-gray-600">
                                Courier: {dispatch.courier_companies.name}
                                {dispatch.tracking_id && ` • Tracking: ${dispatch.tracking_id}`}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Divider */}
                  {(productionRecords && productionRecords.length > 0) || (dispatches && dispatches.length > 0) ? (
                    <div className="h-px bg-gray-200"></div>
                  ) : null}

                  {/* Step 2: Invoice Attachments */}
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <Label className="text-sm font-semibold text-gray-700">
                        2) Invoice Attachments
                      </Label>
                      <span className="text-xs text-gray-500">Upload invoice PDF/JPG/PNG</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
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
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const input = document.getElementById("invoice-attachment-input") as HTMLInputElement | null
                            input?.click()
                          }}
                          disabled={uploadingInvoiceAttachment}
                          className="h-10"
                        >
                          {uploadingInvoiceAttachment ? (
                            <>
                              <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></span>
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              Upload Attachment
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-gray-500">Accepted: PDF, JPG, PNG</p>
                      </div>

                      {invoiceAttachments.length === 0 ? (
                        <div className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-4">
                          No attachments uploaded yet.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {invoiceAttachments.map((attachment) => (
                            <div
                              key={attachment.id}
                              className="flex flex-wrap items-center justify-between gap-3 p-3 border border-gray-200 rounded-lg bg-white"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-md bg-blue-50 text-blue-600">
                                  <File className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{attachment.file_name}</p>
                                  <p className="text-xs text-gray-500">
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
                                  onClick={() => window.open(attachment.file_url, '_blank')}
                                  className="h-8 text-xs"
                                >
                                  <Download className="w-3 h-3 mr-1" />
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
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 3: Add Payment Record */}
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <Label className="text-sm font-semibold text-gray-700">
                        3) Add Payment in Record
                      </Label>
                      <span className="text-xs text-gray-500">Adds an entry to payment history</span>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs font-semibold text-gray-600">Amount (₹) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            placeholder="e.g. 25000"
                            className="h-10"
                            disabled={!invoiceNumber || !canRecordPayment || addingPayment}
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-gray-600">Payment Date</Label>
                          <Input
                            type="date"
                            value={paymentDate || new Date().toISOString().split('T')[0]}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className="h-10"
                            disabled={!invoiceNumber || !canRecordPayment || addingPayment}
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-gray-600">Method</Label>
                          <Select
                            value={paymentMethod || "cash"}
                            onValueChange={setPaymentMethod}
                            disabled={!invoiceNumber || !canRecordPayment || addingPayment}
                          >
                            <SelectTrigger className="h-10">
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs font-semibold text-gray-600">Reference</Label>
                          <Input
                            type="text"
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder="Txn / Cheque / Ref no."
                            className="h-10"
                            disabled={!invoiceNumber || !canRecordPayment || addingPayment}
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-gray-600">Notes</Label>
                          <Input
                            type="text"
                            value={paymentNotes}
                            onChange={(e) => setPaymentNotes(e.target.value)}
                            placeholder="Any notes"
                            className="h-10"
                            disabled={!invoiceNumber || !canRecordPayment || addingPayment}
                          />
                        </div>
                      </div>

                      {!invoiceNumber && (
                        <p className="text-xs text-amber-700">
                          Please set an invoice number first.
                        </p>
                      )}

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          onClick={handleAddPaymentRecord}
                          disabled={!invoiceNumber || !canRecordPayment || addingPayment}
                          className="bg-green-600 hover:bg-green-700 text-white h-10 px-6"
                        >
                          {addingPayment ? (
                            <>
                              <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                              Adding...
                            </>
                          ) : (
                            <>
                              <DollarSign className="w-4 h-4 mr-2" />
                              Add Payment
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Payment History */}
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <Label className="text-sm font-semibold text-gray-700">Payment History</Label>
                      {loadingPayments ? (
                        <span className="text-xs text-gray-500">Loading...</span>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={loadOrderPayments}
                          disabled={loadingPayments}
                          className="h-8 text-xs"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingPayments ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                      )}
                    </div>

                    {orderPayments.length === 0 ? (
                      <div className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-4">
                        No payments recorded yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {orderPayments.map((p) => (
                          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3 border border-gray-200 rounded-lg bg-white hover:bg-gray-50/50">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-base font-semibold text-gray-900">₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                <span className="text-xs text-gray-500">• {p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '-'}</span>
                                {p.payment_method && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-semibold uppercase tracking-wide">
                                    {p.payment_method}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-600">
                                {p.reference ? `Ref: ${p.reference}` : ""}
                                {p.reference && p.notes ? " • " : ""}
                                {p.notes || ""}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
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
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                title="Delete payment"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {(!productionRecords || productionRecords.length === 0) && (!dispatches || dispatches.length === 0) && (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      No production or dispatch records found. Create production records and dispatches to generate invoice.
                    </div>
                  )}

                  {/* Optional: keep existing status updater as “Summary” */}
                  {invoiceNumber && (
                    <>
                      <div className="h-px bg-gray-200"></div>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="text-xs text-gray-500">
                          Optional: Update overall order payment status (Pending / Partial / Paid).
                        </div>
                        <Button
                          onClick={handleUpdatePayment}
                          className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-6"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Update Order Payment Status
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Payment Summary - Always visible */}
            <Card className="shadow-sm border border-gray-200">
              <CardHeader className="bg-gray-50 border-b border-gray-200 pb-4">
                <CardTitle className="flex items-center gap-2.5 text-xl font-semibold text-gray-900 mb-2">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  Payment Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <Label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
                        Invoice Number
                      </Label>
                      <p className="text-base font-semibold text-gray-900">{invoiceNumber || '—'}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <Label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
                        Payment Status
                      </Label>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${paymentStatus === 'complete'
                        ? "bg-green-100 text-green-700"
                        : paymentStatus === 'partial'
                          ? "bg-blue-100 text-blue-700"
                          : "bg-yellow-100 text-yellow-700"
                        }`}>
                        {paymentStatus === 'complete' ? 'Paid' : paymentStatus === 'partial' ? 'Partial' : 'Pending'}
                      </span>
                    </div>
                    {paymentStatus === 'partial' && partialPaymentAmount && remainingPaymentAmount && (
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <Label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
                          Partial Payment Details
                        </Label>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <div>
                            <p className="text-xs text-gray-600">Amount Paid</p>
                            <p className="text-base font-semibold text-gray-900">₹{parseFloat(partialPaymentAmount).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Remaining</p>
                            <p className="text-base font-semibold text-orange-600">₹{parseFloat(remainingPaymentAmount).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {(paymentStatus === 'complete' || paymentStatus === 'partial') && paymentDate && (
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <Label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
                          Payment Date
                        </Label>
                        <p className="text-base font-semibold text-gray-900">
                          {new Date(paymentDate).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                  {zohoBillingDetails && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <Label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                        ZOHO Billing Details
                      </Label>
                      <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-words">
                        {typeof zohoBillingDetails === 'string' ? zohoBillingDetails : JSON.stringify(zohoBillingDetails, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Payment Followup Tab */}
        {order.cash_discount && (
          <TabsContent value="followup" className="space-y-6 mt-6">
            <Card className="shadow-sm">
              <CardHeader className="bg-gray-50 border-b">
                <CardTitle className="flex items-center gap-2.5 text-lg font-semibold text-gray-900">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Payment Followup (14 Days)
                </CardTitle>
                <CardDescription className="mt-1">
                  Track payment followups for this order
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {paymentFollowups.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No followup records found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {paymentFollowups.map((followup) => (
                      <div
                        key={followup.id}
                        className={`p-4 border rounded-lg ${followup.payment_received
                          ? "bg-green-50 border-green-200"
                          : new Date(followup.followup_date) < new Date()
                            ? "bg-red-50 border-red-200"
                            : "bg-gray-50 border-gray-200"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-gray-900">
                                {new Date(followup.followup_date).toLocaleDateString()}
                              </span>
                              {followup.payment_received ? (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Paid
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  Pending
                                </span>
                              )}
                            </div>
                            {followup.payment_date && (
                              <p className="text-xs text-gray-600 mt-1">
                                Payment Date: {new Date(followup.payment_date).toLocaleDateString()}
                              </p>
                            )}
                            {followup.notes && (
                              <p className="text-sm text-gray-600 mt-1">{followup.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateFollowup(followup.id, !followup.payment_received)}
                              className={followup.payment_received ? "border-green-300 text-green-700" : ""}
                            >
                              {followup.payment_received ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 mr-1" />
                                  Mark Unpaid
                                </>
                              ) : (
                                <>
                                  <Check className="w-4 h-4 mr-1" />
                                  Mark Paid
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
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
                        const alreadyDispatched = dispatches.reduce((sum, d) => {
                          const dispatchQtyForItem = d.dispatch_items?.reduce((itemSum: number, di: any) => {
                            return di.order_items?.id === item.id ? itemSum + di.quantity : itemSum
                          }, 0) || 0
                          return sum + dispatchQtyForItem
                        }, 0)

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
                          className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="bg-blue-600 hover:bg-blue-700 text-white"
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
                      className="bg-blue-600 hover:bg-blue-700 text-white"
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

