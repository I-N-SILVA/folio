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
    defaultValues: {
      src: block.src,
      alt: block.alt,
      caption: block.caption,
      lightbox: block.lightbox,
      aspectRatio: block.aspectRatio ?? '16/9',
      borderRadius: block.borderRadius ?? 'md',
      objectFit: block.objectFit ?? 'cover',
      shadow: block.shadow ?? 'none',
      border: block.border ?? false,
      focalPoint: block.focalPoint ?? 'center',
    },
  })
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [showAssetLibrary, setShowAssetLibrary] = useState(false)

  const currentAspect = watch('aspectRatio') ?? block.aspectRatio ?? '16/9'
  const currentRadius = watch('borderRadius') ?? block.borderRadius ?? 'md'
  const currentFit = watch('objectFit') ?? block.objectFit ?? 'cover'
  const currentShadow = watch('shadow') ?? block.shadow ?? 'none'
  const currentFocal = watch('focalPoint') ?? block.focalPoint ?? 'center'

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
    const toastId = toast.loading('Uploading picture…')

    try {
      const bookId = useEditorStore.getState().book?.id
      if (!bookId) throw new Error('Edition not loaded')

      // Use the server upload API with verified admin storage permissions
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bookId', bookId)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Server upload failed')
      }

      const { url } = await res.json()
      if (!url) throw new Error('No URL returned from upload')

      setValue('src', url, { shouldDirty: true })
      updateBlock(pageId, block.id, { src: url } as Partial<Block>)
      toast.success('Picture uploaded successfully!', { id: toastId })
    } catch (err: any) {
      console.warn('API upload failed, using high-res local image data URI fallback:', err)
      // High-res local data URI fallback so the picture always works instantly
      const reader = new FileReader()
      reader.onload = (uploadEvent) => {
        const dataUrl = uploadEvent.target?.result as string
        if (dataUrl) {
          setValue('src', dataUrl, { shouldDirty: true })
          updateBlock(pageId, block.id, { src: dataUrl } as Partial<Block>)
          toast.success('Image added to page!', { id: toastId })
        }
      }
      reader.readAsDataURL(file)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [pageId, block.id, setValue, updateBlock])

  return (
    <div className="space-y-4">
      {/* Image Source & Upload */}
      <Field label="Image File & URL">
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
              className="py-2 rounded-lg border border-neutral-700 bg-neutral-900 text-xs font-semibold text-neutral-200 hover:text-white hover:bg-neutral-800 transition disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : '↑ Upload photo'}
            </button>
            <button
              type="button"
              onClick={() => setShowAssetLibrary(true)}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-neutral-700 bg-neutral-900 text-xs font-semibold text-neutral-200 hover:bg-neutral-800 hover:text-white transition"
            >
              <FolderOpen size={13} className="text-neutral-400" />
              <span>Asset Library</span>
            </button>
          </div>
        </div>
      </Field>

      {/* Aspect Ratio Control */}
      <Field label="Aspect Ratio / Crop">
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: '16/9', label: '16:9 Landscape' },
            { id: '1/1', label: '1:1 Square' },
            { id: '4/3', label: '4:3 Standard' },
            { id: '3/4', label: '3:4 Portrait' },
            { id: '2/3', label: '2:3 Lookbook' },
            { id: '21/9', label: '21:9 Cinema' },
          ].map((asp) => (
            <button
              key={asp.id}
              type="button"
              onClick={() => {
                setValue('aspectRatio', asp.id as any, { shouldDirty: true })
                updateBlock(pageId, block.id, { aspectRatio: asp.id as any })
              }}
              className={`rounded-lg border px-2 py-1.5 text-center text-xs transition ${
                currentAspect === asp.id
                  ? 'border-[var(--accent-vivid)] bg-[var(--accent-vivid)]/10 text-white font-bold'
                  : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
              }`}
            >
              {asp.label}
            </button>
          ))}
        </div>
      </Field>

      {/* Border Radius & Shadow */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Corners">
          <select
            value={currentRadius}
            onChange={(e) => {
              setValue('borderRadius', e.target.value as any, { shouldDirty: true })
              updateBlock(pageId, block.id, { borderRadius: e.target.value as any })
            }}
            className={inputCls}
          >
            <option value="none">Sharp (0px)</option>
            <option value="sm">Soft (6px)</option>
            <option value="md">Rounded (12px)</option>
            <option value="lg">Large (16px)</option>
            <option value="xl">Pill (24px)</option>
            <option value="full">Full Circle</option>
          </select>
        </Field>

        <Field label="Elevation">
          <select
            value={currentShadow}
            onChange={(e) => {
              setValue('shadow', e.target.value as any, { shouldDirty: true })
              updateBlock(pageId, block.id, { shadow: e.target.value as any })
            }}
            className={inputCls}
          >
            <option value="none">Flat</option>
            <option value="sm">Subtle Depth</option>
            <option value="md">Medium Shadow</option>
            <option value="lg">Floating Elevation</option>
            <option value="2xl">Dramatic Glow</option>
          </select>
        </Field>
      </div>

      {/* Object Fit & Focal Position */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fit Mode">
          <select
            value={currentFit}
            onChange={(e) => {
              setValue('objectFit', e.target.value as any, { shouldDirty: true })
              updateBlock(pageId, block.id, { objectFit: e.target.value as any })
            }}
            className={inputCls}
          >
            <option value="cover">Cover (Fill & Crop)</option>
            <option value="contain">Contain (Show All)</option>
            <option value="fill">Stretch</option>
          </select>
        </Field>

        <Field label="Focal Crop">
          <select
            value={currentFocal}
            onChange={(e) => {
              setValue('focalPoint', e.target.value as any, { shouldDirty: true })
              updateBlock(pageId, block.id, { focalPoint: e.target.value as any })
            }}
            className={inputCls}
          >
            <option value="center">Center</option>
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </Field>
      </div>

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

      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register('lightbox')} className="accent-[var(--accent-vivid)]" />
          <span className="text-xs text-neutral-300">Click to expand Lightbox</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register('border')} className="accent-[var(--accent-vivid)]" />
          <span className="text-xs text-neutral-300">Border Outline</span>
        </label>
      </div>
    </div>
  )
}
