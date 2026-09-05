'use client'

import { twMerge } from 'tailwind-merge'
import { HOTSPOT_ICON_NAMES, hotspotIcon } from '@/lib/hotspot-icons'

// Shared primitives for the settings-panel forms in this directory — one
// form per block/page/hotspot/book type, mirroring the components/blocks/
// per-type layout.

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  /** Short clarification under the control, for anything not self-evident. */
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] leading-4 text-neutral-500">{hint}</p>}
    </div>
  )
}

/**
 * A visible focus state that isn't just a slightly lighter border: the panel is
 * dense and dark, and a 1px border shift is easy to lose. The accent ring also
 * ties the inspector to the selection highlight on the canvas.
 */
const controlBase =
  'w-full rounded-lg border border-neutral-700/80 bg-neutral-950/60 px-2.5 py-2 text-sm text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 hover:border-neutral-600 focus:border-[var(--studio-select)] focus:ring-2 focus:ring-[var(--studio-select)]/25'

export const inputCls = controlBase

/**
 * Native select arrows are drawn by the OS and land as a light grey wedge on
 * near-black — the one control that always gave the panel away as unstyled.
 * The chevron lives in globals.css as `.studio-select`: an inline data-URI in a
 * Tailwind arbitrary value has to survive quote and space escaping, and it
 * silently produced no background at all.
 */
export const selectCls = twMerge(controlBase, 'studio-select appearance-none pr-8')

/** Colour inputs render as a bevelled OS swatch unless the chrome is stripped. */
export const colorInputCls =
  'h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-neutral-700/80 bg-neutral-950/60 p-1 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0'

/** Groups related fields so a long inspector reads as sections, not a list. */
export function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-neutral-800 pb-4 last:border-0 last:pb-0">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">
        {title}
      </h3>
      {children}
    </section>
  )
}

/** A labelled on/off control — checkboxes in a dark panel read as unstyled. */
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-neutral-700/80 bg-neutral-950/60 px-2.5 py-2 text-left text-sm text-neutral-200 transition-colors hover:border-neutral-600"
    >
      <span>{label}</span>
      <span
        className={twMerge(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-[var(--studio-select)]' : 'bg-neutral-700'
        )}
      >
        <span
          className={twMerge(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
            checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5'
          )}
        />
      </span>
    </button>
  )
}

export function IconPicker({ value, onChange }: { value?: string; onChange: (name: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {HOTSPOT_ICON_NAMES.map((name) => {
        const Ic = hotspotIcon(name)
        const active = value === name
        return (
          <button
            type="button"
            key={name}
            title={name}
            aria-pressed={active}
            onClick={() => onChange(name)}
            className={twMerge(
              'flex aspect-square items-center justify-center rounded-lg border transition-colors',
              active
                ? 'border-[var(--studio-select)] bg-[var(--studio-select)]/20 text-[var(--studio-select)]'
                : 'border-neutral-700/80 bg-neutral-950/60 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'
            )}
          >
            <Ic size={16} />
          </button>
        )
      })}
    </div>
  )
}
