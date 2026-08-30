'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { FolderOpen } from 'lucide-react'
import { useEditorStore } from '@/lib/editor-store'
import type { Block, ImageBlock } from '@/lib/book-schema'
import { AssetLibraryModal } from '@/components/studio/AssetLibraryModal'
import { Field, inputCls } from './shared'

export function ImageBlockForm({ block, pageId }: { block: ImageBlock; pageId: string }) {
  const { updateBlock } = useEditorStore()
  const { register, watch, setValue } = useForm<Partial<ImageBlock>>({
    defaultValues: { src: block.src, alt: block.alt, caption: block.caption, lightbox: block.lightbox },
  })
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [showAssetLibrary, setShowAssetLibrary] = useState(false)

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
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="py-1.5 rounded-lg border border-neutral-700 bg-neutral-900/60 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : '↑ Upload file'}
            </button>
            <button
              type="button"
              onClick={() => setShowAssetLibrary(true)}
              className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 hover:text-white transition"
            >
              <FolderOpen size={12} className="text-neutral-400" />
              <span>Asset Library</span>
            </button>
          </div>
        </div>
      </Field>

      <AssetLibraryModal
        isOpen={showAssetLibrary}
        onClose={() => setShowAssetLibrary(false)}
        onSelect={(url, alt) => {
          setValue('src', url, { shouldDirty: true })
          if (alt) setValue('alt', alt, { shouldDirty: true })
          updateBlock(pageId, block.id, { src: url, alt: alt || block.alt } as Partial<Block>)
        }}
      />
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
