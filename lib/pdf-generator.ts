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

  // Start higher to save space
  let currentY = 15

  // Column positions (defined globally for use in addPageIfNeeded)
  const xIndex = MARGIN + 4
  const xDesc = MARGIN + 12
  const xOrdered = 115
  const xPacking = 145
  const xCheck = 172

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
      const headerHeight = 10
      doc.setFillColor(COLORS.LIGHT_BG[0], COLORS.LIGHT_BG[1], COLORS.LIGHT_BG[2])
      doc.setDrawColor(COLORS.BORDER[0], COLORS.BORDER[1], COLORS.BORDER[2])
      doc.rect(MARGIN, currentY, CONTENT_WIDTH, headerHeight, 'FD')

      // Use the updated dynamic column widths for redraw
      const COLS = {
        INDEX: 10,
        MAIN: 50,
        SUB: 50,
        ORDERED: 23,
        PACKING: 23,
        CHECK: 24
      }
      let vX = MARGIN
      const dividers = [COLS.INDEX, COLS.MAIN, COLS.SUB, COLS.ORDERED, COLS.PACKING]
      dividers.forEach(w => {
        vX += w
        doc.line(vX, currentY, vX, currentY + headerHeight)
      })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(COLORS.GRAY_TEXT[0], COLORS.GRAY_TEXT[1], COLORS.GRAY_TEXT[2])

      let xH = MARGIN
      doc.text('#', xH + COLS.INDEX / 2, currentY + 6.5, { align: 'center' })
      xH += COLS.INDEX
      doc.text('MAIN ITEM', xH + 2, currentY + 6.5)
      xH += COLS.MAIN
      doc.text('SUB ITEM', xH + 2, currentY + 6.5)
      xH += COLS.SUB
      doc.text('ORDERED', xH + COLS.ORDERED / 2, currentY + 6.5, { align: 'center' })
      xH += COLS.ORDERED
      doc.text('PACKING', xH + COLS.PACKING / 2, currentY + 6.5, { align: 'center' })
      xH += COLS.PACKING
      doc.text('CHECK', xH + COLS.CHECK / 2, currentY + 6.5, { align: 'center' })

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
    doc.rect(x - size / 2, y - size / 2, size, size, 'S')
  }

  const drawBarcode = (x: number, y: number, w: number, h: number, label?: string) => {
    doc.setDrawColor(COLORS.BORDER[0], COLORS.BORDER[1], COLORS.BORDER[2])
    doc.setLineWidth(0.4)
    doc.setFillColor(255, 255, 255)
    doc.rect(x - 2, y - 2, w + 4, h + 4, 'FD')

    const barcodeLabel = (label || order.internal_order_number || 'ORD-REF').toUpperCase()
    const patternSource = barcodeLabel.replace(/[^A-Z0-9]/g, '') || 'SKOOL'

    doc.setFillColor(0, 0, 0)
    let cursorX = x + 1

    for (let i = 0; cursorX < x + w - 1; i++) {
      const chCode = patternSource.charCodeAt(i % patternSource.length)
      const isWide = chCode % 3 === 0
      const barWidth = isWide ? 0.8 : 0.4
      const gapWidth = 0.4

      doc.rect(cursorX, y, barWidth, h, 'F')
      cursorX += barWidth + gapWidth
    }

    doc.setFontSize(7)
    doc.setTextColor(0, 0, 0)
    doc.text(`*${barcodeLabel}*`, x + w / 2, y + h + 5, { align: 'center' })
  }

  // --- HEADER ---
  const drawHeader = () => {
    if (options.logoDataUrl) {
      const format = options.logoFormat || 'PNG'
      const logoWidth = 35
      const logoHeight = 12
      const logoY = currentY - 7
      doc.addImage(options.logoDataUrl, format, MARGIN, logoY, logoWidth, logoHeight)
    } else {
      doc.setFont('helvetica', 'bolditalic')
      doc.setFontSize(24)
      doc.setTextColor(COLORS.ORANGE[0], COLORS.ORANGE[1], COLORS.ORANGE[2])
      doc.text('Sun', MARGIN, currentY + 2)
      const sunWidth = doc.getTextWidth('Sun')
      doc.setTextColor(COLORS.BLUE[0], COLORS.BLUE[1], COLORS.BLUE[2])
      doc.text('kool', MARGIN + sunWidth - 1, currentY + 2)
    }

    const headerBaseY = currentY - 5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(COLORS.DARK_TEXT[0], COLORS.DARK_TEXT[1], COLORS.DARK_TEXT[2])
    doc.text('SUN KOOL SOLUTION', PAGE_WIDTH - MARGIN, headerBaseY, { align: 'right' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(COLORS.GRAY_TEXT[0], COLORS.GRAY_TEXT[1], COLORS.GRAY_TEXT[2])
    doc.text('1st Floor, Mayfair Apartment, Near All India Reporter,', PAGE_WIDTH - MARGIN, headerBaseY + 3.5, { align: 'right' })
    doc.text('Congress Nagar, Nagpur, Maharashtra 440012', PAGE_WIDTH - MARGIN, headerBaseY + 7, { align: 'right' })
    doc.text('GSTIN: 27AWGPS9842Q1ZD', PAGE_WIDTH - MARGIN, headerBaseY + 10.5, { align: 'right' })

    currentY += 12
    doc.setDrawColor(COLORS.ORANGE[0], COLORS.ORANGE[1], COLORS.ORANGE[2])
    doc.setLineWidth(0.8)
    doc.line(MARGIN, currentY, PAGE_WIDTH - MARGIN, currentY)
    currentY += 4
  }

  // --- TITLE BAR ---
  const drawTitleBar = () => {
    const boxHeight = 15
    doc.setFillColor(252, 252, 252)
    doc.setDrawColor(COLORS.BORDER[0], COLORS.BORDER[1], COLORS.BORDER[2])
    doc.rect(MARGIN, currentY, CONTENT_WIDTH, boxHeight, 'FD')

    doc.setFillColor(COLORS.BLUE[0], COLORS.BLUE[1], COLORS.BLUE[2])
    doc.rect(MARGIN, currentY, 3, boxHeight, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(COLORS.BLUE[0], COLORS.BLUE[1], COLORS.BLUE[2])
    const titleText = productionRecordNumber
      ? `PRODUCTION CHECKLIST - ${productionRecordNumber}`
      : 'PRODUCTION CHECKLIST'
    doc.text(titleText, MARGIN + 6, currentY + 6.5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(COLORS.GRAY_TEXT[0], COLORS.GRAY_TEXT[1], COLORS.GRAY_TEXT[2])
    doc.text('Internal warehouse / dispatch document', MARGIN + 6, currentY + 10.5)

    const barcodeWidth = 35
    const barcodeHeight = 7
    const barcodeX = PAGE_WIDTH - MARGIN - barcodeWidth - 3
    const barcodeY = currentY + 2.5
    const barcodeLabel = productionRecordNumber || order.internal_order_number || 'ORD-REF'

    drawBarcode(barcodeX, barcodeY, barcodeWidth, barcodeHeight, barcodeLabel)
    currentY += boxHeight
  }

  // --- METADATA ROW ---
  const drawMetadataRow = () => {
    const boxHeight = 22
    const colWidth = CONTENT_WIDTH / 2

    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(COLORS.BORDER[0], COLORS.BORDER[1], COLORS.BORDER[2])
    doc.rect(MARGIN, currentY, CONTENT_WIDTH, boxHeight, 'S')
    doc.line(MARGIN + colWidth, currentY, MARGIN + colWidth, currentY + boxHeight)

    const textY = currentY + 5
    const labelX1 = MARGIN + 4
    const labelX2 = MARGIN + colWidth + 4

    // Section Labels
    doc.setFontSize(7)
    doc.setTextColor(COLORS.GRAY_TEXT[0], COLORS.GRAY_TEXT[1], COLORS.GRAY_TEXT[2])
    doc.setFont('helvetica', 'bold')

    doc.text('ORDER INFORMATION', labelX1, textY)
    doc.text('CUSTOMER / DESTINATION', labelX2, textY)

    // Data Fields (Bold and Larger)
    doc.setFontSize(9)
    doc.setTextColor(COLORS.DARK_TEXT[0], COLORS.DARK_TEXT[1], COLORS.DARK_TEXT[2])
    doc.setFont('helvetica', 'bold')

    // Left Column
    doc.text(`Order No: ${order.internal_order_number || 'N/A'}`, labelX1, textY + 5)
    doc.text(`Sales No: ${order.sales_order_number || 'N/A'}`, labelX1, textY + 9.5)
    doc.text(`Date: ${new Date(order.created_at).toLocaleDateString()}`, labelX1, textY + 14)

    // Right Column
    doc.text((order.customers.name || 'N/A').substring(0, 50), labelX2, textY + 5)
    doc.setFont('helvetica', 'normal') // Address can be normal or bold depending on space, user asked for bold parts, but let's see
    doc.setFont('helvetica', 'bold')

    const addrLines = doc.splitTextToSize(order.customers.address || 'N/A', colWidth - 10)
    doc.text(addrLines[0], labelX2, textY + 9.5)

    if (order.customers.contact_person) {
      doc.text(`Attn: ${order.customers.contact_person}`, labelX2, textY + 14)
    }

    currentY += boxHeight + 8 // Added 8mm gap after info table
  }

  // --- ITEMS TABLE ---
  const drawItemsTable = () => {
    const headerHeight = 8
    const COLS = {
      INDEX: 10,
      MAIN: 50,
      SUB: 50,
      ORDERED: 23,
      PACKING: 23,
      CHECK: 24
    }

    doc.setFillColor(COLORS.LIGHT_BG[0], COLORS.LIGHT_BG[1], COLORS.LIGHT_BG[2])
    doc.setDrawColor(COLORS.BORDER[0], COLORS.BORDER[1], COLORS.BORDER[2])
    doc.rect(MARGIN, currentY, CONTENT_WIDTH, headerHeight, 'FD')

    let vX = MARGIN
    doc.setLineWidth(0.2)
    const dividersForHeader = [COLS.INDEX, COLS.MAIN, COLS.SUB, COLS.ORDERED, COLS.PACKING]
    dividersForHeader.forEach(w => {
      vX += w
      doc.line(vX, currentY, vX, currentY + headerHeight)
    })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(COLORS.GRAY_TEXT[0], COLORS.GRAY_TEXT[1], COLORS.GRAY_TEXT[2])

    let xPos = MARGIN
    doc.text('#', xPos + COLS.INDEX / 2, currentY + 5.5, { align: 'center' })
    xPos += COLS.INDEX
    doc.text('MAIN ITEM', xPos + 2, currentY + 5.5)
    xPos += COLS.MAIN
    doc.text('SUB ITEM', xPos + 2, currentY + 5.5)
    xPos += COLS.SUB
    doc.text('ORDERED', xPos + COLS.ORDERED / 2, currentY + 5.5, { align: 'center' })
    xPos += COLS.ORDERED
    doc.text('PACKING', xPos + COLS.PACKING / 2, currentY + 5.5, { align: 'center' })
    xPos += COLS.PACKING
    doc.text('CHECK', xPos + COLS.CHECK / 2, currentY + 5.5, { align: 'center' })

    currentY += headerHeight

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
    const displayRows: Array<{ mainName: string; subName: string; qty: number; index: number }> = []

    // 1. Identify all rows for Dual Column structure (Deduplicated)
    order.items.forEach((item) => {
      if (processedIds.has(item.id)) return

      let matchedInventoryItem = inventoryItems.find(inv =>
        inv.id === item.inventory_item_id || inv.id === item.product_id
      )

      if (!matchedInventoryItem) {
        for (const parentInv of inventoryItems) {
          const found = parentInv.sub_items?.some(sub => sub.id === item.inventory_item_id || sub.id === item.product_id)
          if (found) {
            matchedInventoryItem = parentInv
            break
          }
        }
      }

      const parentItemName = matchedInventoryItem?.item_name || item.inventory_item?.item_name || 'Product'

      // Identify sub-items
      const subItemsFromOrderItem = item.inventory_item?.sub_items || []
      const subItemsFromInventory = matchedInventoryItem?.sub_items || []
      const allSubItemsFromDef: Array<{ id: string; item_name: string; quantity_needed?: number }> = []

      subItemsFromOrderItem.forEach(sub => allSubItemsFromDef.push(sub))
      subItemsFromInventory.forEach(sub => {
        if (!allSubItemsFromDef.some(s => s.id === sub.id)) allSubItemsFromDef.push(sub)
      })

      const subItemsFromOrder = order.items.filter(
        (oi) =>
          oi.inventory_item_id &&
          allSubItemsFromDef.some((sub) => sub.id === oi.inventory_item_id) &&
          !processedIds.has(oi.id)
      )

      const parentQty = selectedQuantities && selectedQuantities[item.id] !== undefined
        ? selectedQuantities[item.id]
        : item.quantity

      // DEDUPLICATION: Only add parent row if no sub-items exist
      if (allSubItemsFromDef.length === 0 && subItemsFromOrder.length === 0) {
        displayRows.push({ mainName: parentItemName, subName: '', qty: parentQty, index: 0 })
      } else {
        // ADD SUB-ITEM ROWS
        // If we have sub-items in the order, ONLY show those.
        // If we don't have sub-items in the order but the parent is defined with sub-items, show all from definition.
        if (subItemsFromOrder.length > 0) {
          subItemsFromOrder.forEach((oi) => {
            if (processedIds.has(oi.id)) return

            const qty = selectedQuantities && selectedQuantities[oi.id] !== undefined
              ? selectedQuantities[oi.id]
              : oi.quantity

            // IMPROVED NAME RESOLUTION
            let subItemName = oi.inventory_item?.item_name || 'Item'
            if (subItemName === 'Item') {
              let matched: any = inventoryItems.find(inv => inv.id === oi.inventory_item_id || inv.id === oi.product_id)
              if (!matched) {
                for (const parentInv of inventoryItems) {
                  const found = parentInv.sub_items?.find((sub: any) => sub.id === oi.inventory_item_id || sub.id === oi.product_id)
                  if (found) {
                    matched = found
                    break
                  }
                }
              }
              if (matched?.item_name) subItemName = matched.item_name
            }

            // NOTE: We no longer strip the parent name prefix as it was causing incomplete names like "12", "45"

            displayRows.push({ mainName: parentItemName, subName: subItemName, qty: qty, index: 0 })
            processedIds.add(oi.id)
          })
        } else {
          // Expansion mode: Use sub-items from definition (only when nothing explicit in order)
          allSubItemsFromDef.forEach((sub) => {
            const baseQty = (sub.quantity_needed || 1) * parentQty
            displayRows.push({ mainName: parentItemName, subName: sub.item_name, qty: baseQty, index: 0 })
          })
        }
      }

      processedIds.add(item.id)
    })

    // 2. Sort naturally and assign sequential index
    // Also FILTER out rows with qty <= 0 (important for partial production)
    const filteredRows = displayRows.filter(row => row.qty > 0)

    filteredRows.sort((a, b) => {
      const mainComp = a.mainName.localeCompare(b.mainName, undefined, { numeric: true, sensitivity: 'base' })
      if (mainComp !== 0) return mainComp
      // If same main, parent row (subName empty) comes first
      if (a.subName === '' && b.subName !== '') return -1
      if (a.subName !== '' && b.subName === '') return 1
      return a.subName.localeCompare(b.subName, undefined, { numeric: true, sensitivity: 'base' })
    })
    filteredRows.forEach((row, i) => row.index = i + 1)

    // 3. Render rows in full grid
    filteredRows.forEach((row, i) => {
      const rowHeight = 8
      addPageIfNeeded(rowHeight)

      if (i % 2 !== 0) {
        doc.setFillColor(252, 252, 252)
        doc.rect(MARGIN, currentY, CONTENT_WIDTH, rowHeight, 'F')
      }

      doc.setDrawColor(COLORS.BORDER[0], COLORS.BORDER[1], COLORS.BORDER[2])
      doc.setLineWidth(0.2)
      doc.rect(MARGIN, currentY, CONTENT_WIDTH, rowHeight, 'S')

      let itVX = MARGIN
      const rowDividers = [COLS.INDEX, COLS.MAIN, COLS.SUB, COLS.ORDERED, COLS.PACKING]
      rowDividers.forEach(w => {
        itVX += w
        doc.line(itVX, currentY, itVX, currentY + rowHeight)
      })

      let x = MARGIN
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(COLORS.DARK_TEXT[0], COLORS.DARK_TEXT[1], COLORS.DARK_TEXT[2])
      doc.text(String(row.index), x + COLS.INDEX / 2, currentY + 5.5, { align: 'center' })

      x += COLS.INDEX
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      const mainLines = doc.splitTextToSize(row.mainName, COLS.MAIN - 4)
      doc.text(mainLines[0], x + 2, currentY + 5.5)

      x += COLS.MAIN
      doc.setFont('helvetica', row.subName ? 'normal' : 'bold')
      doc.setFontSize(10)
      if (row.subName) {
        const subLines = doc.splitTextToSize(row.subName, COLS.SUB - 4)
        doc.text(subLines[0], x + 2, currentY + 5.5)
      } else {
        doc.setTextColor(COLORS.GRAY_TEXT[0], COLORS.GRAY_TEXT[1], COLORS.GRAY_TEXT[2])
        doc.setFontSize(8)
        doc.text('-', x + COLS.SUB / 2, currentY + 5.5, { align: 'center' })
        doc.setTextColor(COLORS.DARK_TEXT[0], COLORS.DARK_TEXT[1], COLORS.DARK_TEXT[2])
      }

      x += COLS.SUB
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(String(row.qty), x + COLS.ORDERED / 2, currentY + 5.5, { align: 'center' })

      x += COLS.ORDERED
      doc.setDrawColor(180, 180, 180)
      doc.line(x + 4, currentY + 6, x + COLS.PACKING - 4, currentY + 6)

      x += COLS.PACKING
      drawCheckbox(x + COLS.CHECK / 2, currentY + 4, 5.2)

      currentY += rowHeight
    })
  }

  // --- PACKAGING PROTOCOLS ---
  const drawPackagingSection = () => {
    // Spacer between product table and packaging
    currentY += 8

    const headerHeight = 8
    const rowHeight = 8
    const totalRows = 3 // 6 checks / 2 columns
    const totalHeight = headerHeight + (totalRows * rowHeight)

    addPageIfNeeded(totalHeight + 5)

    // Header bar
    doc.setFillColor(COLORS.BLUE[0], COLORS.BLUE[1], COLORS.BLUE[2])
    doc.setDrawColor(COLORS.BORDER[0], COLORS.BORDER[1], COLORS.BORDER[2])
    doc.rect(MARGIN, currentY, CONTENT_WIDTH, headerHeight, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text('PACKAGING & DISPATCH CHECKS', MARGIN + 4, currentY + 5.5)

    currentY += headerHeight

    const checks = [
      'All items checked and counted',
      'Items properly protected / wrapped',
      'Transporter name sticker',
      'Package sealed securely',
      'Customer details label attached',
      'Delivery address verified',
    ]

    const colWidth = CONTENT_WIDTH / 2
    const checkboxOffset = colWidth - 8

    for (let i = 0; i < totalRows; i++) {
      // Background / Zebra striping
      if (i % 2 !== 0) {
        doc.setFillColor(252, 252, 252)
        doc.rect(MARGIN, currentY, CONTENT_WIDTH, rowHeight, 'F')
      }

      // External borders & internal dividers
      doc.setDrawColor(COLORS.BORDER[0], COLORS.BORDER[1], COLORS.BORDER[2])
      doc.setLineWidth(0.2)
      doc.rect(MARGIN, currentY, CONTENT_WIDTH, rowHeight, 'S')
      doc.line(MARGIN + colWidth, currentY, MARGIN + colWidth, currentY + rowHeight)

      // Vertical line for checkbox column on both halves
      doc.line(MARGIN + checkboxOffset, currentY, MARGIN + checkboxOffset, currentY + rowHeight)
      doc.line(MARGIN + colWidth + checkboxOffset, currentY, MARGIN + colWidth + checkboxOffset, currentY + rowHeight)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(COLORS.DARK_TEXT[0], COLORS.DARK_TEXT[1], COLORS.DARK_TEXT[2])

      // Left Column check
      const leftCheck = checks[i * 2]
      doc.text(leftCheck, MARGIN + 4, currentY + 5.2)
      drawCheckbox(MARGIN + checkboxOffset + 4, currentY + 4, 4.5)

      // Right Column check
      const rightCheck = checks[i * 2 + 1]
      doc.text(rightCheck, MARGIN + colWidth + 4, currentY + 5.2)
      drawCheckbox(MARGIN + colWidth + checkboxOffset + 4, currentY + 4, 4.5)

      currentY += rowHeight
    }

    currentY += 5
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
      const pageLabel = `System generated production checklist | Order: ${order.internal_order_number || 'N/A'
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
  drawMetadataRow()
  drawItemsTable()
  drawPackagingSection()
  drawSignatures()
  drawFooter()

  const filenamePrefix = options.filenamePrefix || 'Production_Checklist_'
  const filename = `${filenamePrefix}${order.internal_order_number || 'Order'}.pdf`

  const pdfBlob = doc.output('blob')
  doc.save(filename)

  return { blob: pdfBlob, filename }
}

// Export the old function name for backward compatibility
export function generateProductionPDF(
  order: Order,
  inventoryItems?: InventoryItem[],
  selectedQuantities?: Record<string, number>,
  productionRecordNumber?: string,
  logoDataUrl?: string
): { blob: Blob; filename: string } {
  return generateProductionChecklistPDF(
    order,
    inventoryItems || [],
    { logoDataUrl, logoFormat: 'PNG' },
    selectedQuantities,
    productionRecordNumber
  )
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

  const COLORS = {
    BLUE_HEADER: [16, 78, 139] as [number, number, number], // Dark blue like the reference
    BLACK: [0, 0, 0] as [number, number, number],
    WHITE: [255, 255, 255] as [number, number, number],
    GRAY_BORDER: [180, 180, 180] as [number, number, number],
    TEXT_MAIN: [40, 40, 40] as [number, number, number],
  }

  const MARGIN = 8
  const PAGE_WIDTH = doc.internal.pageSize.getWidth()
  const PAGE_HEIGHT = doc.internal.pageSize.getHeight()
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
  const BORDER_WIDTH = 0.4

  let currentY = MARGIN

  // --- Helpers ---
  const drawLine = (x: number, y: number, w: number, color = COLORS.BLACK) => {
    doc.setDrawColor(color[0], color[1], color[2])
    doc.setLineWidth(0.3)
    doc.line(x, y, x + w, y)
  }

  const drawBarcode = (x: number, y: number, width: number, height: number, code: string) => {
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

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.BLACK)
    doc.text(code, x + width / 2, y + height + 5, { align: 'center' })
  }

  // Draw external thin border around entire content
  doc.setDrawColor(COLORS.GRAY_BORDER[0], COLORS.GRAY_BORDER[1], COLORS.GRAY_BORDER[2])
  doc.setLineWidth(0.2)
  doc.rect(MARGIN - 2, MARGIN - 2, CONTENT_WIDTH + 4, PAGE_HEIGHT - MARGIN * 2 + 4, 'S')

  // --- 1. HEADER SECTION ---
  const headerHeight = 15
  if (options.logoDataUrl) {
    doc.addImage(options.logoDataUrl, options.logoFormat || 'PNG', MARGIN, currentY, 35, 12)
  } else {
    // Elegant Text Logo fallback
    doc.setFont('helvetica', 'bolditalic')
    doc.setFontSize(24)
    doc.setTextColor(245, 158, 11) // Orange
    doc.text('Sun', MARGIN, currentY + 10)
    const sunW = doc.getTextWidth('Sun')
    doc.setTextColor(16, 78, 139) // Blue
    doc.text('kool', MARGIN + sunW - 1, currentY + 10)
    doc.setFontSize(8)
    doc.text('®', MARGIN + sunW + doc.getTextWidth('kool'), currentY + 3)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...COLORS.BLACK)
  doc.text('PARCEL TRACKING SLIP', PAGE_WIDTH - MARGIN, currentY + 8, { align: 'right' })

  currentY += headerHeight + 2
  drawLine(MARGIN, currentY, CONTENT_WIDTH, COLORS.BLACK)
  currentY += 2

  // --- 2. TO SECTION (Clean Block Format) ---
  // Header Bar
  doc.setFillColor(...COLORS.BLUE_HEADER)
  doc.rect(MARGIN, currentY, CONTENT_WIDTH, 8, 'F')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.WHITE)
  doc.text('TO (CUSTOMER DETAILS):', MARGIN + 3, currentY + 5.5)
  currentY += 8

  // Details Box
  const toBoxHeight = 42
  doc.setDrawColor(...COLORS.BLACK)
  doc.setLineWidth(BORDER_WIDTH)
  doc.rect(MARGIN, currentY, CONTENT_WIDTH, toBoxHeight, 'S')

  let contentY = currentY + 10
  const pad = 8

  doc.setTextColor(...COLORS.BLACK)

  // Name in Bold
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  const customerName = (order.customers?.name || '').toUpperCase()
  doc.text(customerName, MARGIN + pad, contentY)

  // Address and Phone in Normal
  contentY += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  const address = (order.customers?.address || '').toUpperCase()
  const addrLines = doc.splitTextToSize(address, CONTENT_WIDTH - pad * 2)
  doc.text(addrLines.slice(0, 3), MARGIN + pad, contentY)

  contentY += (addrLines.slice(0, 3).length * 6)
  if (order.customers?.phone) {
    doc.text(`MOB: ${order.customers.phone}`, MARGIN + pad, contentY)
  }

  currentY += toBoxHeight + 4

  // --- 3. FROM SECTION ---
  doc.setFillColor(...COLORS.BLUE_HEADER)
  doc.rect(MARGIN, currentY, CONTENT_WIDTH, 8, 'F')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.WHITE)
  doc.text('FROM:', MARGIN + 3, currentY + 5.5)
  currentY += 8

  const fromBoxHeight = 28
  doc.setDrawColor(...COLORS.BLACK)
  doc.setLineWidth(BORDER_WIDTH)
  doc.rect(MARGIN, currentY, CONTENT_WIDTH, fromBoxHeight, 'S')

  contentY = currentY + 8
  doc.setTextColor(...COLORS.BLACK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('SUNKOOL SOLUTION', MARGIN + pad, contentY)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  contentY += 6
  doc.text('510, WESTERN PALACE, CONGRESS NAGAR, OPP.', MARGIN + pad, contentY)
  contentY += 5
  doc.text('PARK, NAGPUR - 440012', MARGIN + pad, contentY)
  contentY += 5
  doc.text('MOB. NO. 9156321123', MARGIN + pad, contentY)

  currentY += fromBoxHeight + 4

  // --- 4. BOTTOM SECTION (SPLIT) ---
  const splitY = currentY
  const boxW = CONTENT_WIDTH / 2
  const boxH = 45

  // Left: Tracking
  doc.setFillColor(...COLORS.BLUE_HEADER)
  doc.rect(MARGIN, splitY, boxW, 8, 'F')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.WHITE)
  doc.text('TRACKING NUMBER:', MARGIN + 3, splitY + 5.5)

  doc.setDrawColor(...COLORS.BLACK)
  doc.rect(MARGIN, splitY + 8, boxW, boxH, 'S')
  const tracking = dispatch.trackingId || order.internal_order_number || 'SK-0000000'
  drawBarcode(MARGIN + boxW / 2 - 25, splitY + 22, 50, 15, tracking)

  // Right: Parcel Details
  doc.setFillColor(...COLORS.BLUE_HEADER)
  doc.rect(MARGIN + boxW, splitY, boxW, 8, 'F')
  doc.text('PARCEL DETAILS:', MARGIN + boxW + 3, splitY + 5.5)

  doc.setDrawColor(...COLORS.BLACK)
  doc.setLineWidth(BORDER_WIDTH)
  doc.rect(MARGIN + boxW, splitY + 8, boxW, boxH, 'S')

  let rightContentY = splitY + 18
  doc.setTextColor(...COLORS.BLACK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Weight:', MARGIN + boxW + pad, rightContentY)
  drawLine(MARGIN + boxW + pad + 15, rightContentY + 1.5, boxW - pad * 2 - 15)

  rightContentY += 12
  doc.text('Dimensions:', MARGIN + boxW + pad, rightContentY)
  drawLine(MARGIN + boxW + pad, rightContentY + 8, boxW - pad * 2)

  currentY += boxH + 12

  // --- 5. HANDLING INSTRUCTIONS ---
  doc.setFillColor(...COLORS.BLUE_HEADER)
  doc.rect(MARGIN, currentY, CONTENT_WIDTH, 8, 'F')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.WHITE)
  doc.text('HANDLING INSTRUCTIONS:', MARGIN + 3, currentY + 5.5)
  currentY += 8

  const instrBoxH = 35
  doc.setDrawColor(...COLORS.BLACK)
  doc.setLineWidth(BORDER_WIDTH)
  doc.rect(MARGIN, currentY, CONTENT_WIDTH, instrBoxH, 'S')

  doc.setTextColor(...COLORS.BLACK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  let instrY = currentY + 8

  const instructions = [
    "• Handle with care: Contains sensitive components.",
    "• Keep dry and away from direct heat or sharp objects.",
    "• Do not stack heavy items on top of this parcel.",
    "• In case of damage to outer packaging, please check contents before accepting."
  ]

  instructions.forEach(line => {
    doc.text(line, MARGIN + pad, instrY)
    instrY += 6
  })

  // Final Cleanup
  const orderNum = order.internal_order_number || 'ORD'
  const tId = dispatch.trackingId || 'ID'
  const filename = `Parcel_Slip_${orderNum}_${tId}.pdf`
  const pdfBlob = doc.output('blob')

  return { blob: pdfBlob, filename }
}


