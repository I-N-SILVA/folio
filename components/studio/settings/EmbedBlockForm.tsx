'use client'

import { twMerge } from 'tailwind-merge'
import type { EmbedBlock } from '@/lib/book-schema'
import { useBlockForm } from './useBlockForm'
import { Field, inputCls } from './shared'

export function EmbedBlockForm({ block, pageId }: { block: EmbedBlock; pageId: string }) {
  const form = useBlockForm<Partial<EmbedBlock>>(pageId, block.id, { html: block.html, height: block.height })
  const { register } = form

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
