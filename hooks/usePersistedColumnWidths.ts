import type { CSSProperties } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

export type ColumnWidthRule = {
  id: string
  defaultWidth: number
  min: number
  max: number
  /** When false, column width is fixed at default. */
  resizable?: boolean
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** Defaults match Production Queue `<colgroup>` in `app/dashboard/production/page.tsx`. */
export const PRODUCTION_QUEUE_COLUMNS: ColumnWidthRule[] = [
  { id: "checkbox", defaultWidth: 36, min: 36, max: 36, resizable: false },
  { id: "orderNumber", defaultWidth: 82, min: 64, max: 140 },
  { id: "activeBatch", defaultWidth: 100, min: 72, max: 240 },
  { id: "customerName", defaultWidth: 152, min: 120, max: 480 },
  { id: "orderDate", defaultWidth: 90, min: 72, max: 140 },
  { id: "itemName", defaultWidth: 162, min: 100, max: 420 },
  { id: "ordered", defaultWidth: 74, min: 56, max: 110 },
  { id: "produced", defaultWidth: 74, min: 56, max: 110 },
  { id: "rp", defaultWidth: 58, min: 48, max: 100 },
  { id: "remaining", defaultWidth: 80, min: 64, max: 130 },
  { id: "link", defaultWidth: 66, min: 56, max: 120 },
]

export function usePersistedColumnWidths(storageKey: string, columns: ColumnWidthRule[]) {
  const defaults = useMemo(() => {
    const o: Record<string, number> = {}
    for (const c of columns) o[c.id] = c.defaultWidth
    return o
  }, [columns])

  const limitsById = useMemo(() => {
    const m = new Map<string, { min: number; max: number }>()
    for (const c of columns) m.set(c.id, { min: c.min, max: c.max })
    return m
  }, [columns])

  const [widths, setWidths] = useState<Record<string, number>>(defaults)
  const latestWidthsRef = useRef(widths)
  latestWidthsRef.current = widths

  const hydratedRef = useRef(false)
  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    if (typeof window === "undefined") return
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const next = { ...defaults }
      for (const id of Object.keys(next)) {
        const v = parsed[id]
        const lim = limitsById.get(id)
        if (lim && typeof v === "number" && Number.isFinite(v)) {
          next[id] = clamp(v, lim.min, lim.max)
        }
      }
      latestWidthsRef.current = next
      setWidths(next)
    } catch {
      /* ignore corrupt storage */
    }
  }, [storageKey, defaults, limitsById])

  const saveWidths = useCallback((w: Record<string, number>) => {
    try {
      if (typeof window !== "undefined") localStorage.setItem(storageKey, JSON.stringify(w))
    } catch {
      /* quota / private mode */
    }
  }, [storageKey])

  const dragState = useRef<{ columnId: string; startPointerX: number; startWidth: number } | null>(null)
  const [isResizing, setIsResizing] = useState(false)

  const beginResize = useCallback(
    (columnId: string, clientX: number) => {
      const col = columns.find((c) => c.id === columnId)
      if (!col || col.resizable === false) return
      const startWidth = latestWidthsRef.current[columnId] ?? col.defaultWidth
      dragState.current = { columnId, startPointerX: clientX, startWidth }
      setIsResizing(true)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
    },
    [columns]
  )

  useEffect(() => {
    if (!isResizing) return

    const onMove = (e: PointerEvent) => {
      const d = dragState.current
      if (!d) return
      const lim = limitsById.get(d.columnId)
      if (!lim) return
      const dx = e.clientX - d.startPointerX
      const nextW = clamp(d.startWidth + dx, lim.min, lim.max)
      setWidths((prev) => {
        const next = { ...prev, [d.columnId]: nextW }
        latestWidthsRef.current = next
        return next
      })
    }

    const onUp = () => {
      dragState.current = null
      setIsResizing(false)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      saveWidths(latestWidthsRef.current)
    }

    document.addEventListener("pointermove", onMove)
    document.addEventListener("pointerup", onUp)
    document.addEventListener("pointercancel", onUp)
    return () => {
      document.removeEventListener("pointermove", onMove)
      document.removeEventListener("pointerup", onUp)
      document.removeEventListener("pointercancel", onUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [isResizing, limitsById, saveWidths])

  const resetColumn = useCallback(
    (columnId: string) => {
      const col = columns.find((c) => c.id === columnId)
      if (!col) return
      setWidths((prev) => {
        const next = { ...prev, [columnId]: col.defaultWidth }
        latestWidthsRef.current = next
        saveWidths(next)
        return next
      })
    },
    [columns, saveWidths]
  )

  const resetAll = useCallback(() => {
    const next = { ...defaults }
    latestWidthsRef.current = next
    setWidths(next)
    saveWidths(next)
  }, [defaults, saveWidths])

  const colStyle = useCallback(
    (id: string): CSSProperties => {
      const w = widths[id] ?? defaults[id] ?? 0
      return { width: w, minWidth: w }
    },
    [widths, defaults]
  )

  const minTableWidth = useMemo(
    () => columns.reduce((acc, c) => acc + (widths[c.id] ?? defaults[c.id] ?? c.defaultWidth), 0),
    [columns, widths, defaults]
  )

  return { colStyle, beginResize, isResizing, resetColumn, resetAll, minTableWidth }
}
