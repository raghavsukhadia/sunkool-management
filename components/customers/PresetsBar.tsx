"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { CustomerPreset } from "@/components/customers/types"

interface Props {
  presets: CustomerPreset[]
  activePresetId: string | null
  onApply: (preset: CustomerPreset) => void
  onSaveCurrent: (name: string) => void
}

export function PresetsBar({ presets, activePresetId, onApply, onSaveCurrent }: Props) {
  const [name, setName] = useState("")

  return (
    <div className="space-y-2 rounded-xl border border-sk-border bg-sk-card-bg p-3">
      <div className="flex flex-wrap items-center gap-2">
        {presets.map(preset => (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant={activePresetId === preset.id ? "default" : "outline"}
            className={activePresetId === preset.id ? "bg-sk-primary hover:bg-sk-primary-dk" : ""}
            onClick={() => onApply(preset)}
          >
            {preset.name}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Save current filters as preset"
          className="sm:max-w-[300px]"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (!name.trim()) return
            onSaveCurrent(name.trim())
            setName("")
          }}
        >
          Save Preset
        </Button>
      </div>
    </div>
  )
}
