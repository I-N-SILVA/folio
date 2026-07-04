'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useEditorStore } from '@/lib/editor-store'
import type { Block, VideoBlock } from '@/lib/book-schema'
import { Field, inputCls } from './shared'

export function VideoBlockForm({ block, pageId }: { block: VideoBlock; pageId: string }) {
  const { updateBlock } = useEditorStore()
  const { register, watch } = useForm<Partial<VideoBlock>>({
    defaultValues: { src: block.src, poster: block.poster },
  })

  useEffect(() => {
    const sub = watch((values) => {
      updateBlock(pageId, block.id, values as Partial<Block>)
    })
    return () => sub.unsubscribe()
  }, [watch, pageId, block.id, updateBlock])

  return (
    <div className="space-y-3">
      <Field label="Video URL">
        <input {...register('src')} className={inputCls} placeholder="https://…" />
      </Field>
      <Field label="Poster URL">
        <input {...register('poster')} className={inputCls} placeholder="https://…" />
      </Field>
    </div>
  )
}
