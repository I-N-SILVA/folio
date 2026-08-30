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
    defaultValues: { variant: block.variant, content: block.content, align: block.align ?? 'left' },
  })

  const currentVariant = watch('variant') ?? block.variant
  const currentAlign = watch('align') ?? block.align ?? 'left'

  useEffect(() => {
    const sub = watch((values) => {
      updateBlock(pageId, block.id, values as Partial<Block>)
    })
    return () => sub.unsubscribe()
  }, [watch, pageId, block.id, updateBlock])

  return (
    <div className="space-y-4">
      {/* Visual Variant Selector */}
      <Field label="Typography Style">
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
                  ? 'border-[var(--accent-vivid)] bg-[var(--accent-vivid)]/10 text-white font-bold'
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
      <Field label="Text Content">
        <textarea
          {...register('content')}
          className={twMerge(inputCls, 'resize-y min-h-[90px] text-xs leading-relaxed')}
          placeholder="Enter text..."
          rows={4}
        />
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
