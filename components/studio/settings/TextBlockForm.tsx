'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { useEditorStore } from '@/lib/editor-store'
import type { Block, TextBlock } from '@/lib/book-schema'
import { Field, inputCls } from './shared'

const VARIANTS: { id: TextBlock['variant']; label: string; desc: string }[] = [
  { id: 'title', label: 'Title', desc: 'Display headline' },
  { id: 'heading', label: 'Heading', desc: 'Section header' },
  { id: 'body', label: 'Body', desc: 'Editorial paragraph' },
  { id: 'quote', label: 'Quote', desc: 'Pull quote' },
  { id: 'stat', label: 'Stat', desc: 'Metric & price callout' },
  { id: 'caption', label: 'Caption', desc: 'Micro tag' },
]

export function TextBlockForm({ block, pageId }: { block: TextBlock; pageId: string }) {
  const { updateBlock } = useEditorStore()
  const { register, watch, setValue } = useForm<Partial<TextBlock>>({
    defaultValues: {
      variant: block.variant,
      content: block.content,
      align: block.align ?? 'left',
      fontSize: block.fontSize,
      textColor: block.textColor,
      backgroundColor: block.backgroundColor,
      padding: block.padding ?? 'none',
      borderRadius: block.borderRadius ?? 'none',
      letterSpacing: block.letterSpacing ?? 'normal',
    },
  })

  const currentVariant = watch('variant') ?? block.variant
  const currentAlign = watch('align') ?? block.align ?? 'left'
  const currentSize = watch('fontSize') ?? block.fontSize ?? 'auto'
  const currentColor = watch('textColor') ?? block.textColor ?? ''
  const currentBg = watch('backgroundColor') ?? block.backgroundColor ?? ''
  const currentPadding = watch('padding') ?? block.padding ?? 'none'
  const currentRadius = watch('borderRadius') ?? block.borderRadius ?? 'none'
  const currentSpacing = watch('letterSpacing') ?? block.letterSpacing ?? 'normal'

  useEffect(() => {
    const sub = watch((values) => {
      updateBlock(pageId, block.id, values as Partial<Block>)
    })
    return () => sub.unsubscribe()
  }, [watch, pageId, block.id, updateBlock])

  return (
    <div className="space-y-4">
      {/* Visual Variant Selector */}
      <Field label="Typography Role">
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setValue('variant', v.id, { shouldDirty: true })
                updateBlock(pageId, block.id, { variant: v.id })
              }}
              className={twMerge(
                'rounded-lg border px-2 py-1.5 text-left transition text-xs',
                currentVariant === v.id
                  ? 'border-[var(--studio-select)] bg-[var(--studio-select)]/10 text-white font-bold'
                  : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
              )}
            >
              <div className="font-semibold capitalize">{v.label}</div>
              <div className="text-[9px] text-neutral-500 truncate">{v.desc}</div>
            </button>
          ))}
        </div>
      </Field>

      {/* Content Textarea */}
      <Field label="Text Content (Markdown supported)">
        <textarea
          {...register('content')}
          className={twMerge(inputCls, 'resize-y min-h-[90px] text-xs leading-relaxed')}
          placeholder="Enter text..."
          rows={4}
        />
      </Field>

      {/* Font Size & Spacing */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Font Scale">
          <select
            value={currentSize}
            onChange={(e) => {
              const val = e.target.value === 'auto' ? undefined : (e.target.value as any)
              setValue('fontSize', val, { shouldDirty: true })
              updateBlock(pageId, block.id, { fontSize: val })
            }}
            className={inputCls}
          >
            <option value="auto">Auto (Default)</option>
            <option value="xs">XS (Caption / Fine)</option>
            <option value="sm">Small</option>
            <option value="base">Base (16px)</option>
            <option value="lg">Large (18px)</option>
            <option value="xl">XL (24px)</option>
            <option value="2xl">2XL (32px)</option>
            <option value="4xl">4XL (48px)</option>
            <option value="6xl">6XL (72px Monumental)</option>
          </select>
        </Field>

        <Field label="Tracking">
          <select
            value={currentSpacing}
            onChange={(e) => {
              setValue('letterSpacing', e.target.value as any, { shouldDirty: true })
              updateBlock(pageId, block.id, { letterSpacing: e.target.value as any })
            }}
            className={inputCls}
          >
            <option value="tighter">Tighter</option>
            <option value="tight">Tight</option>
            <option value="normal">Normal</option>
            <option value="wide">Wide</option>
            <option value="widest">Widest (Editorial)</option>
          </select>
        </Field>
      </div>

      {/* Color Presets */}
      <Field label="Text Color">
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { label: 'Auto', color: '' },
            { label: 'White', color: '#ffffff' },
            { label: 'Charcoal', color: '#18181b' },
            { label: 'Gold', color: '#f59e0b' },
            { label: 'Emerald', color: '#10b981' },
            { label: 'Rose', color: '#f43f5e' },
            { label: 'Slate', color: '#94a3b8' },
          ].map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => {
                setValue('textColor', c.color || undefined, { shouldDirty: true })
                updateBlock(pageId, block.id, { textColor: c.color || undefined })
              }}
              className={twMerge(
                'px-2.5 py-1 rounded-md text-[11px] font-semibold border transition',
                currentColor === c.color
                  ? 'border-[var(--studio-select)] bg-[var(--studio-select)]/20 text-white'
                  : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </Field>

      {/* Background Container / Card styling */}
      <Field label="Card Highlight Box">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-neutral-500 block mb-1">Background Fill</label>
            <select
              value={currentBg}
              onChange={(e) => {
                setValue('backgroundColor', e.target.value || undefined, { shouldDirty: true })
                updateBlock(pageId, block.id, { backgroundColor: e.target.value || undefined })
              }}
              className={inputCls}
            >
              <option value="">None (Transparent)</option>
              <option value="rgba(0, 0, 0, 0.4)">Dark Tint (40%)</option>
              <option value="rgba(255, 255, 255, 0.1)">Light Frost (10%)</option>
              <option value="rgba(0, 0, 0, 0.75)">Solid Charcoal</option>
              <option value="rgba(245, 158, 11, 0.15)">Gold Ambient</option>
              <option value="rgba(16, 185, 129, 0.15)">Emerald Ambient</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-neutral-500 block mb-1">Padding & Inset</label>
            <select
              value={currentPadding}
              onChange={(e) => {
                setValue('padding', e.target.value as any, { shouldDirty: true })
                updateBlock(pageId, block.id, { padding: e.target.value as any })
              }}
              className={inputCls}
            >
              <option value="none">None</option>
              <option value="sm">Compact (12px)</option>
              <option value="md">Medium (20px)</option>
              <option value="lg">Spacious (32px)</option>
            </select>
          </div>
        </div>
      </Field>

      {/* Alignment Bar */}
      <Field label="Alignment">
        <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
          {[
            { id: 'left', icon: AlignLeft, label: 'Left' },
            { id: 'center', icon: AlignCenter, label: 'Center' },
            { id: 'right', icon: AlignRight, label: 'Right' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setValue('align', id as 'left' | 'center' | 'right', { shouldDirty: true })
                updateBlock(pageId, block.id, { align: id as 'left' | 'center' | 'right' })
              }}
              className={twMerge(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition',
                currentAlign === id
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-300'
              )}
            >
              <Icon size={13} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </Field>
    </div>
  )
}
