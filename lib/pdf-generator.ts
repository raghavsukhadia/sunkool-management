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

  /** Item table column widths (no SUB column; MAIN = former MAIN + SUB). Sum = CONTENT_WIDTH. */
  const TABLE_COLS = {
    INDEX: 10,
    MAIN: 100,
    ORDERED: 23,
    PACKING: 23,
    CHECK: 24,
  }

  // Start higher to save space
  let currentY = 15

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

      let vX = MARGIN
      const dividers = [TABLE_COLS.INDEX, TABLE_COLS.MAIN, TABLE_COLS.ORDERED, TABLE_COLS.PACKING]
      dividers.forEach(w => {
        vX += w
        doc.line(vX, currentY, vX, currentY + headerHeight)
      })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(COLORS.GRAY_TEXT[0], COLORS.GRAY_TEXT[1], COLORS.GRAY_TEXT[2])

      let xH = MARGIN
      doc.text('#', xH + TABLE_COLS.INDEX / 2, currentY + 6.5, { align: 'center' })
      xH += TABLE_COLS.INDEX
      doc.text('MAIN ITEM', xH + 2, currentY + 6.5)
      xH += TABLE_COLS.MAIN
      doc.text('ORDERED', xH + TABLE_COLS.ORDERED / 2, currentY + 6.5, { align: 'center' })
      xH += TABLE_COLS.ORDERED
      doc.text('PACKING', xH + TABLE_COLS.PACKING / 2, currentY + 6.5, { align: 'center' })
      xH += TABLE_COLS.PACKING
      doc.text('CHECK', xH + TABLE_COLS.CHECK / 2, currentY + 6.5, { align: 'center' })

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

    doc.setFillColor(COLORS.LIGHT_BG[0], COLORS.LIGHT_BG[1], COLORS.LIGHT_BG[2])
    doc.setDrawColor(COLORS.BORDER[0], COLORS.BORDER[1], COLORS.BORDER[2])
    doc.rect(MARGIN, currentY, CONTENT_WIDTH, headerHeight, 'FD')

    let vX = MARGIN
    doc.setLineWidth(0.2)
    const dividersForHeader = [TABLE_COLS.INDEX, TABLE_COLS.MAIN, TABLE_COLS.ORDERED, TABLE_COLS.PACKING]
    dividersForHeader.forEach(w => {
      vX += w
      doc.line(vX, currentY, vX, currentY + headerHeight)
    })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(COLORS.GRAY_TEXT[0], COLORS.GRAY_TEXT[1], COLORS.GRAY_TEXT[2])

    let xPos = MARGIN
    doc.text('#', xPos + TABLE_COLS.INDEX / 2, currentY + 5.5, { align: 'center' })
    xPos += TABLE_COLS.INDEX
    doc.text('MAIN ITEM', xPos + 2, currentY + 5.5)
    xPos += TABLE_COLS.MAIN
    doc.text('ORDERED', xPos + TABLE_COLS.ORDERED / 2, currentY + 5.5, { align: 'center' })
    xPos += TABLE_COLS.ORDERED
    doc.text('PACKING', xPos + TABLE_COLS.PACKING / 2, currentY + 5.5, { align: 'center' })
    xPos += TABLE_COLS.PACKING
    doc.text('CHECK', xPos + TABLE_COLS.CHECK / 2, currentY + 5.5, { align: 'center' })

    currentY += headerHeight

    const processedIds = new Set<string>()
    const displayRows: Array<{ mainName: string; subName: string; qty: number; index: number }> = []

    // 1. Identify all rows (Deduplicated)
    if (order.items && order.items.length > 0) {
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
    }

    // 2. Keep user-added order and assign sequential index
    // Also FILTER out rows with qty <= 0 (important for partial production)
    const filteredRows = displayRows.filter(row => row.qty > 0)
    filteredRows.forEach((row, i) => row.index = i + 1)

    const drawTableRowShell = (stripeIndex: number, rowHeight: number) => {
      addPageIfNeeded(rowHeight)
      if (stripeIndex % 2 !== 0) {
        doc.setFillColor(252, 252, 252)
        doc.rect(MARGIN, currentY, CONTENT_WIDTH, rowHeight, 'F')
      }
      doc.setDrawColor(COLORS.BORDER[0], COLORS.BORDER[1], COLORS.BORDER[2])
      doc.setLineWidth(0.2)
      doc.rect(MARGIN, currentY, CONTENT_WIDTH, rowHeight, 'S')
      let itVX = MARGIN
      ;[TABLE_COLS.INDEX, TABLE_COLS.MAIN, TABLE_COLS.ORDERED, TABLE_COLS.PACKING].forEach((w) => {
        itVX += w
        doc.line(itVX, currentY, itVX, currentY + rowHeight)
      })
    }

    // 3. Render data rows
    filteredRows.forEach((row, i) => {
      const rowHeight = row.subName ? 11 : 8
      drawTableRowShell(i, rowHeight)

      let x = MARGIN
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(COLORS.DARK_TEXT[0], COLORS.DARK_TEXT[1], COLORS.DARK_TEXT[2])
      doc.text(String(row.index), x + TABLE_COLS.INDEX / 2, currentY + 5.5, { align: 'center' })

      x += TABLE_COLS.INDEX
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(COLORS.DARK_TEXT[0], COLORS.DARK_TEXT[1], COLORS.DARK_TEXT[2])
      const mainLines = doc.splitTextToSize(row.mainName, TABLE_COLS.MAIN - 4)
      doc.text(mainLines[0], x + 2, currentY + 5.5)
      if (row.subName) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        const subLines = doc.splitTextToSize(row.subName, TABLE_COLS.MAIN - 4)
        doc.text(subLines[0], x + 2, currentY + 9.5)
      }

      x += TABLE_COLS.MAIN
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text(String(row.qty), x + TABLE_COLS.ORDERED / 2, currentY + 5.5, { align: 'center' })
      doc.setFont('helvetica', 'normal')

      x += TABLE_COLS.ORDERED
      doc.setDrawColor(180, 180, 180)
      doc.line(x + 4, currentY + 6, x + TABLE_COLS.PACKING - 4, currentY + 6)

      x += TABLE_COLS.PACKING
      drawCheckbox(x + TABLE_COLS.CHECK / 2, currentY + 4, 5.2)

      currentY += rowHeight
    })

    // 4. Three blank rows for handwriting (serial continues)
    const nextSerial = filteredRows.length + 1
    for (let b = 0; b < 3; b++) {
      const rowHeight = 8
      const stripeIndex = filteredRows.length + b
      drawTableRowShell(stripeIndex, rowHeight)

      let x = MARGIN
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(COLORS.DARK_TEXT[0], COLORS.DARK_TEXT[1], COLORS.DARK_TEXT[2])
      doc.text(String(nextSerial + b), x + TABLE_COLS.INDEX / 2, currentY + 5.5, { align: 'center' })

      x += TABLE_COLS.INDEX + TABLE_COLS.MAIN + TABLE_COLS.ORDERED
      doc.setDrawColor(180, 180, 180)
      doc.line(x + 4, currentY + 6, x + TABLE_COLS.PACKING - 4, currentY + 6)

      x += TABLE_COLS.PACKING
      drawCheckbox(x + TABLE_COLS.CHECK / 2, currentY + 4, 5.2)

      currentY += rowHeight
    }
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

  const pad = 8
  const headerBarHeight = 12
  const gapBetweenSections = 6
  const contentAreaHeight = PAGE_HEIGHT - currentY - MARGIN
  const toSectionHeight = contentAreaHeight * 0.55
  const fromSectionHeight = contentAreaHeight * 0.45
  const toBoxHeight = toSectionHeight - headerBarHeight - gapBetweenSections
  const fromBoxHeight = fromSectionHeight - headerBarHeight - gapBetweenSections

  // --- 2. TO SECTION (full-width, large font, fills allocated space) ---
  doc.setFillColor(...COLORS.BLUE_HEADER)
  doc.rect(MARGIN, currentY, CONTENT_WIDTH, headerBarHeight, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...COLORS.WHITE)
  doc.text('TO (CUSTOMER DETAILS):', MARGIN + 4, currentY + 8)
  currentY += headerBarHeight

  doc.setDrawColor(...COLORS.BLACK)
  doc.setLineWidth(BORDER_WIDTH)
  doc.rect(MARGIN, currentY, CONTENT_WIDTH, toBoxHeight, 'S')

  let contentY = currentY + 18
  doc.setTextColor(...COLORS.BLACK)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  const customerName = (order.customers?.name || '').toUpperCase()
  doc.text(customerName, MARGIN + pad, contentY)

  const lineSpacingTo = 10
  contentY += lineSpacingTo + 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(18)
  const address = (order.customers?.address || '').toUpperCase()
  const addrLines = doc.splitTextToSize(address, CONTENT_WIDTH - pad * 2)
  const maxAddrLines = Math.max(1, Math.floor((toBoxHeight - (contentY - currentY) - 20) / 8))
  const toAddressLines = addrLines.slice(0, maxAddrLines)
  doc.text(toAddressLines, MARGIN + pad, contentY)

  contentY += toAddressLines.length * 8 + 6
  if (order.customers?.phone) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text(`MOB: ${order.customers.phone}`, MARGIN + pad, contentY)
  }

  currentY += toBoxHeight + gapBetweenSections

  // --- 3. FROM SECTION (full-width, large font, fills allocated space) ---
  doc.setFillColor(...COLORS.BLUE_HEADER)
  doc.rect(MARGIN, currentY, CONTENT_WIDTH, headerBarHeight, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...COLORS.WHITE)
  doc.text('FROM:', MARGIN + 4, currentY + 8)
  currentY += headerBarHeight

  doc.setDrawColor(...COLORS.BLACK)
  doc.setLineWidth(BORDER_WIDTH)
  doc.rect(MARGIN, currentY, CONTENT_WIDTH, fromBoxHeight, 'S')

  contentY = currentY + 16
  doc.setTextColor(...COLORS.BLACK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('SUNKOOL SOLUTION', MARGIN + pad, contentY)
  const fromLineSpacing = Math.max(10, (fromBoxHeight - 50) / 4)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'normal')
  contentY += fromLineSpacing
  doc.text('510, WESTERN PALACE, CONGRESS NAGAR, OPP.', MARGIN + pad, contentY)
  contentY += fromLineSpacing
  doc.text('PARK, NAGPUR - 440012', MARGIN + pad, contentY)
  contentY += fromLineSpacing
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('MOB. NO. 9156321123', MARGIN + pad, contentY)

  currentY += fromBoxHeight

  // Final Cleanup
  const orderNum = order.internal_order_number || 'ORD'
  const tId = dispatch.trackingId || 'ID'
  const filename = `Parcel_Slip_${orderNum}_${tId}.pdf`
  const pdfBlob = doc.output('blob')

  return { blob: pdfBlob, filename }
}
