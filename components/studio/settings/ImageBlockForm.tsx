'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useEditorStore } from '@/lib/editor-store'
import type { Block, ImageBlock } from '@/lib/book-schema'
import { Field, inputCls } from './shared'

export function ImageBlockForm({ block, pageId }: { block: ImageBlock; pageId: string }) {
  const { updateBlock } = useEditorStore()
  const { register, watch, setValue } = useForm<Partial<ImageBlock>>({
    defaultValues: { src: block.src, alt: block.alt, caption: block.caption, lightbox: block.lightbox },
  })
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const sub = watch((values) => {
      updateBlock(pageId, block.id, values as Partial<Block>)
    })
    return () => sub.unsubscribe()
  }, [watch, pageId, block.id, updateBlock])

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const { createBrowserSupabase } = await import('@/lib/supabase')
      const supabase = createBrowserSupabase()
      const bookId = useEditorStore.getState().book?.id
      if (!bookId) throw new Error('No book')

      const ext = file.name.split('.').pop() ?? 'png'
      const path = `books/${bookId}/uploads/${crypto.randomUUID()}.${ext}`

      const { error } = await supabase.storage
        .from('folio-assets')
        .upload(path, file, { contentType: file.type, upsert: false })

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('folio-assets')
        .getPublicUrl(path)

      setValue('src', publicUrl, { shouldDirty: true })
      updateBlock(pageId, block.id, { src: publicUrl } as Partial<Block>)
    } catch (err) {
      console.error('Image upload failed:', err)
      toast.error('Image upload failed — check the file and try again')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [pageId, block.id, setValue, updateBlock])

  return (
    <div className="space-y-3">
      <Field label="Image">
        <div className="space-y-2">
          <input {...register('src')} className={inputCls} placeholder="https://…" />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full py-1.5 rounded border border-dashed border-neutral-600 text-xs text-neutral-400 hover:text-neutral-200 hover:border-neutral-400 transition-colors disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : '↑ Upload image file'}
          </button>
        </div>
      </Field>
      <Field label="Alt text">
        <input {...register('alt')} className={inputCls} placeholder="Describe the image" />
      </Field>
      <Field label="Caption">
        <input {...register('caption')} className={inputCls} placeholder="Optional caption" />
      </Field>
      <Field label="Lightbox">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register('lightbox')} className="accent-[var(--accent-vivid)]" />
          <span className="text-sm text-neutral-300">Enable lightbox</span>
        </label>
      </Field>
    </div>
  )
}
