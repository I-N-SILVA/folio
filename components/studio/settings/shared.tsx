'use client'

import { twMerge } from 'tailwind-merge'
import * as Lucide from 'lucide-react'

// Shared primitives for the settings-panel forms in this directory — one
// form per block/page/hotspot/book type, mirroring the components/blocks/
// per-type layout.

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  )
}

export const inputCls =
  'bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-neutral-500 w-full'

export const selectCls =
  'bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-neutral-500 w-full'

const HOTSPOT_ICONS = [
  'Info', 'Star', 'Zap', 'Sparkles', 'BookOpen', 'BarChart2', 'Play', 'Link',
  'ShoppingBag', 'ShoppingCart', 'Tag', 'Gift', 'Heart', 'MapPin', 'Quote', 'Pencil',
]

export function IconPicker({ value, onChange }: { value?: string; onChange: (name: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {HOTSPOT_ICONS.map((name) => {
        const Ic = (Lucide as any)[name] ?? Lucide.Info
        const active = value === name
        return (
          <button
            type="button"
            key={name}
            title={name}
            onClick={() => onChange(name)}
            className={twMerge(
              'flex aspect-square items-center justify-center rounded-md border transition-colors',
              active
                ? 'border-[var(--accent-vivid)] bg-[var(--accent-vivid)]/20 text-[var(--accent-vivid)]'
                : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:text-neutral-200'
            )}
          >
            <Ic size={16} />
          </button>
        )
      })}
    </div>
  )
}
