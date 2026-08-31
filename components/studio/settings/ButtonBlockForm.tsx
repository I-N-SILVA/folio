'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useEditorStore } from '@/lib/editor-store'
import type { Block, ButtonBlock } from '@/lib/book-schema'
import { Field, inputCls, selectCls } from './shared'

export function ButtonBlockForm({ block, pageId }: { block: ButtonBlock; pageId: string }) {
  const { updateBlock } = useEditorStore()
  const { register, watch, setValue } = useForm<Partial<ButtonBlock>>({
    defaultValues: {
      label: block.label,
      href: block.href,
      variant: block.variant,
      shape: block.shape ?? 'pill',
      size: block.size ?? 'md',
      fullWidth: block.fullWidth ?? false,
      customColor: block.customColor,
      textColor: block.textColor,
    },
  })

  const currentShape = watch('shape') ?? block.shape ?? 'pill'
  const currentSize = watch('size') ?? block.size ?? 'md'
  const currentColor = watch('customColor') ?? block.customColor ?? ''

  useEffect(() => {
    const sub = watch((values) => {
      updateBlock(pageId, block.id, values as Partial<Block>)
    })
    return () => sub.unsubscribe()
  }, [watch, pageId, block.id, updateBlock])

  return (
    <div className="space-y-4">
      <Field label="Button Label">
        <input {...register('label')} className={inputCls} placeholder="e.g. Shop Runway Collection →" />
      </Field>

      <Field label="Destination Link (URL)">
        <input {...register('href')} className={inputCls} placeholder="https://…" />
      </Field>

      <Field label="Style Treatment">
        <select {...register('variant')} className={selectCls}>
          <option value="primary">Primary (Solid Filled)</option>
          <option value="secondary">Secondary (Outline Border)</option>
          <option value="ghost">Ghost (Underline Text)</option>
        </select>
      </Field>

      {/* Shape & Size Controls */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Shape">
          <select
            value={currentShape}
            onChange={(e) => {
              setValue('shape', e.target.value as any, { shouldDirty: true })
              updateBlock(pageId, block.id, { shape: e.target.value as any })
            }}
            className={inputCls}
          >
            <option value="pill">Pill (Rounded Full)</option>
            <option value="rounded">Modern Soft (12px)</option>
            <option value="square">Architectural Sharp</option>
          </select>
        </Field>

        <Field label="Size">
          <select
            value={currentSize}
            onChange={(e) => {
              setValue('size', e.target.value as any, { shouldDirty: true })
              updateBlock(pageId, block.id, { size: e.target.value as any })
            }}
            className={inputCls}
          >
            <option value="sm">Compact</option>
            <option value="md">Standard</option>
            <option value="lg">Prominent Callout</option>
          </select>
        </Field>
      </div>

      {/* Button Color Preset */}
      <Field label="Button Color Accent">
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { label: 'Theme Primary', color: '' },
            { label: 'Obsidian Black', color: '#09090b' },
            { label: 'Pure White', color: '#ffffff' },
            { label: 'Gold Amber', color: '#d97706' },
            { label: 'Emerald Forest', color: '#059669' },
            { label: 'Crimson Wine', color: '#be123c' },
          ].map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => {
                setValue('customColor', c.color || undefined, { shouldDirty: true })
                updateBlock(pageId, block.id, { customColor: c.color || undefined })
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition ${
                currentColor === c.color
                  ? 'border-[var(--accent-vivid)] bg-[var(--accent-vivid)]/20 text-white'
                  : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </Field>

      <div className="pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register('fullWidth')} className="accent-[var(--accent-vivid)]" />
          <span className="text-xs text-neutral-300">Stretch Full Width (100%)</span>
        </label>
      </div>
    </div>
  )
}
