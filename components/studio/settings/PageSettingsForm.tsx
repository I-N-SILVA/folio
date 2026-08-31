'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { toast } from 'sonner'
import { FolderOpen, Trash2, Upload } from 'lucide-react'
import { useEditorStore } from '@/lib/editor-store'
import type { Page } from '@/lib/book-schema'
import { AssetLibraryModal } from '@/components/studio/AssetLibraryModal'
import { Field, inputCls, selectCls } from './shared'

const CURATED_TEXTURES = [
  {
    id: 'charcoal',
    label: 'Charcoal Linen',
    url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1600&q=85',
  },
  {
    id: 'washi',
    label: 'Japanese Washi',
    url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1600&q=85',
  },
  {
    id: 'concrete',
    label: 'Concrete Slate',
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1600&q=85',
  },
  {
    id: 'silk',
    label: 'Silk Drapery',
    url: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1600&q=85',
  },
  {
    id: 'mist',
    label: 'Moody Atmosphere',
    url: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1600&q=85',
  },
]

export function PageSettingsForm({ page }: { page: Page }) {
  const { updatePage } = useEditorStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [showAssetLibrary, setShowAssetLibrary] = useState(false)

  const { register, watch, setValue } = useForm<{
    bgColor: string
    bgImage: string
    bgPosition: 'center' | 'top' | 'bottom' | 'left' | 'right'
    bgFit: 'cover' | 'contain' | 'auto'
    overlayOpacity: number
    bgBlur: 'none' | 'sm' | 'md' | 'lg'
    paperTexture: 'none' | 'gloss' | 'matte' | 'washi' | 'linen' | 'carbon'
    layout: Page['layout']
    type: Page['type']
  }>({
    defaultValues: {
      bgColor: page.background?.color ?? '',
      bgImage: page.background?.image ?? '',
      bgPosition: page.background?.imagePosition ?? 'center',
      bgFit: page.background?.imageFit ?? 'cover',
      overlayOpacity: page.background?.overlayOpacity ?? (page.background?.image ? 40 : 0),
      bgBlur: page.background?.blur ?? 'none',
      paperTexture: page.background?.paperTexture ?? 'none',
      layout: page.layout,
      type: page.type,
    },
  })

  const currentBgImage = watch('bgImage')
  const currentOpacity = watch('overlayOpacity') ?? 40
  const currentTexture = watch('paperTexture') ?? 'none'

  useEffect(() => {
    const sub = watch((values) => {
      updatePage(page.id, {
        layout: values.layout as Page['layout'],
        type: values.type as Page['type'],
        background: {
          ...page.background,
          color: values.bgColor || undefined,
          image: values.bgImage || undefined,
          imagePosition: values.bgPosition || 'center',
          imageFit: values.bgFit || 'cover',
          overlayOpacity: Number(values.overlayOpacity ?? 40),
          blur: values.bgBlur || 'none',
          paperTexture: values.paperTexture || 'none',
        },
      })
    })
    return () => sub.unsubscribe()
  }, [watch, page.id, page.background, updatePage])

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const toastId = toast.loading('Uploading background photo…')

    try {
      const bookId = useEditorStore.getState().book?.id
      if (!bookId) throw new Error('Edition not loaded')

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
      if (!url) throw new Error('No URL returned')

      setValue('bgImage', url, { shouldDirty: true })
      toast.success('Page background image updated!', { id: toastId })
    } catch (err) {
      console.warn('API upload failed, fallback to local data URI:', err)
      const reader = new FileReader()
      reader.onload = (uploadEvent) => {
        const dataUrl = uploadEvent.target?.result as string
        if (dataUrl) {
          setValue('bgImage', dataUrl, { shouldDirty: true })
          toast.success('Background photo applied!', { id: toastId })
        }
      }
      reader.readAsDataURL(file)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [setValue])

  return (
    <div className="space-y-5">
      <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block">
        Page Configuration
      </span>

      {/* Layout Structure */}
      <Field label="Layout Structure">
        <select {...register('layout')} className={selectCls}>
          <option value="hero">Hero (Centered Vertical Stack)</option>
          <option value="split">Split (2-Column Feature Spread)</option>
          <option value="grid">Grid (2x2 Multi-Card Display)</option>
          <option value="text">Text (Longform Story / Monograph)</option>
          <option value="blank">Blank (Freeform Canvas)</option>
        </select>
      </Field>

      {/* Page Type */}
      <Field label="Page Role">
        <select {...register('type')} className={selectCls}>
          <option value="cover">Cover Page</option>
          <option value="content">Editorial Content Spread</option>
          <option value="back">Back Colophon / Colophon</option>
        </select>
      </Field>

      {/* Background Color */}
      <Field label="Solid Background Color">
        <div className="flex items-center gap-2">
          <input type="color" {...register('bgColor')} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
          <input {...register('bgColor')} className={twMerge(inputCls, 'flex-1')} placeholder="#09090b or #ffffff" />
        </div>
        <div className="mt-2 flex gap-1.5">
          {[
            { label: 'Carbon', hex: '#09090b' },
            { label: 'Ivory', hex: '#fdfbf7' },
            { label: 'Sand', hex: '#f5f3ef' },
            { label: 'Navy', hex: '#0a192f' },
            { label: 'Earth', hex: '#181411' },
          ].map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => setValue('bgColor', c.hex, { shouldDirty: true })}
              className="flex-1 py-1 rounded border border-neutral-800 text-[10px] text-neutral-400 hover:text-white hover:border-neutral-700 transition"
              style={{ backgroundColor: c.hex }}
            >
              <span className="bg-black/60 px-1 py-0.5 rounded text-[9px] text-white">
                {c.label}
              </span>
            </button>
          ))}
        </div>
      </Field>

      {/* Page Background Image & Texture */}
      <div className="space-y-3 pt-2 border-t border-neutral-800">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-neutral-200">
            Background Photo / Texture
          </label>
          {currentBgImage && (
            <button
              type="button"
              onClick={() => setValue('bgImage', '', { shouldDirty: true })}
              className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 transition"
            >
              <Trash2 size={11} />
              Remove image
            </button>
          )}
        </div>

        <input
          {...register('bgImage')}
          className={inputCls}
          placeholder="https://images.unsplash.com/…"
        />

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
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-neutral-700 bg-neutral-900 text-xs font-semibold text-neutral-200 hover:text-white hover:bg-neutral-800 transition disabled:opacity-50"
          >
            <Upload size={12} />
            <span>{uploading ? 'Uploading…' : 'Upload photo'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAssetLibrary(true)}
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-neutral-700 bg-neutral-900 text-xs font-semibold text-neutral-200 hover:bg-neutral-800 hover:text-white transition"
          >
            <FolderOpen size={12} className="text-neutral-400" />
            <span>Curated textures</span>
          </button>
        </div>

        {/* 1-Click Curated Luxury Textures */}
        <div>
          <span className="text-[11px] text-neutral-400 block mb-1.5">Preset Textures:</span>
          <div className="grid grid-cols-3 gap-1.5">
            {CURATED_TEXTURES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setValue('bgImage', t.url, { shouldDirty: true })}
                className={twMerge(
                  'rounded-lg border px-2 py-1.5 text-center text-[11px] transition truncate',
                  currentBgImage === t.url
                    ? 'border-[var(--accent-vivid)] bg-[var(--accent-vivid)]/15 text-white font-bold'
                    : 'border-neutral-800 bg-neutral-900/70 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Image Controls if Image is Active */}
        {currentBgImage && (
          <div className="space-y-3 pt-2 border-t border-neutral-800/60">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fit Mode">
                <select {...register('bgFit')} className={selectCls}>
                  <option value="cover">Cover (Full Bleed)</option>
                  <option value="contain">Contain</option>
                  <option value="auto">Auto Tile</option>
                </select>
              </Field>
              <Field label="Focal Position">
                <select {...register('bgPosition')} className={selectCls}>
                  <option value="center">Center</option>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </Field>
            </div>

            {/* Dark Tint Overlay Slider for Legibility */}
            <Field label={`Legibility Dark Overlay Tint: ${currentOpacity}%`}>
              <input
                type="range"
                min={0}
                max={95}
                step={5}
                {...register('overlayOpacity', { valueAsNumber: true })}
                className="w-full accent-[var(--accent-vivid)] cursor-pointer"
              />
              <span className="text-[10px] text-neutral-400">
                Darkens background to ensure headlines and body copy remain 100% legible.
              </span>
            </Field>

            {/* Blur effect */}
            <Field label="Background Blur Effect">
              <select {...register('bgBlur')} className={selectCls}>
                <option value="none">No Blur (Sharp)</option>
                <option value="sm">Subtle Softening</option>
                <option value="md">Medium Blur (Frosted)</option>
                <option value="lg">Heavy Blur</option>
              </select>
            </Field>
          </div>
        )}
      </div>

      {/* Tactile Paper Texture */}
      <div className="pt-2 border-t border-neutral-800">
        <Field label="Paper Finish & Tactile Noise">
          <select {...register('paperTexture')} className={selectCls}>
            <option value="none">Smooth Standard</option>
            <option value="washi">Japanese Washi Fiber</option>
            <option value="linen">Charcoal Woven Linen</option>
            <option value="matte">Fine Editorial Matte</option>
            <option value="carbon">Carbon Fiber Sheen</option>
            <option value="gloss">Gloss Lacquer</option>
          </select>
        </Field>
      </div>

      <AssetLibraryModal
        isOpen={showAssetLibrary}
        onClose={() => setShowAssetLibrary(false)}
        onSelect={(url) => {
          setValue('bgImage', url, { shouldDirty: true })
          toast.success('Texture applied to page!')
        }}
      />
    </div>
  )
}
