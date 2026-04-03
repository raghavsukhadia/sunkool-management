import jsPDF from 'jspdf'
import type { ProductionQueueRow } from '@/app/actions/production'

// --- Colors ---
const ORANGE: [number, number, number] = [234, 88, 12]
const SLATE: [number, number, number] = [30, 41, 59]
const GRAY: [number, number, number] = [100, 116, 139]
const LIGHT_BG: [number, number, number] = [248, 250, 252]
const BORDER: [number, number, number] = [226, 232, 240]
const RED: [number, number, number] = [220, 38, 38]
const AMBER: [number, number, number] = [217, 119, 6]
const GREEN: [number, number, number] = [22, 163, 74]
const WHITE: [number, number, number] = [255, 255, 255]
const ORANGE_LIGHT: [number, number, number] = [255, 237, 213]
const RED_LIGHT: [number, number, number] = [254, 226, 226]
const GREEN_LIGHT: [number, number, number] = [220, 252, 231]

// --- Aggregated order row ---
type OrderSummaryRow = {
  orderId: string
  orderNumber: string
  customerName: string
  itemCount: number
  itemNames: string
  ordered: number
  produced: number
  remaining: number
  status: string
  ageDays: number
  orderDate: string | null
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

function statusLabel(row: OrderSummaryRow): string {
  if (row.status === 'needs_closure') return 'Needs Closure'
  if (row.status === 'in_progress') return 'In Progress'
  return 'Not Started'
}

function aggregateRows(rows: ProductionQueueRow[]): OrderSummaryRow[] {
  const map = new Map<string, OrderSummaryRow>()

  for (const r of rows) {
    if (map.has(r.orderId)) {
      const existing = map.get(r.orderId)!
      existing.ordered += r.ordered
      existing.produced += r.producedCompleted
      existing.remaining += r.remainingUntilDone
      existing.itemCount += 1
      if (!existing.itemNames.includes(r.itemName)) {
        existing.itemNames = existing.itemNames
          ? `${existing.itemNames}, ${r.itemName}`
          : r.itemName
      }
      // Upgrade status
      if (r.needsBatchClosure && existing.status !== 'in_progress') {
        existing.status = 'needs_closure'
      } else if (r.hasInProductionRecord && existing.status === 'not_started') {
        existing.status = 'in_progress'
      }
    } else {
      let status = 'not_started'
      if (r.needsBatchClosure) status = 'needs_closure'
      else if (r.hasInProductionRecord) status = 'in_progress'

      map.set(r.orderId, {
        orderId: r.orderId,
        orderNumber: r.orderNumber,
        customerName: r.customerName,
        itemCount: 1,
        itemNames: r.itemName,
        ordered: r.ordered,
        produced: r.producedCompleted,
        remaining: r.remainingUntilDone,
        status,
        ageDays: daysSince(r.orderDate),
        orderDate: r.orderDate,
      })
    }
  }

  // Sort: not_started + oldest first, then in_progress, then needs_closure
  return Array.from(map.values()).sort((a, b) => {
    const priorityOf = (s: string) => (s === 'not_started' ? 0 : s === 'in_progress' ? 1 : 2)
    const pa = priorityOf(a.status)
    const pb = priorityOf(b.status)
    if (pa !== pb) return pa - pb
    return b.ageDays - a.ageDays
  })
}

export function generateMorningReportPDF(
  rows: ProductionQueueRow[],
  logoDataUrl?: string
): { blob: Blob; filename: string } {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })

  const MARGIN = 14
  const PAGE_WIDTH = doc.internal.pageSize.getWidth()
  const PAGE_HEIGHT = doc.internal.pageSize.getHeight()
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

  const orders = aggregateRows(rows)
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
    hour12: true,
  })

  const totalOrders = orders.length
  const totalUnits = orders.reduce((s, o) => s + o.remaining, 0)
  const notStarted = orders.filter((o) => o.status === 'not_started').length
  const delayed = orders.filter((o) => o.ageDays > 5).length

  let y = 0

  // ---- Helpers ----
  const setFont = (style: 'normal' | 'bold' | 'italic' | 'bolditalic', size: number) => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
  }
  const setColor = (rgb: [number, number, number]) => {
    doc.setTextColor(rgb[0], rgb[1], rgb[2])
  }
  const fillRect = (x: number, ry: number, w: number, h: number, rgb: [number, number, number]) => {
    doc.setFillColor(rgb[0], rgb[1], rgb[2])
    doc.rect(x, ry, w, h, 'F')
  }
  const strokeRect = (
    x: number,
    ry: number,
    w: number,
    h: number,
    rgb: [number, number, number],
    lw = 0.3
  ) => {
    doc.setDrawColor(rgb[0], rgb[1], rgb[2])
    doc.setLineWidth(lw)
    doc.rect(x, ry, w, h, 'S')
  }

  // ---- Draw page header ----
  const drawPageHeader = () => {
    y = 12

    // Logo or text brand
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', MARGIN, y - 7, 32, 11)
    } else {
      setFont('bolditalic', 22)
      setColor(ORANGE)
      doc.text('Sun', MARGIN, y + 1)
      const sunW = doc.getTextWidth('Sun')
      setColor(SLATE)
      doc.text('kool', MARGIN + sunW - 1, y + 1)
    }

    // Right: company name + report title
    setFont('bold', 9)
    setColor(SLATE)
    doc.text('SUN KOOL SOLUTION', PAGE_WIDTH - MARGIN, y - 4, { align: 'right' })
    setFont('normal', 7.5)
    setColor(GRAY)
    doc.text('Morning Production Report', PAGE_WIDTH - MARGIN, y, { align: 'right' })
    doc.text(`${dateStr}  •  Generated at ${timeStr} IST`, PAGE_WIDTH - MARGIN, y + 4.5, {
      align: 'right',
    })

    y += 8
    doc.setDrawColor(ORANGE[0], ORANGE[1], ORANGE[2])
    doc.setLineWidth(0.7)
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
    y += 5
  }

  // ---- PAGE 1 ----
  drawPageHeader()

  // Report title
  setFont('bold', 14)
  setColor(SLATE)
  doc.text('Pending Production Orders', MARGIN, y + 1)
  y += 8

  // Summary boxes
  const summaryItems = [
    { label: 'Total Pending Orders', value: String(totalOrders), color: ORANGE },
    { label: 'Total Units Remaining', value: String(totalUnits), color: SLATE },
    { label: 'Not Started', value: String(notStarted), color: RED },
    { label: 'Production Delayed (>5d)', value: String(delayed), color: AMBER },
  ]
  const boxW = (CONTENT_WIDTH - 9) / 4
  summaryItems.forEach((item, i) => {
    const bx = MARGIN + i * (boxW + 3)
    fillRect(bx, y, boxW, 18, LIGHT_BG)
    strokeRect(bx, y, boxW, 18, BORDER)
    // top accent bar
    fillRect(bx, y, boxW, 2, item.color)
    setFont('bold', 14)
    setColor(item.color)
    doc.text(item.value, bx + boxW / 2, y + 11, { align: 'center' })
    setFont('normal', 6.5)
    setColor(GRAY)
    doc.text(item.label, bx + boxW / 2, y + 16, { align: 'center' })
  })
  y += 24

  // Table header
  const COL = {
    NUM: 8,
    ORDER: 22,
    CUSTOMER: 38,
    ITEMS: 35,
    ORDERED: 16,
    PRODUCED: 16,
    REMAINING: 18,
    STATUS: 22,
    AGE: 0, // fill remaining
  }
  COL.AGE = CONTENT_WIDTH - Object.values(COL).reduce((a, b) => a + b, 0)

  const drawTableHeader = () => {
    const hh = 8
    fillRect(MARGIN, y, CONTENT_WIDTH, hh, SLATE)
    setFont('bold', 6.5)
    setColor(WHITE)
    let cx = MARGIN + 1.5
    const headers = [
      ['#', COL.NUM],
      ['ORDER', COL.ORDER],
      ['CUSTOMER', COL.CUSTOMER],
      ['ITEMS', COL.ITEMS],
      ['ORDERED', COL.ORDERED],
      ['PRODUCED', COL.PRODUCED],
      ['REMAINING', COL.REMAINING],
      ['STATUS', COL.STATUS],
      ['AGE (d)', COL.AGE],
    ] as [string, number][]

    for (const [label, w] of headers) {
      doc.text(label, cx + w / 2, y + 5.2, { align: 'center' })
      cx += w
    }
    y += hh
  }

  drawTableHeader()

  // Table rows
  let rowIndex = 0
  for (const order of orders) {
    const rowH = 9
    if (y + rowH > PAGE_HEIGHT - 20) {
      doc.addPage()
      drawPageHeader()
      drawTableHeader()
    }

    const bg: [number, number, number] = rowIndex % 2 === 0 ? WHITE : LIGHT_BG
    fillRect(MARGIN, y, CONTENT_WIDTH, rowH, bg)
    strokeRect(MARGIN, y, CONTENT_WIDTH, rowH, BORDER, 0.2)

    const textY = y + 5.8
    setFont('normal', 6.5)
    setColor(SLATE)

    let cx = MARGIN + 1.5

    // #
    doc.text(String(rowIndex + 1), cx + COL.NUM / 2, textY, { align: 'center' })
    cx += COL.NUM

    // Order
    setFont('bold', 6.5)
    setColor(ORANGE)
    doc.text(order.orderNumber.substring(0, 12), cx + 1, textY)
    setFont('normal', 6.5)
    setColor(SLATE)
    cx += COL.ORDER

    // Customer
    const custTrunc = order.customerName.length > 22 ? order.customerName.slice(0, 21) + '…' : order.customerName
    doc.text(custTrunc, cx + 1, textY)
    cx += COL.CUSTOMER

    // Items
    const itemsTrunc = order.itemNames.length > 22 ? order.itemNames.slice(0, 21) + '…' : order.itemNames
    setColor(GRAY)
    setFont('normal', 6)
    doc.text(itemsTrunc, cx + 1, textY)
    setFont('normal', 6.5)
    setColor(SLATE)
    cx += COL.ITEMS

    // Ordered
    doc.text(String(order.ordered), cx + COL.ORDERED / 2, textY, { align: 'center' })
    cx += COL.ORDERED

    // Produced
    doc.text(String(order.produced), cx + COL.PRODUCED / 2, textY, { align: 'center' })
    cx += COL.PRODUCED

    // Remaining
    setFont('bold', 6.5)
    const remColor: [number, number, number] = order.remaining > 50 ? RED : order.remaining > 0 ? AMBER : GREEN
    setColor(remColor)
    doc.text(String(order.remaining), cx + COL.REMAINING / 2, textY, { align: 'center' })
    setFont('normal', 6.5)
    setColor(SLATE)
    cx += COL.REMAINING

    // Status badge
    let badgeBg: [number, number, number] = LIGHT_BG
    let badgeFg: [number, number, number] = SLATE
    const sl = statusLabel(order)
    if (order.status === 'not_started') { badgeBg = RED_LIGHT; badgeFg = RED }
    else if (order.status === 'in_progress') { badgeBg = ORANGE_LIGHT; badgeFg = ORANGE }
    else { badgeBg = GREEN_LIGHT; badgeFg = GREEN }
    fillRect(cx + 1, y + 1.5, COL.STATUS - 2, rowH - 3, badgeBg)
    setFont('bold', 5.5)
    setColor(badgeFg)
    doc.text(sl, cx + COL.STATUS / 2, textY, { align: 'center' })
    setFont('normal', 6.5)
    setColor(SLATE)
    cx += COL.STATUS

    // Age
    const ageColor: [number, number, number] = order.ageDays > 7 ? RED : SLATE
    setColor(ageColor)
    setFont(order.ageDays > 7 ? 'bold' : 'normal', 6.5)
    doc.text(String(order.ageDays), cx + COL.AGE / 2, textY, { align: 'center' })
    setFont('normal', 6.5)
    setColor(SLATE)

    y += rowH
    rowIndex++
  }

  if (orders.length === 0) {
    fillRect(MARGIN, y, CONTENT_WIDTH, 14, LIGHT_BG)
    setFont('normal', 9)
    setColor(GRAY)
    doc.text('No pending production orders.', PAGE_WIDTH / 2, y + 9, { align: 'center' })
    y += 14
  }

  // Footer page 1
  setFont('normal', 6.5)
  setColor(GRAY)
  doc.text(
    'Auto-generated at 9:55 AM IST  ·  Sunkool Production Management',
    PAGE_WIDTH / 2,
    PAGE_HEIGHT - 8,
    { align: 'center' }
  )

  // ---- PAGE 2 — Smart Insights ----
  doc.addPage()
  drawPageHeader()

  setFont('bold', 14)
  setColor(SLATE)
  doc.text('Smart Insights & Recommendations', MARGIN, y + 1)
  y += 10

  // Section helper
  const drawInsightSection = (
    emoji: string,
    title: string,
    insightOrders: OrderSummaryRow[],
    accentColor: [number, number, number],
    bgColor: [number, number, number],
    getAction: (o: OrderSummaryRow) => string
  ) => {
    if (insightOrders.length === 0) return

    if (y + 14 > PAGE_HEIGHT - 20) {
      doc.addPage()
      drawPageHeader()
    }

    // Section header bar
    fillRect(MARGIN, y, CONTENT_WIDTH, 9, accentColor)
    setFont('bold', 8)
    setColor(WHITE)
    doc.text(`${emoji}  ${title}`, MARGIN + 3, y + 6)
    y += 9

    for (const order of insightOrders) {
      const cardH = 14
      if (y + cardH > PAGE_HEIGHT - 20) {
        doc.addPage()
        drawPageHeader()
      }

      fillRect(MARGIN, y, CONTENT_WIDTH, cardH, bgColor)
      strokeRect(MARGIN, y, CONTENT_WIDTH, cardH, BORDER, 0.2)

      // Left: order info
      setFont('bold', 7.5)
      setColor(SLATE)
      doc.text(`${order.orderNumber}`, MARGIN + 3, y + 5.5)

      setFont('normal', 6.5)
      setColor(GRAY)
      doc.text(`${order.customerName}`, MARGIN + 3, y + 10)

      // Middle: what's pending
      const pendingText = `${order.remaining} units remaining of ${order.ordered} ordered`
      setFont('normal', 6.5)
      setColor(SLATE)
      doc.text(pendingText, MARGIN + 55, y + 5.5)
      setFont('normal', 6)
      setColor(GRAY)
      doc.text(`Age: ${order.ageDays} days  •  ${order.itemCount} item(s)`, MARGIN + 55, y + 10)

      // Right: recommended action
      const action = getAction(order)
      setFont('bold', 6.5)
      setColor(accentColor)
      const actionTrunc = action.length > 45 ? action.slice(0, 44) + '…' : action
      doc.text(actionTrunc, PAGE_WIDTH - MARGIN - 3, y + 5.5, { align: 'right' })

      y += cardH + 2
    }

    y += 4
  }

  const takeActionNow = orders.filter(
    (o) => (o.status === 'not_started' && o.ageDays > 5) || o.remaining > 100
  )
  const completeToday = orders.filter(
    (o) => o.status === 'in_progress' && o.remaining > 0
  )
  const almostDone = orders.filter(
    (o) => o.ordered > 0 && o.remaining / o.ordered < 0.2 && o.remaining > 0
  )

  drawInsightSection(
    '🔴',
    'Take Action Now',
    takeActionNow,
    RED,
    RED_LIGHT,
    (o) => {
      if (o.ageDays > 5 && o.status === 'not_started') return 'Start production immediately — overdue'
      if (o.remaining > 100) return `High volume order — prioritise (${o.remaining} units left)`
      return 'Assign production team urgently'
    }
  )

  drawInsightSection(
    '🟠',
    'Complete Today',
    completeToday,
    AMBER,
    ORANGE_LIGHT,
    (o) => {
      if (o.remaining <= 20) return 'Almost done — finish & close batch today'
      return `${o.remaining} units left — push to complete by EOD`
    }
  )

  drawInsightSection(
    '🟢',
    'Almost Done',
    almostDone,
    GREEN,
    GREEN_LIGHT,
    (o) => {
      const pct = Math.round(((o.ordered - o.remaining) / o.ordered) * 100)
      return `${pct}% done — close batch when complete`
    }
  )

  if (takeActionNow.length === 0 && completeToday.length === 0 && almostDone.length === 0) {
    fillRect(MARGIN, y, CONTENT_WIDTH, 18, LIGHT_BG)
    setFont('normal', 9)
    setColor(GRAY)
    doc.text('No actionable insights at this time.', PAGE_WIDTH / 2, y + 11, { align: 'center' })
    y += 18
  }

  // Footer page 2
  setFont('normal', 6.5)
  setColor(GRAY)
  doc.text(
    'Auto-generated at 9:55 AM IST  ·  Sunkool Production Management',
    PAGE_WIDTH / 2,
    PAGE_HEIGHT - 8,
    { align: 'center' }
  )

  const filename = `Morning_Production_Report_${now.toISOString().slice(0, 10)}.pdf`
  const blob = doc.output('blob')
  return { blob, filename }
}
