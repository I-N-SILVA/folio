'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { useEditorStore } from '@/lib/editor-store'
import type { Block, EmbedBlock } from '@/lib/book-schema'
import { Field, inputCls } from './shared'

export function EmbedBlockForm({ block, pageId }: { block: EmbedBlock; pageId: string }) {
  const { updateBlock } = useEditorStore()
  const { register, watch } = useForm<Partial<EmbedBlock>>({
    defaultValues: { html: block.html, height: block.height },
  })

  useEffect(() => {
    const sub = watch((values) => {
      updateBlock(pageId, block.id, values as Partial<Block>)
    })
    return () => sub.unsubscribe()
  }, [watch, pageId, block.id, updateBlock])

  return (
    <div className="space-y-3">
      <Field label="HTML">
        <textarea
          {...register('html')}
          className={twMerge(inputCls, 'resize-y min-h-[100px] font-mono text-xs')}
          rows={5}
          placeholder="<iframe …>"
        />
      </Field>
      <Field label="Height (px)">
        <input
          type="number"
          {...register('height', { valueAsNumber: true })}
          className={inputCls}
          placeholder="300"
        />
      </Field>
    </div>
  )
}
