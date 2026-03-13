"use server"

import { createClient } from "@/lib/supabase/server"

export type StockPredictionRow = {
  itemId: string
  itemName: string
  currentStock: number
  demandInPeriod: number
  weeksOfStock: number | null
  status: "low" | "ok" | "excess" | "no_demand"
}

export type FastSlowRow = {
  itemId: string
  itemName: string
  itemType: "inventory" | "product"
  quantityDispatched: number
  classification: "Fast" | "Medium" | "Slow"
}

export type DeadStockRow = {
  itemId: string
  itemName: string
  itemType: "inventory" | "product"
  lastMovementAt: string | null
  daysSinceMovement: number | null
}

const LOW_WEEKS_THRESHOLD = 2
const EXCESS_STOCK_MIN = 10

export async function getStockPrediction(options: { days?: number }): Promise<
  { success: true; data: StockPredictionRow[] } | { success: false; error: string }
> {
  const days = options.days ?? 30
  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().slice(0, 10)

  try {
    const { data: items, error: itemsErr } = await supabase
      .from("inventory_items")
      .select("id, item_name")
      .eq("is_active", true)

    if (itemsErr) return { success: false, error: itemsErr.message }
    if (!items?.length) return { success: true, data: [] }

    const itemIds = items.map((i) => i.id)

    const [
      { data: masterRolls },
      { data: convertable },
      { data: rfd },
      { data: cutAndRoll },
      { data: dispatchItems },
      { data: dispatches },
    ] = await Promise.all([
      supabase.from("master_rolls").select("inventory_item_id, quantity").in("inventory_item_id", itemIds),
      supabase.from("convertable_stock").select("inventory_item_id, front, five_str, seven_str, balance").in("inventory_item_id", itemIds),
      supabase.from("ready_for_dispatch").select("inventory_item_id, in_hand").in("inventory_item_id", itemIds),
      supabase.from("cut_and_roll").select("inventory_item_id, in_hand").in("inventory_item_id", itemIds),
      supabase.from("dispatch_items").select("inventory_item_id, quantity, dispatch_id").in("inventory_item_id", itemIds),
      supabase.from("dispatches").select("id, dispatch_date").gte("dispatch_date", sinceStr).neq("dispatch_type", "return"),
    ])

    const dispatchIdsInPeriod = new Set((dispatches ?? []).map((d) => d.id))
    const demandByItem: Record<string, number> = {}
    for (const di of dispatchItems ?? []) {
      if (!di.inventory_item_id || !dispatchIdsInPeriod.has(di.dispatch_id)) continue
      demandByItem[di.inventory_item_id] = (demandByItem[di.inventory_item_id] ?? 0) + Number(di.quantity ?? 0)
    }

    const stockByItem: Record<string, number> = {}
    for (const r of masterRolls ?? []) {
      if (!r.inventory_item_id) continue
      stockByItem[r.inventory_item_id] = (stockByItem[r.inventory_item_id] ?? 0) + Number(r.quantity ?? 0)
    }
    for (const c of convertable ?? []) {
      if (!c.inventory_item_id) continue
      const sum = Number(c.front ?? 0) + Number(c.five_str ?? 0) + Number(c.seven_str ?? 0) + Number(c.balance ?? 0)
      stockByItem[c.inventory_item_id] = (stockByItem[c.inventory_item_id] ?? 0) + sum
    }
    for (const r of rfd ?? []) {
      if (!r.inventory_item_id) continue
      stockByItem[r.inventory_item_id] = (stockByItem[r.inventory_item_id] ?? 0) + Number(r.in_hand ?? 0)
    }
    for (const r of cutAndRoll ?? []) {
      if (!r.inventory_item_id) continue
      stockByItem[r.inventory_item_id] = (stockByItem[r.inventory_item_id] ?? 0) + Number(r.in_hand ?? 0)
    }

    const weeksPerDay = 7 / days
    const rows: StockPredictionRow[] = items.map((item) => {
      const currentStock = stockByItem[item.id] ?? 0
      const demandInPeriod = demandByItem[item.id] ?? 0
      let weeksOfStock: number | null = null
      let status: StockPredictionRow["status"] = "no_demand"
      if (demandInPeriod > 0) {
        weeksOfStock = currentStock / (demandInPeriod * weeksPerDay)
        status = weeksOfStock < LOW_WEEKS_THRESHOLD ? "low" : "ok"
      } else {
        if (currentStock >= EXCESS_STOCK_MIN) status = "excess"
        else if (currentStock > 0) status = "ok"
      }
      return {
        itemId: item.id,
        itemName: item.item_name ?? "—",
        currentStock: Math.round(currentStock * 100) / 100,
        demandInPeriod,
        weeksOfStock: weeksOfStock != null ? Math.round(weeksOfStock * 10) / 10 : null,
        status,
      }
    })

    return { success: true, data: rows }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch stock prediction"
    return { success: false, error: message }
  }
}

export async function getFastSlowMoving(options: { days?: number }): Promise<
  { success: true; data: FastSlowRow[] } | { success: false; error: string }
> {
  const days = options.days ?? 30
  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().slice(0, 10)

  try {
    const { data: dispatches, error: dispErr } = await supabase
      .from("dispatches")
      .select("id")
      .gte("dispatch_date", sinceStr)
      .neq("dispatch_type", "return")

    if (dispErr) return { success: false, error: dispErr.message }
    const dispatchIds = (dispatches ?? []).map((d) => d.id)
    if (dispatchIds.length === 0) return { success: true, data: [] }

    const { data: dispatchItems, error: diErr } = await supabase
      .from("dispatch_items")
      .select("inventory_item_id, product_id, quantity")
      .in("dispatch_id", dispatchIds)

    if (diErr) return { success: false, error: diErr.message }

    const byInv: Record<string, number> = {}
    const byProd: Record<string, number> = {}
    for (const di of dispatchItems ?? []) {
      const qty = Number(di.quantity ?? 0)
      if (di.inventory_item_id) {
        byInv[di.inventory_item_id] = (byInv[di.inventory_item_id] ?? 0) + qty
      }
      if (di.product_id) {
        byProd[di.product_id] = (byProd[di.product_id] ?? 0) + qty
      }
    }

    const invIds = Object.keys(byInv)
    const prodIds = Object.keys(byProd)
    const invNames = invIds.length
      ? await supabase.from("inventory_items").select("id, item_name").in("id", invIds)
      : { data: [] }
    const prodNames = prodIds.length
      ? await supabase.from("products").select("id, name").in("id", prodIds)
      : { data: [] }

    const nameByInv: Record<string, string> = {}
    for (const r of invNames.data ?? []) {
      nameByInv[r.id] = (r as { item_name?: string }).item_name ?? (r as { name?: string }).name ?? "—"
    }
    const nameByProd: Record<string, string> = {}
    for (const r of prodNames.data ?? []) {
      nameByProd[r.id] = (r as { name?: string }).name ?? "—"
    }

    const list: FastSlowRow[] = [
      ...invIds.map((id) => ({
        itemId: id,
        itemName: nameByInv[id] ?? "—",
        itemType: "inventory" as const,
        quantityDispatched: byInv[id] ?? 0,
        classification: "Medium" as const,
      })),
      ...prodIds.map((id) => ({
        itemId: id,
        itemName: nameByProd[id] ?? "—",
        itemType: "product" as const,
        quantityDispatched: byProd[id] ?? 0,
        classification: "Medium" as const,
      })),
    ].sort((a, b) => b.quantityDispatched - a.quantityDispatched)

    if (list.length === 0) return { success: true, data: [] }
    const n = list.length
    const fastCount = Math.max(1, Math.ceil(n / 3))
    const slowStart = n - Math.max(1, Math.floor(n / 3))
    list.forEach((row, i) => {
      if (i < fastCount) row.classification = "Fast"
      else if (i >= slowStart) row.classification = "Slow"
      else row.classification = "Medium"
    })

    return { success: true, data: list }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch fast/slow moving"
    return { success: false, error: message }
  }
}

export async function getDeadStock(options: { daysNoMovement?: number }): Promise<
  { success: true; data: DeadStockRow[] } | { success: false; error: string }
> {
  const days = options.daysNoMovement ?? 90
  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().slice(0, 10)
  const todayStr = new Date().toISOString().slice(0, 10)

  try {
    const { data: dispatchesInPeriod } = await supabase
      .from("dispatches")
      .select("id, dispatch_date")
      .gte("dispatch_date", sinceStr)
      .neq("dispatch_type", "return")
    const dispatchIds = (dispatchesInPeriod ?? []).map((d) => d.id)
    const dateByDisp: Record<string, string> = {}
    for (const d of dispatchesInPeriod ?? []) {
      dateByDisp[d.id] = (d as { dispatch_date?: string }).dispatch_date ?? ""
    }

    const movementByInv: Record<string, { qty: number; lastDate: string }> = {}
    const movementByProd: Record<string, { qty: number; lastDate: string }> = {}
    if (dispatchIds.length > 0) {
      const { data: dispatchItems } = await supabase
        .from("dispatch_items")
        .select("inventory_item_id, product_id, quantity, dispatch_id")
        .in("dispatch_id", dispatchIds)
      for (const di of dispatchItems ?? []) {
        const qty = Number(di.quantity ?? 0)
        const date = dateByDisp[di.dispatch_id] ?? ""
        if (di.inventory_item_id) {
          const cur = movementByInv[di.inventory_item_id]
          if (!cur) movementByInv[di.inventory_item_id] = { qty, lastDate: date }
          else {
            cur.qty += qty
            if (date > cur.lastDate) cur.lastDate = date
          }
        }
        if (di.product_id) {
          const cur = movementByProd[di.product_id]
          if (!cur) movementByProd[di.product_id] = { qty, lastDate: date }
          else {
            cur.qty += qty
            if (date > cur.lastDate) cur.lastDate = date
          }
        }
      }
    }

    const { data: invItems } = await supabase
      .from("inventory_items")
      .select("id, item_name")
      .eq("is_active", true)
    const { data: products } = await supabase
      .from("products")
      .select("id, name")

    const invRows: DeadStockRow[] = (invItems ?? [])
      .filter((item) => (movementByInv[item.id]?.qty ?? 0) === 0)
      .map((item) => {
        const mov = movementByInv[item.id]
        const lastMovementAt = mov?.lastDate ?? null
        const daysSinceMovement =
          lastMovementAt == null
            ? null
            : Math.floor((new Date(todayStr).getTime() - new Date(lastMovementAt).getTime()) / (24 * 60 * 60 * 1000))
        return {
          itemId: item.id,
          itemName: (item as { item_name?: string }).item_name ?? "—",
          itemType: "inventory",
          lastMovementAt,
          daysSinceMovement,
        }
      })

    const prodRows: DeadStockRow[] = (products ?? [])
      .filter((p) => (movementByProd[p.id]?.qty ?? 0) === 0)
      .map((p) => {
        const mov = movementByProd[p.id]
        const lastMovementAt = mov?.lastDate ?? null
        const daysSinceMovement =
          lastMovementAt == null
            ? null
            : Math.floor((new Date(todayStr).getTime() - new Date(lastMovementAt).getTime()) / (24 * 60 * 60 * 1000))
        return {
          itemId: p.id,
          itemName: (p as { name?: string }).name ?? "—",
          itemType: "product",
          lastMovementAt,
          daysSinceMovement,
        }
      })

    const allRows = [...invRows, ...prodRows].sort((a, b) => {
      const aDays = a.daysSinceMovement ?? 9999
      const bDays = b.daysSinceMovement ?? 9999
      return bDays - aDays
    })

    return { success: true, data: allRows }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch dead stock"
    return { success: false, error: message }
  }
}
