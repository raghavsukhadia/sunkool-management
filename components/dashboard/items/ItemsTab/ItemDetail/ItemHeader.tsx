"use client"

import type { ItemSummary } from "@/app/actions/items"

export function ItemHeader({ item }: { item: ItemSummary }) {
  return (
    <section className="flex overflow-hidden rounded-xl border border-sk-border bg-white shadow-md ring-1 ring-slate-200/50">
      <div className="w-1 shrink-0 bg-gradient-to-b from-sk-primary via-sk-primary to-sk-primary-dk" aria-hidden />
      <div className="min-w-0 flex-1 bg-gradient-to-br from-white via-white to-sk-primary/[0.04] px-5 py-5 xl:px-6 xl:py-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-sk-primary">Selected item</p>
        <h2 className="mt-2.5 text-2xl font-bold leading-tight tracking-tight text-sk-text-1 xl:text-3xl xl:leading-tight">
          {item.item_name}
        </h2>
        {item.item_sku ? (
          <p className="mt-2 font-mono text-sm text-sk-text-2">
            <span className="text-sk-text-3">SKU</span> {item.item_sku}
          </p>
        ) : null}
      </div>
    </section>
  )
}
