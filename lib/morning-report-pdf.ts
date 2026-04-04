/**
 * Morning Production Report PDF
 *
 * Mirrors the Production Queue Excel export exactly:
 *   Columns : # | Order # | Order Date | Customer | Item | Active Batch |
 *             Ordered | Produced | RP | Remaining | Status
 *   Status  : "In Progress" or "Pending"  (same as getQueueRowStatus in the app)
 *   Data    : Produced  = row.producedCompleted    (= getProducedForDisplay)
 *             RP        = produced − producedCompleted (= getRequestedProduction)
 *             Remaining = row.remainingUntilDone   (= getRemainingUntilDone)
 */
import jsPDF from 'jspdf'
import type { ProductionQueueRow } from '@/app/actions/production'

// ─── Palette — matches Excel export (xlsx-js-style colours in production page) ──
const BRAND_DARK:  [number,number,number] = [ 30,  41,  59]   // #1E293B slate-900
const BRAND_ORA:   [number,number,number] = [234,  88,  12]   // #EA580C orange-600
const ORA_50:      [number,number,number] = [255, 247, 237]   // #FFF7ED orange-50 (alt row)
const WHITE:       [number,number,number] = [255, 255, 255]
const BORDER:      [number,number,number] = [226, 232, 240]   // #E2E8F0 slate-200
const TEXT_DARK:   [number,number,number] = [ 15,  23,  42]   // #0F172A slate-950
const TEXT_MUTED:  [number,number,number] = [100, 116, 139]   // #64748B slate-500
// Status badges
const BLUE_FG:     [number,number,number] = [ 30,  64, 175]   // #1E40AF blue-800
const BLUE_BG:     [number,number,number] = [219, 234, 254]   // #DBEAFE blue-100
const AMBER_FG:    [number,number,number] = [146,  64,  14]   // #92400E amber-800
const AMBER_BG:    [number,number,number] = [254, 243, 199]   // #FEF3C7 amber-100
// Remaining colours (same thresholds as sRemaining in the app)
const REM_GREEN:   [number,number,number] = [ 22, 101,  52]   // #166534 green-800
const REM_AMBER:   [number,number,number] = [146,  64,  14]   // #92400E amber-800
const REM_RED:     [number,number,number] = [153,  27,  27]   // #991B1B red-800

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Mirrors getQueueRowStatus — exactly two values used in the app */
function queueStatus(row: ProductionQueueRow): 'In Progress' | 'Pending' {
  if (row.hasInProductionRecord || row.produced > 0) return 'In Progress'
  return 'Pending'
}

function remColor(val: number): [number,number,number] {
  if (val === 0)   return REM_GREEN
  if (val > 100)   return REM_RED
  if (val > 20)    return REM_AMBER
  return TEXT_DARK
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function trunc(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '\u2026' : s
}

// ─── PDF generator ────────────────────────────────────────────────────────────
export function generateMorningReportPDF(
  rows: ProductionQueueRow[],
  logoDataUrl?: string
): { blob: Blob; filename: string } {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
  const PW  = doc.internal.pageSize.getWidth()   // 210 mm
  const PH  = doc.internal.pageSize.getHeight()  // 297 mm
  const M   = 12   // left / right margin
  const CW  = PW - M * 2                         // 186 mm content width

  const now     = new Date()
  const dateStr = now.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  })
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata', hour12: true,
  })

  // ── Sort: In Progress first, then Pending; within each group by orderNumber ─
  const sorted = [...rows].sort((a, b) => {
    const sa = queueStatus(a) === 'In Progress' ? 0 : 1
    const sb = queueStatus(b) === 'In Progress' ? 0 : 1
    if (sa !== sb) return sa - sb
    return a.orderNumber.localeCompare(b.orderNumber, undefined, { numeric: true, sensitivity: 'base' })
  })

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalOrdered   = sorted.reduce((s, r) => s + r.ordered, 0)
  const totalRemaining = sorted.reduce((s, r) => s + r.remainingUntilDone, 0)
  const inProgressCnt  = sorted.filter(r => queueStatus(r) === 'In Progress').length
  const pendingCnt     = sorted.filter(r => queueStatus(r) === 'Pending').length
  const orderCount     = new Set(sorted.map(r => r.orderId)).size

  // ── Drawing helpers ───────────────────────────────────────────────────────
  let y    = 0
  let page = 1

  const sf = (style: 'normal' | 'bold', size: number) => {
    doc.setFont('helvetica', style); doc.setFontSize(size)
  }
  const sc = (rgb: [number,number,number]) => doc.setTextColor(rgb[0], rgb[1], rgb[2])
  const fr = (x: number, ry: number, w: number, h: number, rgb: [number,number,number]) => {
    doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.rect(x, ry, w, h, 'F')
  }

  // ── Page header ───────────────────────────────────────────────────────────
  const drawHeader = () => {
    y = 0
    // Dark slate band
    fr(0, 0, PW, 21, BRAND_DARK)

    if (logoDataUrl) {
      fr(M, 3, 44, 15, WHITE)
      doc.addImage(logoDataUrl, 'PNG', M + 1, 3.5, 42, 14)
    } else {
      sf('bold', 18); sc(BRAND_ORA)
      doc.text('SUNKOOL', M, 14)
      sf('normal', 6); sc([148, 163, 184])
      doc.text('PRODUCTION MANAGEMENT', M, 18.5)
    }

    sf('bold', 8.5); sc(WHITE)
    doc.text('MORNING PRODUCTION REPORT', PW - M, 10, { align: 'right' })
    sf('normal', 6.5); sc([148, 163, 184])
    doc.text(`${dateStr}  |  ${timeStr} IST`, PW - M, 15.5, { align: 'right' })

    // Orange accent line
    fr(0, 21, PW, 2.5, BRAND_ORA)
    y = 27
  }

  // ── Page footer ───────────────────────────────────────────────────────────
  const drawFooter = () => {
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2])
    doc.setLineWidth(0.25)
    doc.line(M, PH - 10, PW - M, PH - 10)
    sf('normal', 6); sc(TEXT_MUTED)
    doc.text('Sunkool Production Management System  |  Confidential', M, PH - 6.5)
    doc.text(`Page ${page}`, PW - M, PH - 6.5, { align: 'right' })
  }

  const addPage = () => {
    drawFooter()
    doc.addPage(); page++
    drawHeader()
  }
  const checkBreak = (needed: number) => {
    if (y + needed > PH - 13) addPage()
  }

  // ── Column widths (CW = 186 mm) ───────────────────────────────────────────
  // # 6 | Order# 19 | Date 17 | Customer 31 | Item 38 | Batch 19
  // | Ord 11 | Prod 11 | RP 9 | Rem 11 | Status 14
  // Total = 6+19+17+31+38+19+11+11+9+11+14 = 186 ✓
  const W = { num:6, ord:19, date:17, cust:31, item:38, batch:19, oqty:11, prod:11, rp:9, rem:11, stat:14 }

  const COL_X = (() => {
    let x = M
    const out: Record<keyof typeof W, number> = {} as never
    for (const [k, w] of Object.entries(W) as [keyof typeof W, number][]) {
      out[k] = x; x += w
    }
    return out
  })()

  const drawTableHeader = () => {
    const hh = 8
    fr(M, y, CW, hh, BRAND_ORA)
    sf('bold', 6); sc(WHITE)

    const headers: [keyof typeof W, string, 'l'|'c'][] = [
      ['num',   '#',            'c'],
      ['ord',   'Order #',      'l'],
      ['date',  'Order Date',   'c'],
      ['cust',  'Customer',     'l'],
      ['item',  'Item',         'l'],
      ['batch', 'Active Batch', 'c'],
      ['oqty',  'Ordered',      'c'],
      ['prod',  'Produced',     'c'],
      ['rp',    'RP',           'c'],
      ['rem',   'Remaining',    'c'],
      ['stat',  'Status',       'c'],
    ]
    for (const [col, lbl, align] of headers) {
      const x = COL_X[col]; const w = W[col]
      if (align === 'c') doc.text(lbl, x + w / 2, y + 5.5, { align: 'center' })
      else               doc.text(lbl, x + 2,     y + 5.5)
    }
    y += hh
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 1 — header + meta strip + table
  // ─────────────────────────────────────────────────────────────────────────
  drawHeader()

  // ── Meta strip (matches Excel title/meta rows) ────────────────────────────
  fr(M, y, CW, 14, [248, 250, 252])
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2])
  doc.setLineWidth(0.25)
  doc.rect(M, y, CW, 14, 'S')

  const metaCols: [string, string][] = [
    ['Date',          dateStr],
    ['Total Orders',  String(orderCount)],
    ['Total Items',   String(sorted.length)],
    ['In Progress',   String(inProgressCnt)],
    ['Pending',       String(pendingCnt)],
    ['Total Ordered', String(totalOrdered)],
    ['Total Rem.',    String(totalRemaining)],
  ]
  const mw = CW / metaCols.length
  metaCols.forEach(([lbl, val], i) => {
    const mx = M + i * mw
    if (i > 0) {
      doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2])
      doc.setLineWidth(0.25)
      doc.line(mx, y, mx, y + 14)
    }
    sf('normal', 5.5); sc(TEXT_MUTED)
    doc.text(lbl.toUpperCase(), mx + mw / 2, y + 5, { align: 'center' })
    sf('bold', 10); sc(TEXT_DARK)
    doc.text(val, mx + mw / 2, y + 11.5, { align: 'center' })
  })
  y += 18

  // ── Table ─────────────────────────────────────────────────────────────────
  drawTableHeader()

  sorted.forEach((row, idx) => {
    const rh = 7
    checkBreak(rh)

    const alt = idx % 2 === 1
    const bg: [number,number,number] = alt ? ORA_50 : WHITE
    fr(M, y, CW, rh, bg)

    // Bottom border
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2])
    doc.setLineWidth(0.18)
    doc.line(M, y + rh, M + CW, y + rh)

    const ty = y + 4.8

    // # (row number)
    sf('normal', 6); sc(TEXT_MUTED)
    doc.text(String(idx + 1), COL_X.num + W.num / 2, ty, { align: 'center' })

    // Order # (orange bold, left border accent)
    doc.setFillColor(BRAND_ORA[0], BRAND_ORA[1], BRAND_ORA[2])
    doc.rect(M, y, 1.2, rh, 'F')
    sf('bold', 6); sc(BRAND_ORA)
    doc.text(trunc(row.orderNumber, 11), COL_X.ord + 2, ty)

    // Order Date
    sf('normal', 5.8); sc(TEXT_MUTED)
    doc.text(fmtDate(row.orderDate), COL_X.date + W.date / 2, ty, { align: 'center' })

    // Customer
    sf('normal', 6); sc(TEXT_DARK)
    doc.text(trunc(row.customerName, 19), COL_X.cust + 2, ty)

    // Item
    sf('normal', 6); sc(TEXT_DARK)
    doc.text(trunc(row.itemName, 23), COL_X.item + 2, ty)

    // Active Batch
    sf('normal', 5.8); sc(TEXT_MUTED)
    const batchTxt = row.activeBatchLabels?.length
      ? row.activeBatchLabels.join(', ')
      : row.completedBatchLabels?.length
        ? row.completedBatchLabels.join(', ')
        : '—'
    doc.text(trunc(batchTxt, 11), COL_X.batch + W.batch / 2, ty, { align: 'center' })

    // Ordered
    sf('normal', 6); sc(TEXT_DARK)
    doc.text(String(row.ordered), COL_X.oqty + W.oqty / 2, ty, { align: 'center' })

    // Produced (= producedCompleted, matches getProducedForDisplay)
    doc.text(String(row.producedCompleted), COL_X.prod + W.prod / 2, ty, { align: 'center' })

    // RP (= produced − producedCompleted, matches getRequestedProduction)
    const rp = Math.max(0, row.produced - row.producedCompleted)
    if (rp > 0) {
      sf('bold', 6); sc(BLUE_FG)
      doc.text(String(rp), COL_X.rp + W.rp / 2, ty, { align: 'center' })
    } else {
      sf('normal', 6); sc(TEXT_MUTED)
      doc.text('—', COL_X.rp + W.rp / 2, ty, { align: 'center' })
    }

    // Remaining (= remainingUntilDone, matches getRemainingUntilDone)
    const rem = row.remainingUntilDone
    sf('bold', 6); sc(remColor(rem))
    doc.text(String(rem), COL_X.rem + W.rem / 2, ty, { align: 'center' })

    // Status badge
    const status = queueStatus(row)
    const badgeFg = status === 'In Progress' ? BLUE_FG  : AMBER_FG
    const badgeBg = status === 'In Progress' ? BLUE_BG  : AMBER_BG
    fr(COL_X.stat + 0.5, y + 0.8, W.stat - 1, rh - 1.6, badgeBg)
    sf('bold', 5.2); sc(badgeFg)
    doc.text(status, COL_X.stat + W.stat / 2, ty, { align: 'center' })

    y += rh
  })

  // ── Totals row ────────────────────────────────────────────────────────────
  checkBreak(9)
  const th = 9
  fr(M, y, CW, th, BRAND_DARK)
  sf('bold', 6.5); sc(WHITE)
  doc.text('TOTALS', COL_X.cust + 2, y + 6)
  doc.text(String(totalOrdered),   COL_X.oqty + W.oqty / 2, y + 6, { align: 'center' })
  doc.text(String(totalRemaining), COL_X.rem  + W.rem  / 2, y + 6, { align: 'center' })
  y += th

  if (sorted.length === 0) {
    fr(M, y, CW, 14, [240, 253, 244])
    sf('normal', 9); sc(REM_GREEN)
    doc.text('All production is up to date — no pending items today.', PW / 2, y + 9, { align: 'center' })
    y += 14
  }

  drawFooter()

  const filename = `Sunkool_Production_Report_${now.toISOString().slice(0, 10)}.pdf`
  return { blob: doc.output('blob'), filename }
}
