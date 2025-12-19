import jsPDF from 'jspdf'

// --- Types ---

export interface OrderItem {
  id: string
  quantity: number
  unit_price: number
  subtotal: number
  inventory_item_id?: string | null
  product_id?: string | null
  inventory_item?: {
    sr_no: number | null
    item_name: string
    sku?: string
    bin_location?: string
    sub_items?: Array<{
      id: string
      item_name: string
      quantity_needed?: number // How many needed per parent
    }>
  }
}

export interface Customer {
  name: string
  email: string | null
  phone: string | null
  address: string | null
  contact_person?: string | null
}

export interface Order {
  id: string
  internal_order_number: string | null
  sales_order_number: string | null
  order_status: string
  total_price: number
  created_at: string
  customers: Customer
  items: OrderItem[]
}

export interface InventoryItem {
  id: string
  sr_no: number | null
  item_name: string
  sub_items?: Array<{
    id: string
    item_name: string
  }>
}

interface PdfOptions {
  logoDataUrl?: string // base64 PNG/JPG data URL for the Sunkool logo
  logoFormat?: 'PNG' | 'JPG' | 'JPEG'
  filenamePrefix?: string // e.g. "Production_Checklist_"
}

// --- Main Generator Function ---

export function generateProductionChecklistPDF(
  order: Order,
  inventoryItems: InventoryItem[] = [],
  options: PdfOptions = {},
  selectedQuantities?: Record<string, number>, // For partial production
  productionRecordNumber?: string // Production record number (SK01A, SK01B, etc.)
): { blob: Blob; filename: string } {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
  
  // --- Constants & Colors ---
  const COLORS = {
    ORANGE: [245, 158, 36] as [number, number, number],
    BLUE: [74, 144, 226] as [number, number, number],
    DARK_TEXT: [44, 62, 80] as [number, number, number],
    GRAY_TEXT: [100, 100, 100] as [number, number, number],
    LIGHT_BG: [248, 250, 252] as [number, number, number],
    BORDER: [210, 210, 210] as [number, number, number],
  }

  const MARGIN = 15
  const PAGE_WIDTH = doc.internal.pageSize.getWidth()
  const PAGE_HEIGHT = doc.internal.pageSize.getHeight()
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

  // Start a little lower so logo has breathing room
  let currentY = 22

  // Column positions (defined globally for use in addPageIfNeeded)
  // Adjusted to fit within page boundaries (210mm width, 15mm margins = 180mm content)
  const xIndex = MARGIN + 2          // # column: 17mm (narrow)
  const xDesc = MARGIN + 10          // Description: 25mm to 100mm (75mm width)
  const xOrdered = 100               // Ordered QTY: centered at 100mm (90-110mm range)
  const xPacking = 130               // Packing QTY: centered at 130mm (120-140mm range)
  const xCheck = 160                 // CHECK: centered at 160mm (152.5-167.5mm range)

  // --- Helpers ---
  const addPageIfNeeded = (rowHeight: number) => {
    if (currentY + rowHeight > PAGE_HEIGHT - 30) {
      doc.addPage()
      currentY = 22
      drawHeader()
      currentY += 8
      drawTitleBar()
      currentY += 12
      // Redraw table header on new page
      const headerHeight = 8
      doc.setFillColor(COLORS.LIGHT_BG[0], COLORS.LIGHT_BG[1], COLORS.LIGHT_BG[2])
      doc.setDrawColor(COLORS.BORDER[0], COLORS.BORDER[1], COLORS.BORDER[2])
      doc.rect(MARGIN, currentY, CONTENT_WIDTH, headerHeight, 'FD')
      
      // Column dividers
      const colDivider1 = xDesc - 3
      const colDivider2 = xOrdered - 12
      const colDivider3 = xPacking - 12
      const colDivider4 = xCheck - 10
      doc.setDrawColor(COLORS.BORDER[0], COLORS.BORDER[1], COLORS.BORDER[2])
      doc.setLineWidth(0.2)
      doc.line(colDivider1, currentY, colDivider1, currentY + headerHeight)
      doc.line(colDivider2, currentY, colDivider2, currentY + headerHeight)
      doc.line(colDivider3, currentY, colDivider3, currentY + headerHeight)
      doc.line(colDivider4, currentY, colDivider4, currentY + headerHeight)
      
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(COLORS.GRAY_TEXT[0], COLORS.GRAY_TEXT[1], COLORS.GRAY_TEXT[2])
      doc.text('#', xIndex, currentY + 5.5)
      doc.text('PRODUCT / DESCRIPTION', xDesc, currentY + 5.5)
      doc.text('ORDERED QTY', xOrdered, currentY + 5.5, { align: 'center' })
      doc.text('PACKING QTY', xPacking, currentY + 5.5, { align: 'center' })
      doc.text('CHECK', xCheck, currentY + 5.5, { align: 'center' })
      currentY += headerHeight + 2
    }
  }

  const drawLine = (y: number, color = COLORS.BORDER, width = 0.4) => {
    doc.setDrawColor(color[0], color[1], color[2])
    doc.setLineWidth(width)
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
  }

  const drawCheckbox = (x: number, y: number, size = 5) => {
    doc.setDrawColor(100, 100, 100)
    doc.setLineWidth(0.4)
    // Draw a perfect square checkbox, centered at the given position
    doc.rect(x - size / 2, y - size / 2, size, size, 'S')
  }

  /**
   * Professional-looking fake barcode (consistent, not random):
   * - Light grey frame
   * - Evenly spaced vertical black bars
   * - Order reference text below (e.g. *SK01*)
   * @param label - Optional label for barcode (defaults to order number)
   */
  const drawBarcode = (x: number, y: number, w: number, h: number, label?: string) => {
    // Outer frame
    doc.setDrawColor(COLORS.BORDER[0], COLORS.BORDER[1], COLORS.BORDER[2])
    doc.setLineWidth(0.4)
    doc.setFillColor(255, 255, 255)
    doc.rect(x - 2, y - 2, w + 4, h + 4, 'FD')

    // Bars
    const barcodeLabel = (label || order.internal_order_number || 'ORD-REF').toUpperCase()
    const patternSource = barcodeLabel.replace(/[^A-Z0-9]/g, '') || 'SKOOL'

    doc.setFillColor(0, 0, 0)
    let cursorX = x + 1 // small left padding inside frame

    for (let i = 0; cursorX < x + w - 1; i++) {
      const chCode = patternSource.charCodeAt(i % patternSource.length)
      // Narrow or wide bar based on char code
      const isWide = chCode % 3 === 0
      const barWidth = isWide ? 0.8 : 0.4
      const gapWidth = 0.4

      // Draw bar
      doc.rect(cursorX, y, barWidth, h, 'F')
      cursorX += barWidth + gapWidth
    }

    // Human-readable code below
    doc.setFontSize(7)
    doc.setTextColor(0, 0, 0)
    doc.text(`*${barcodeLabel}*`, x + w / 2, y + h + 5, { align: 'center' })
  }

  // --- HEADER (LOGO + COMPANY INFO) ---
  const drawHeader = () => {
    // Left: Sunkool logo image if provided, otherwise text logo
    if (options.logoDataUrl) {
      const format = options.logoFormat || 'PNG'
      // Professional logo sizing - larger and better positioned
      const logoWidth = 40
      const logoHeight = 14
      const logoY = currentY - 8 // Better vertical alignment
      doc.addImage(options.logoDataUrl, format, MARGIN, logoY, logoWidth, logoHeight)
    } else {
      // Fallback text logo - improved positioning
      doc.setFont('helvetica', 'bolditalic')
      doc.setFontSize(28)
      doc.setTextColor(COLORS.ORANGE[0], COLORS.ORANGE[1], COLORS.ORANGE[2])
      doc.text('Sun', MARGIN, currentY + 3)
      const sunWidth = doc.getTextWidth('Sun')
      doc.setTextColor(COLORS.BLUE[0], COLORS.BLUE[1], COLORS.BLUE[2])
      doc.text('kool', MARGIN + sunWidth - 1, currentY + 3)
    }

    // Right: company details
    const headerBaseY = currentY - 3 // align text block slightly higher

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(COLORS.DARK_TEXT[0], COLORS.DARK_TEXT[1], COLORS.DARK_TEXT[2])
    doc.text('SUN KOOL SOLUTION', PAGE_WIDTH - MARGIN, headerBaseY, { align: 'right' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(COLORS.GRAY_TEXT[0], COLORS.GRAY_TEXT[1], COLORS.GRAY_TEXT[2])
    doc.text('1st Floor, Mayfair Apartment, Near All India Reporter,', PAGE_WIDTH - MARGIN, headerBaseY + 4, { align: 'right' })
    doc.text('Congress Nagar, Nagpur, Maharashtra 440012', PAGE_WIDTH - MARGIN, headerBaseY + 8, { align: 'right' })
    doc.text('GSTIN: 27AWGPS9842Q1ZD', PAGE_WIDTH - MARGIN, headerBaseY + 12, { align: 'right' })

    currentY += 20
  
    // Brand-colored divider
    doc.setDrawColor(COLORS.ORANGE[0], COLORS.ORANGE[1], COLORS.ORANGE[2])
    doc.setLineWidth(1.2)
    doc.line(MARGIN, currentY, PAGE_WIDTH - MARGIN, currentY)
    currentY += 7
  }

  // --- TITLE BAR (DOCUMENT NAME + BARCODE) ---
  const drawTitleBar = () => {
    const boxHeight = 20

    // Whole block background
    doc.setFillColor(252, 252, 252)
    doc.setDrawColor(COLORS.BORDER[0], COLORS.BORDER[1], COLORS.BORDER[2])
    doc.rect(MARGIN, currentY, CONTENT_WIDTH, boxHeight, 'FD')

    // Accent strip on left
    doc.setFillColor(COLORS.BLUE[0], COLORS.BLUE[1], COLORS.BLUE[2])
    doc.rect(MARGIN, currentY, 4, boxHeight, 'F')

    // Title text
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(COLORS.BLUE[0], COLORS.BLUE[1], COLORS.BLUE[2])
    const titleText = productionRecordNumber 
      ? `PRODUCTION CHECKLIST - ${productionRecordNumber}`
      : 'PRODUCTION CHECKLIST'
    doc.text(titleText, MARGIN + 8, currentY + 9)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(COLORS.GRAY_TEXT[0], COLORS.GRAY_TEXT[1], COLORS.GRAY_TEXT[2])
    doc.text('Internal warehouse / dispatch document', MARGIN + 8, currentY + 14)

    // Barcode area on the right
    const barcodeWidth = 40
    const barcodeHeight = 9
    const barcodeX = PAGE_WIDTH - MARGIN - barcodeWidth - 4 // small right padding
    const barcodeY = currentY + 3
    const barcodeLabel = productionRecordNumber || order.internal_order_number || 'ORD-REF'

    drawBarcode(barcodeX, barcodeY, barcodeWidth, barcodeHeight, barcodeLabel)

    currentY += boxHeight + 6
  }

  // --- ORDER + CUSTOMER BLOCKS ---
  const drawOrderAndCustomerBlocks = () => {
    const boxWidth = (CONTENT_WIDTH - 5) / 2
    const boxHeight = 27

    // ORDER DETAILS
    doc.setDrawColor(COLORS.BORDER[0], COLORS.BORDER[1], COLORS.BORDER[2])
    doc.rect(MARGIN, currentY, boxWidth, boxHeight, 'S')
    doc.setFillColor(COLORS.BLUE[0], COLORS.BLUE[1], COLORS.BLUE[2])
    doc.rect(MARGIN, currentY, boxWidth, 5, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    doc.text('ORDER DETAILS', MARGIN + 3, currentY + 3.5)

    const infoY = currentY + 9
    const dateStr = new Date(order.created_at).toLocaleDateString()

    doc.setTextColor(COLORS.DARK_TEXT[0], COLORS.DARK_TEXT[1], COLORS.DARK_TEXT[2])
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('Order No:', MARGIN + 3, infoY)
    doc.setFont('helvetica', 'normal')
    doc.text(order.internal_order_number || 'N/A', MARGIN + 25, infoY)

    doc.setFont('helvetica', 'bold')
    doc.text('Sales Order:', MARGIN + 3, infoY + 5)
    doc.setFont('helvetica', 'normal')
    doc.text(order.sales_order_number || 'N/A', MARGIN + 25, infoY + 5)

    doc.setFont('helvetica', 'bold')
    doc.text('Date:', MARGIN + 3, infoY + 10)
    doc.setFont('helvetica', 'normal')
    doc.text(dateStr, MARGIN + 25, infoY + 10)

    doc.setFont('helvetica', 'bold')
    doc.text('Status:', MARGIN + 3, infoY + 15)
    doc.setTextColor(COLORS.ORANGE[0], COLORS.ORANGE[1], COLORS.ORANGE[2])
    doc.text(order.order_status.toUpperCase(), MARGIN + 25, infoY + 15)

    // CUSTOMER DETAILS (no phone/email on production copy)
    const box2X = MARGIN + boxWidth + 5
    const customer = order.customers

    doc.setDrawColor(COLORS.BORDER[0], COLORS.BORDER[1], COLORS.BORDER[2])
    doc.rect(box2X, currentY, boxWidth, boxHeight, 'S')
    doc.setFillColor(COLORS.BLUE[0], COLORS.BLUE[1], COLORS.BLUE[2])
    doc.rect(box2X, currentY, boxWidth, 5, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
    doc.text('CUSTOMER / DESTINATION', box2X + 3, currentY + 3.5)

    const customerY = currentY + 9

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(COLORS.DARK_TEXT[0], COLORS.DARK_TEXT[1], COLORS.DARK_TEXT[2])
    doc.text((customer.name || 'Customer').substring(0, 40), box2X + 3, customerY)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(COLORS.GRAY_TEXT[0], COLORS.GRAY_TEXT[1], COLORS.GRAY_TEXT[2])

    const addrLines = doc.splitTextToSize(customer.address || 'Address not provided', boxWidth - 6)
    doc.text(addrLines, box2X + 3, customerY + 4)

    if (customer.contact_person) {
      doc.text(`Attn: ${customer.contact_person}`, box2X + 3, customerY + 11)
    }

    currentY += boxHeight + 8
  }

  // --- ITEMS TABLE WITH SUB-ITEMS ---
  const drawItemsTable = () => {
    const headerHeight = 8
    
    // Table header background
    doc.setFillColor(COLORS.LIGHT_BG[0], COLORS.LIGHT_BG[1], COLORS.LIGHT_BG[2])
    doc.setDrawColor(COLORS.BORDER[0], COLORS.BORDER[1], COLORS.BORDER[2])
    doc.rect(MARGIN, currentY, CONTENT_WIDTH, headerHeight, 'FD')

    // Column divider positions (aligned with data columns)
    const colDivider1 = xDesc - 3  // Before Description
    const colDivider2 = xOrdered - 12  // Before Ordered QTY
    const colDivider3 = xPacking - 12  // Before Packing QTY
    const colDivider4 = xCheck - 10  // Before CHECK

    // Draw vertical dividers in header (subtle gray lines)
    doc.setDrawColor(COLORS.BORDER[0], COLORS.BORDER[1], COLORS.BORDER[2])
    doc.setLineWidth(0.2)
    doc.line(colDivider1, currentY, colDivider1, currentY + headerHeight)
    doc.line(colDivider2, currentY, colDivider2, currentY + headerHeight)
    doc.line(colDivider3, currentY, colDivider3, currentY + headerHeight)
    doc.line(colDivider4, currentY, colDivider4, currentY + headerHeight)

    // Header text - properly aligned
  doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(COLORS.GRAY_TEXT[0], COLORS.GRAY_TEXT[1], COLORS.GRAY_TEXT[2])

    doc.text('#', xIndex, currentY + 5.5)
    doc.text('PRODUCT / DESCRIPTION', xDesc, currentY + 5.5)
    doc.text('ORDERED QTY', xOrdered, currentY + 5.5, { align: 'center' })
    doc.text('PACKING QTY', xPacking, currentY + 5.5, { align: 'center' })
    doc.text('CHECK', xCheck, currentY + 5.5, { align: 'center' })

    currentY += headerHeight + 2

    if (!order.items || order.items.length === 0) {
      addPageIfNeeded(10)
  doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(COLORS.GRAY_TEXT[0], COLORS.GRAY_TEXT[1], COLORS.GRAY_TEXT[2])
      doc.text('No items found for this order.', MARGIN + 2, currentY + 4)
      currentY += 12
      return
    }

    const processedIds = new Set<string>()

    order.items.forEach((item, index) => {
      if (processedIds.has(item.id)) return

      const rowBaseHeight = 10
      addPageIfNeeded(rowBaseHeight + 6)

      const startY = currentY

      // Find actual inventory item by matching inventory_item_id or product_id
      let matchedInventoryItem: InventoryItem | undefined
      let matchedSubItem: { id: string; item_name: string } | undefined

      // Check if it's a parent item
      matchedInventoryItem = inventoryItems.find(inv => 
        inv.id === item.inventory_item_id || inv.id === item.product_id
      )

      // If not found as parent, check if it's a sub-item
      if (!matchedInventoryItem) {
        for (const parentItem of inventoryItems) {
          matchedSubItem = parentItem.sub_items?.find(sub => 
            sub.id === item.inventory_item_id || sub.id === item.product_id
          )
          if (matchedSubItem) {
            matchedInventoryItem = parentItem
            break
          }
        }
      }

      // Get actual item name - prefer from matched inventory item, then from order item, then fallback
      let itemName: string
      let itemSrNo: number | null = null

      if (matchedInventoryItem) {
        if (matchedSubItem) {
          // This is a sub-item, but we'll handle it separately
          itemName = matchedInventoryItem.item_name
        } else {
          // This is a parent item
          itemName = matchedInventoryItem.item_name
          itemSrNo = matchedInventoryItem.sr_no
        }
      } else if (item.inventory_item?.item_name) {
        itemName = item.inventory_item.item_name
        itemSrNo = item.inventory_item.sr_no
      } else {
        itemName = `Item #${index + 1}`
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(COLORS.DARK_TEXT[0], COLORS.DARK_TEXT[1], COLORS.DARK_TEXT[2])
      // Use serial number if available, otherwise use index - left aligned
      const displayNumber = itemSrNo !== null ? itemSrNo.toString() : (index + 1).toString()
      doc.text(displayNumber, xIndex, currentY + 4)
      // Item name - left aligned, with max width to prevent overflow
      const maxDescWidth = xOrdered - xDesc - 8 // Leave 8mm gap before Ordered QTY
      const nameLines = doc.splitTextToSize(itemName, maxDescWidth)
      doc.text(nameLines[0], xDesc, currentY + 4) // Show first line only

      // Ordered Quantity (use selected quantity for partial, or full quantity)
      const displayQuantity = selectedQuantities && selectedQuantities[item.id] !== undefined
        ? selectedQuantities[item.id]
        : item.quantity
      
  doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(COLORS.DARK_TEXT[0], COLORS.DARK_TEXT[1], COLORS.DARK_TEXT[2])
      doc.text(String(displayQuantity), xOrdered, currentY + 4, { align: 'center' })

      // Packing Quantity (input line) - centered, consistent size
      const packingLineWidth = 16 // Fixed width for consistency
      doc.setDrawColor(150, 150, 150)
      doc.setLineWidth(0.4)
      doc.line(xPacking - packingLineWidth / 2, currentY + 4, xPacking + packingLineWidth / 2, currentY + 4)

      // Checkbox - perfectly centered and square
      drawCheckbox(xCheck, currentY + 4, 5)

      currentY += rowBaseHeight

      // SUB-ITEMS - Get from matched inventory item or order item
      // Prefer sub-items from order item's inventory_item (has quantity_needed), then from matched inventory item
      const subItemsFromOrderItem = item.inventory_item?.sub_items || []
      const subItemsFromInventory = matchedInventoryItem?.sub_items || []
      
      // Combine both sources, preferring order item's sub-items
      const allSubItemsFromDef: Array<{ id: string; item_name: string; quantity_needed?: number }> = []
      
      // Add from order item first (has quantity_needed)
      subItemsFromOrderItem.forEach(sub => {
        allSubItemsFromDef.push(sub)
      })
      
      // Add from inventory if not already present
      subItemsFromInventory.forEach(sub => {
        if (!allSubItemsFromDef.some(s => s.id === sub.id)) {
          allSubItemsFromDef.push(sub)
        }
      })
      
      // Find sub-items that are also order items
      const subItemsFromOrder = order.items.filter(
        (oi) =>
          oi.inventory_item_id &&
          allSubItemsFromDef.some((sub) => sub.id === oi.inventory_item_id) &&
          !processedIds.has(oi.id)
      )

      const allSubItems: Array<{ name: string; qty: number }> = []

      // (1) From inventory definition - use actual names
      // Calculate parent quantity (use selected quantity for partial production)
      const parentQty = selectedQuantities && selectedQuantities[item.id] !== undefined
        ? selectedQuantities[item.id]
        : item.quantity
      
      allSubItemsFromDef.forEach((sub) => {
        const matchedOrderItem = subItemsFromOrder.find((oi) => oi.inventory_item_id === sub.id)
        const quantityNeeded = sub.quantity_needed || 1
        const baseQty = matchedOrderItem
          ? (selectedQuantities && selectedQuantities[matchedOrderItem.id] !== undefined
              ? selectedQuantities[matchedOrderItem.id]
              : matchedOrderItem.quantity)
          : quantityNeeded * parentQty
        // Use actual sub-item name from inventory
        allSubItems.push({ name: sub.item_name, qty: baseQty })
      })

      // (2) Additional sub-order lines not in inventory definition - try to get actual names
      subItemsFromOrder.forEach((oi) => {
        // Try to find the actual name from inventory items
        let subItemName = 'Sub item'
        
        // Check if this order item matches a sub-item in any parent
        for (const parentInv of inventoryItems) {
          const foundSub = parentInv.sub_items?.find(sub => 
            sub.id === oi.inventory_item_id || sub.id === oi.product_id
          )
          if (foundSub) {
            subItemName = foundSub.item_name
            break
          }
        }
        
        // Fallback to order item's inventory_item name if available
        if (subItemName === 'Sub item' && oi.inventory_item?.item_name) {
          subItemName = oi.inventory_item.item_name
        }
        
        if (!allSubItems.some((s) => s.name === subItemName)) {
          allSubItems.push({ name: subItemName, qty: oi.quantity })
        }
        processedIds.add(oi.id)
      })

      if (allSubItems.length > 0) {
        allSubItems.forEach((sub) => {
          addPageIfNeeded(7)
          doc.setFillColor(252, 252, 252)
          doc.rect(MARGIN + 1, currentY - 2, CONTENT_WIDTH - 2, 7, 'F')

          // Professional bullet point for sub-items - aligned
          doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
          doc.setTextColor(COLORS.GRAY_TEXT[0], COLORS.GRAY_TEXT[1], COLORS.GRAY_TEXT[2])
          doc.text('•', xDesc, currentY + 1)

          // Sub-item name - left aligned, properly indented, with max width
  doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(COLORS.DARK_TEXT[0], COLORS.DARK_TEXT[1], COLORS.DARK_TEXT[2])
          const subItemX = xDesc + 4
          const maxSubDescWidth = xOrdered - subItemX - 8 // Leave 8mm gap before Ordered QTY
          const subNameLines = doc.splitTextToSize(sub.name, maxSubDescWidth)
          doc.text(subNameLines[0], subItemX, currentY + 1) // Show first line only

          // Ordered Quantity for sub-item
          doc.setFontSize(8)
          doc.text(String(sub.qty), xOrdered, currentY + 1, { align: 'center' })

          // Packing Quantity (input line) for sub-item - centered, consistent size
          const packingLineWidth = 16 // Fixed width for consistency
          doc.setDrawColor(150, 150, 150)
          doc.setLineWidth(0.4)
          doc.line(xPacking - packingLineWidth / 2, currentY + 1, xPacking + packingLineWidth / 2, currentY + 1)

          // Checkbox - perfectly centered and square
          drawCheckbox(xCheck, currentY + 1, 5)

          currentY += 7
        })

        // No blue accent bar
      } else {
        // No blue accent bar
      }

      drawLine(currentY, COLORS.BORDER, 0.2)
      currentY += 2
      processedIds.add(item.id)
    })
  }

  // --- PACKAGING PROTOCOLS ---
  const drawPackagingSection = () => {
    const sectionHeight = 26
    addPageIfNeeded(sectionHeight + 10)

    doc.setFillColor(COLORS.LIGHT_BG[0], COLORS.LIGHT_BG[1], COLORS.LIGHT_BG[2])
    doc.setDrawColor(COLORS.BORDER[0], COLORS.BORDER[1], COLORS.BORDER[2])
    doc.rect(MARGIN, currentY, CONTENT_WIDTH, sectionHeight, 'FD')

    // Section title - properly aligned
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(COLORS.BLUE[0], COLORS.BLUE[1], COLORS.BLUE[2])
    doc.text('PACKAGING & DISPATCH CHECKS', MARGIN + 5, currentY + 6)

    const checks = [
      'All items checked and counted',
      'Items properly protected / wrapped',
      'Transporter name sticker',
      'Package sealed securely',
      'Customer details label attached',
      'Delivery address verified',
    ]

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(COLORS.DARK_TEXT[0], COLORS.DARK_TEXT[1], COLORS.DARK_TEXT[2])

    // Proper column positioning - ensure everything stays within bounds
    const checkboxSize = 4
    const checkboxXLeft = MARGIN + 5
    const checkboxXRight = MARGIN + CONTENT_WIDTH / 2 + 3
    const textOffset = checkboxSize + 3 // Space after checkbox
    const startY = currentY + 11
    const lineHeight = 5.5
    
    // Calculate max text width for each column to prevent overflow
    const maxTextWidthLeft = (MARGIN + CONTENT_WIDTH / 2) - checkboxXLeft - textOffset - 5
    const maxTextWidthRight = (PAGE_WIDTH - MARGIN) - checkboxXRight - textOffset - 5

    // Left column
    checks.forEach((label, i) => {
      if (i % 2 === 0) {
        const yPos = startY + (Math.floor(i / 2)) * lineHeight
        // Checkbox - properly aligned
        drawCheckbox(checkboxXLeft, yPos, checkboxSize)
        // Text - properly aligned, truncated if needed
        const textLines = doc.splitTextToSize(label, maxTextWidthLeft)
        doc.text(textLines[0], checkboxXLeft + textOffset, yPos)
      }
    })

    // Right column
    checks.forEach((label, i) => {
      if (i % 2 === 1) {
        const yPos = startY + (Math.floor(i / 2)) * lineHeight
        // Checkbox - properly aligned
        drawCheckbox(checkboxXRight, yPos, checkboxSize)
        // Text - properly aligned, truncated if needed
        const textLines = doc.splitTextToSize(label, maxTextWidthRight)
        doc.text(textLines[0], checkboxXRight + textOffset, yPos)
      }
    })

    currentY += sectionHeight + 10
  }

  // --- SIGNATURES ---
  const drawSignatures = () => {
    const requiredHeight = 24
    addPageIfNeeded(requiredHeight)

    const blockWidth = CONTENT_WIDTH / 3
    const labels = ['PRODUCED BY', 'CHECKED BY', 'DISPATCH APPROVED']

    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(COLORS.GRAY_TEXT[0], COLORS.GRAY_TEXT[1], COLORS.GRAY_TEXT[2])

    labels.forEach((label, idx) => {
      const x = MARGIN + blockWidth * idx
      doc.text(label, x, currentY)
      doc.setDrawColor(0, 0, 0)
      doc.setLineWidth(0.3)
      doc.line(x, currentY + 8, x + blockWidth - 8, currentY + 8)
      doc.setFont('helvetica', 'normal')
      doc.text('Date: __________', x, currentY + 13)
      doc.setFont('helvetica', 'bold')
    })

    currentY += requiredHeight
  }

  // --- FOOTER ---
  const drawFooter = () => {
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      const pageLabel = `System generated production checklist | Order: ${
        order.internal_order_number || 'N/A'
      } | Page ${i} of ${totalPages}`
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(140, 140, 140)
      doc.text(
        'This checklist must be completed before the order is dispatched.',
        PAGE_WIDTH / 2,
        PAGE_HEIGHT - 12,
        { align: 'center' }
      )
      doc.text(pageLabel, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' })
    }
    doc.setPage(totalPages)
  }

  // --- Render Document ---
  drawHeader()
  drawTitleBar()
  drawOrderAndCustomerBlocks()
  drawItemsTable()
  drawPackagingSection()
  drawSignatures()
  drawFooter()

  const filenamePrefix = options.filenamePrefix || 'Production_Checklist_'
  const filename = `${filenamePrefix}${order.internal_order_number || 'Order'}.pdf`
  
  // Return PDF as Blob for upload, but also save locally for user convenience
  const pdfBlob = doc.output('blob')
  doc.save(filename)
  
  return { blob: pdfBlob, filename }
}

// Export the old function name for backward compatibility
export function generateProductionPDF(
  order: Order, 
  inventoryItems?: InventoryItem[],
  selectedQuantities?: Record<string, number>,
  productionRecordNumber?: string
): { blob: Blob; filename: string } {
  return generateProductionChecklistPDF(order, inventoryItems || [], {}, selectedQuantities, productionRecordNumber)
}

// --- Tracking Slip PDF Generator ---

export interface DispatchData {
  dispatchType: string
  dispatchDate: string
  trackingId?: string
  courierName?: string
  productionNumber?: string
  items: Array<{
    name: string
    quantity: number
  }>
}

export interface TrackingSlipData {
  order: Order
  dispatch: DispatchData
}

export function generateTrackingSlipPDF(
  order: Order,
  dispatch: DispatchData,
  options: PdfOptions = {}
): { blob: Blob; filename: string } {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })

  // --- Constants & Colors ---
  const COLORS = {
    ORANGE: [245, 158, 11] as [number, number, number], // #f59e0b
    BLUE: [59, 130, 246] as [number, number, number], // #3b82f6
    DARK_BLUE: [16, 78, 139] as [number, number, number], // #104e8b
    BLACK: [0, 0, 0] as [number, number, number],
    WHITE: [255, 255, 255] as [number, number, number],
  }

  const BORDER_WIDTH = 0.7 // 2px equivalent
  const MARGIN = 5
  const PAGE_WIDTH = doc.internal.pageSize.getWidth()
  const PAGE_HEIGHT = doc.internal.pageSize.getHeight()
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

  let currentY = MARGIN

  // Helper function to draw input line (underline)
  const drawInputLine = (x: number, y: number, width: number) => {
    doc.setDrawColor(...COLORS.BLACK)
    doc.setLineWidth(0.3)
    doc.line(x, y, x + width, y)
  }

  // Helper function to draw barcode
  const drawBarcode = (x: number, y: number, width: number, height: number, code: string) => {
    // Generate barcode pattern based on tracking code
    const pattern = code.replace(/[^A-Z0-9]/g, '') || 'SK123456'
    let cursorX = x
    const barSpacing = 0.3
    
    doc.setFillColor(...COLORS.BLACK)
    for (let i = 0; i < 60 && cursorX < x + width; i++) {
      const charCode = pattern.charCodeAt(i % pattern.length)
      const isWide = charCode % 3 === 0
      const barWidth = isWide ? 0.8 : 0.4
      
      doc.rect(cursorX, y, barWidth, height, 'F')
      cursorX += barWidth + barSpacing
    }
    
    // Human-readable code below barcode
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.BLACK)
    doc.text(code, x + width / 2, y + height + 5, { align: 'center' })
  }

  // --- Outer Border ---
  doc.setDrawColor(...COLORS.BLACK)
  doc.setLineWidth(BORDER_WIDTH)
  doc.rect(MARGIN, MARGIN, CONTENT_WIDTH, PAGE_HEIGHT - MARGIN * 2, 'S')

  currentY = MARGIN + 8

  // --- Header: Logo and Title ---
  // Logo on left
  doc.setTextColor(...COLORS.ORANGE)
  doc.setFontSize(36)
  doc.setFont('helvetica', 'bold')
  doc.text('Sun', MARGIN + 5, currentY)
  
  doc.setTextColor(...COLORS.BLUE)
  doc.setFontSize(36)
  doc.text('kool', MARGIN + 25, currentY)
  
  // Registered trademark
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.BLACK)
  doc.text('®', MARGIN + 42, currentY - 8)

  // "Parcel Tracking Slip" on right
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.BLACK)
  doc.text('PARCEL TRACKING SLIP', PAGE_WIDTH - MARGIN - 5, currentY, { align: 'right' })

  currentY += 12

  // --- Section 1: TO (CUSTOMER DETAILS) ---
  // Header
  doc.setFillColor(...COLORS.DARK_BLUE)
  doc.setDrawColor(...COLORS.BLACK)
  doc.setLineWidth(BORDER_WIDTH)
  doc.rect(MARGIN, currentY, CONTENT_WIDTH, 8, 'FD')
  
  doc.setTextColor(...COLORS.WHITE)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('TO (CUSTOMER DETAILS):', MARGIN + 3, currentY + 5.5)

  currentY += 8

  // Content box
  const toBoxHeight = 45
  doc.setDrawColor(...COLORS.BLACK)
  doc.setLineWidth(BORDER_WIDTH)
  doc.rect(MARGIN, currentY, CONTENT_WIDTH, toBoxHeight, 'S')

  const contentPadding = 8
  let contentY = currentY + contentPadding

  // Name field
  doc.setTextColor(...COLORS.BLACK)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Name:', MARGIN + contentPadding, contentY)
  const nameLineX = MARGIN + contentPadding + 18
  const nameLineWidth = CONTENT_WIDTH - nameLineX - contentPadding
  drawInputLine(nameLineX, contentY + 1, nameLineWidth)
  // Fill customer name
  doc.setFont('helvetica', 'normal')
  const customerName = order.customers?.name || ''
  if (customerName) {
    doc.text(customerName, nameLineX + 2, contentY - 1, { maxWidth: nameLineWidth - 4 })
  }

  contentY += 8

  // Address field
    doc.setFont('helvetica', 'bold')
  doc.text('Address:', MARGIN + contentPadding, contentY)
  const addressX = MARGIN + contentPadding + 25
  const addressWidth = CONTENT_WIDTH - addressX - contentPadding
  
  if (order.customers?.address) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const addressLines = order.customers.address.split(',').map(line => line.trim().toUpperCase())
    addressLines.forEach((line, idx) => {
      if (contentY < currentY + toBoxHeight - 10) {
        doc.text(line, addressX, contentY, { maxWidth: addressWidth })
        contentY += 5
      }
    })
  }
  
  // Address input lines
  drawInputLine(addressX, contentY + 1, addressWidth)
  contentY += 6
  drawInputLine(addressX, contentY, addressWidth)

  contentY += 8

  // Mobile No. and Pincode
  const fieldWidth = (CONTENT_WIDTH - contentPadding * 2 - 10) / 2
  
  // Mobile No.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Mobile No.:', MARGIN + contentPadding, contentY)
  const mobileLineX = MARGIN + contentPadding + 28
  drawInputLine(mobileLineX, contentY + 1, fieldWidth - 28)
  if (order.customers?.phone) {
    doc.setFont('helvetica', 'normal')
    doc.text(order.customers.phone, mobileLineX + 2, contentY - 1)
  }

  // Pincode
  const pincodeX = MARGIN + contentPadding + fieldWidth + 10
  doc.setFont('helvetica', 'bold')
  doc.text('Pincode:', pincodeX, contentY)
  const pincodeLineX = pincodeX + 22
  drawInputLine(pincodeLineX, contentY + 1, fieldWidth - 22)
  // Extract pincode from address if available
  if (order.customers?.address) {
    const pincodeMatch = order.customers.address.match(/\b\d{6}\b/)
    if (pincodeMatch) {
      doc.setFont('helvetica', 'normal')
      doc.text(pincodeMatch[0], pincodeLineX + 2, contentY - 1)
    }
  }

  currentY += toBoxHeight

  // --- Section 2: FROM ---
  // Header
  doc.setFillColor(...COLORS.DARK_BLUE)
  doc.setDrawColor(...COLORS.BLACK)
  doc.setLineWidth(BORDER_WIDTH)
  doc.rect(MARGIN, currentY, CONTENT_WIDTH, 8, 'FD')
  
  doc.setTextColor(...COLORS.WHITE)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('FROM:', MARGIN + 3, currentY + 5.5)

  currentY += 8

  // Content box
  const fromBoxHeight = 30
  doc.setDrawColor(...COLORS.BLACK)
  doc.setLineWidth(BORDER_WIDTH)
  doc.rect(MARGIN, currentY, CONTENT_WIDTH, fromBoxHeight, 'S')

  contentY = currentY + contentPadding

  doc.setTextColor(...COLORS.BLACK)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('SUNKOOL SOLUTION', MARGIN + contentPadding, contentY)
  
  contentY += 7
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('510, WESTERN PALACE, CONGRESS NAGAR, OPP.', MARGIN + contentPadding, contentY)
  contentY += 5
  doc.text('PARK, NAGPUR - 440012', MARGIN + contentPadding, contentY)
  contentY += 5
  doc.text('MOB. NO. 9156321123', MARGIN + contentPadding, contentY)

  currentY += fromBoxHeight

  // --- Section 3: Tracking & Parcel Details (Split) ---
  const bottomSectionHeight = 60
  const leftWidth = CONTENT_WIDTH / 2

  // Left side: Tracking Number with Barcode
  doc.setFillColor(...COLORS.DARK_BLUE)
  doc.setDrawColor(...COLORS.BLACK)
  doc.setLineWidth(BORDER_WIDTH)
  doc.rect(MARGIN, currentY, leftWidth, 8, 'FD')
  
  doc.setTextColor(...COLORS.WHITE)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('TRACKING NUMBER:', MARGIN + 3, currentY + 5.5)

  // Vertical divider
  doc.setDrawColor(...COLORS.BLACK)
  doc.setLineWidth(BORDER_WIDTH)
  doc.line(MARGIN + leftWidth, currentY, MARGIN + leftWidth, currentY + bottomSectionHeight)
    
  // Barcode area
  const barcodeY = currentY + 8
  const barcodeBoxHeight = bottomSectionHeight - 8
  doc.setDrawColor(...COLORS.BLACK)
  doc.setLineWidth(BORDER_WIDTH)
  doc.rect(MARGIN, barcodeY, leftWidth, barcodeBoxHeight, 'S')

  // Draw barcode
  const trackingCode = dispatch.trackingId || order.internal_order_number || 'SK-000000-IN'
  const barcodeX = MARGIN + leftWidth / 2 - 30
  const barcodeHeight = 20
  drawBarcode(barcodeX, barcodeY + 15, 60, barcodeHeight, trackingCode)

  // Right side: Parcel Details
  const rightX = MARGIN + leftWidth
  doc.setFillColor(...COLORS.DARK_BLUE)
  doc.setDrawColor(...COLORS.BLACK)
  doc.setLineWidth(BORDER_WIDTH)
  doc.rect(rightX, currentY, leftWidth, 8, 'FD')
  
  doc.setTextColor(...COLORS.WHITE)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('PARCEL DETAILS:', rightX + 3, currentY + 5.5)

  // Content box
  doc.setDrawColor(...COLORS.BLACK)
  doc.setLineWidth(BORDER_WIDTH)
  doc.rect(rightX, barcodeY, leftWidth, barcodeBoxHeight, 'S')

  contentY = barcodeY + contentPadding
  const detailFieldWidth = leftWidth - contentPadding * 2

  // Weight field
  doc.setTextColor(...COLORS.BLACK)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Weight:', rightX + contentPadding, contentY)
  const weightLineX = rightX + contentPadding + 20
  drawInputLine(weightLineX, contentY + 1, detailFieldWidth - 20)

  contentY += 15

  // Dimensions field
  doc.setFont('helvetica', 'bold')
  doc.text('Dimensions:', rightX + contentPadding, contentY)
  const dimLineX = rightX + contentPadding
  drawInputLine(dimLineX, contentY + 8, detailFieldWidth)
  
  // Generate filename
  const orderNumber = order.internal_order_number || 'ORDER'
  const trackingId = dispatch.trackingId || 'NO-TRACKING'
  const filename = `Tracking_Slip_${orderNumber}_${trackingId}.pdf`
  
  // Convert to blob
  const pdfBlob = doc.output('blob')

  return { blob: pdfBlob, filename }
}
