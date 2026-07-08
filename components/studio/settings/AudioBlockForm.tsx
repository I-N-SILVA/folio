'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useEditorStore } from '@/lib/editor-store'
import type { AudioBlock, Block } from '@/lib/book-schema'
import { Field, inputCls } from './shared'

export function AudioBlockForm({ block, pageId }: { block: AudioBlock; pageId: string }) {
  const { updateBlock } = useEditorStore()
  const { register, watch } = useForm<Partial<AudioBlock>>({
    defaultValues: { src: block.src, title: block.title },
  })

  useEffect(() => {
    const sub = watch((values) => {
      updateBlock(pageId, block.id, values as Partial<Block>)
    })
    return () => sub.unsubscribe()
  }, [watch, pageId, block.id, updateBlock])

  return (
    <div className="space-y-3">
      <Field label="Audio URL">
        <input {...register('src')} className={inputCls} placeholder="https://…" />
      </Field>
      <Field label="Title">
        <input {...register('title')} className={inputCls} placeholder="Audio title" />
      </Field>
    </div>
  )
}
