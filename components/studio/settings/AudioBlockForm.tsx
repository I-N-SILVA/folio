'use client'

import type { AudioBlock } from '@/lib/book-schema'
import { useBlockForm, urlField } from './useBlockForm'
import { Field, inputCls } from './shared'

export function AudioBlockForm({ block, pageId }: { block: AudioBlock; pageId: string }) {
  const form = useBlockForm<Partial<AudioBlock>>(pageId, block.id, { src: block.src, title: block.title })
  const { register } = form

  return (
    <div className="space-y-3">
      <Field label="Audio URL">
        <input {...urlField(form, 'src')} className={inputCls} placeholder="https://…" />
      </Field>
      <Field label="Title">
        <input {...register('title')} className={inputCls} placeholder="Audio title" />
      </Field>
    </div>
  )
}
