'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { useEditorStore } from '@/lib/editor-store'
import type { Block, TextBlock } from '@/lib/book-schema'
import { Field, inputCls, selectCls } from './shared'

export function TextBlockForm({ block, pageId }: { block: TextBlock; pageId: string }) {
  const { updateBlock } = useEditorStore()
  const { register, watch } = useForm<Partial<TextBlock>>({
    defaultValues: { variant: block.variant, content: block.content, align: block.align },
  })

  useEffect(() => {
    const sub = watch((values) => {
      updateBlock(pageId, block.id, values as Partial<Block>)
    })
    return () => sub.unsubscribe()
  }, [watch, pageId, block.id, updateBlock])

  return (
    <div className="space-y-3">
      <Field label="Variant">
        <select {...register('variant')} className={selectCls}>
          {['title', 'heading', 'body', 'caption', 'quote', 'stat'].map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Content">
        <textarea
          {...register('content')}
          className={twMerge(inputCls, 'resize-y min-h-[80px]')}
          rows={4}
        />
      </Field>
      <Field label="Align">
        <select {...register('align')} className={selectCls}>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </Field>
    </div>
  )
}
