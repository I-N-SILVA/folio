'use client'

import type { VideoBlock } from '@/lib/book-schema'
import { useBlockForm, urlField } from './useBlockForm'
import { Field, inputCls } from './shared'

export function VideoBlockForm({ block, pageId }: { block: VideoBlock; pageId: string }) {
  const form = useBlockForm<Partial<VideoBlock>>(pageId, block.id, { src: block.src, poster: block.poster })

  return (
    <div className="space-y-3">
      <Field label="Video URL">
        <input {...urlField(form, 'src')} className={inputCls} placeholder="https://…" />
      </Field>
      <Field label="Poster URL">
        <input {...urlField(form, 'poster')} className={inputCls} placeholder="https://…" />
      </Field>
    </div>
  )
}
