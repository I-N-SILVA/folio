'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { Plus, Trash2, Upload, FolderOpen, Tag, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { useEditorStore } from '@/lib/editor-store'
import type { Block, ProductGridBlock, ProductItem } from '@/lib/book-schema'
import { AssetLibraryModal } from '@/components/studio/AssetLibraryModal'
import { Field, inputCls, selectCls } from './shared'

const SAMPLE_PRODUCTS: ProductItem[] = [
  {
    id: 'prod-1',
    name: 'Mulberry Silk Trench',
    price: '$480',
    originalPrice: '$620',
    image: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1200&q=85',
    description: 'Handcrafted heavy mulberry silk with horn buttons.',
    badge: 'Best Seller',
    action: 'cart',
    ctaLabel: 'Add to Bag',
    inStock: true,
  },
  {
    id: 'prod-2',
    name: 'Cashmere Ribbed Beanie',
    price: '$120',
    originalPrice: '$150',
    image: 'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?auto=format&fit=crop&w=1200&q=85',
    description: '100% Mongolian organic combed cashmere yarn.',
    badge: 'New Season',
    action: 'cart',
    ctaLabel: 'Add to Bag',
    inStock: true,
  },
  {
    id: 'prod-3',
    name: 'Charcoal Linen Overshirt',
    price: '$280',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=85',
    description: 'Relaxed tailored dropped silhouette with French seams.',
    badge: 'Limited Run',
    action: 'cart',
    ctaLabel: 'Add to Bag',
    inStock: true,
  },
]

export function ProductGridBlockForm({ block, pageId }: { block: ProductGridBlock; pageId: string }) {
  const { updateBlock } = useEditorStore()
  const [activeUploadIndex, setActiveUploadIndex] = useState<number | null>(null)
  const [showAssetLibrary, setShowAssetLibrary] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { register, control, watch, setValue } = useForm<Partial<ProductGridBlock>>({
    defaultValues: {
      columns: block.columns ?? '2',
      cardStyle: block.cardStyle ?? 'bordered',
      aspectRatio: block.aspectRatio ?? '1/1',
      items: block.items?.length ? block.items : SAMPLE_PRODUCTS.slice(0, 2),
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  })

  useEffect(() => {
    const sub = watch((values) => {
      updateBlock(pageId, block.id, values as Partial<Block>)
    })
    return () => sub.unsubscribe()
  }, [watch, pageId, block.id, updateBlock])

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (activeUploadIndex === null) return
    const file = e.target.files?.[0]
    if (!file) return

    const toastId = toast.loading('Uploading product photo…')
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

      if (!res.ok) throw new Error('Upload failed')
      const { url } = await res.json()
      if (!url) throw new Error('No URL returned')

      setValue(`items.${activeUploadIndex}.image`, url, { shouldDirty: true })
      toast.success('Product photo uploaded!', { id: toastId })
    } catch {
      const reader = new FileReader()
      reader.onload = (uploadEvent) => {
        const dataUrl = uploadEvent.target?.result as string
        if (dataUrl) {
          setValue(`items.${activeUploadIndex}.image`, dataUrl, { shouldDirty: true })
          toast.success('Product photo applied!', { id: toastId })
        }
      }
      reader.readAsDataURL(file)
    } finally {
      setActiveUploadIndex(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [activeUploadIndex, setValue])

  return (
    <div className="space-y-4">
      {/* Columns & Layout */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Columns in Row">
          <select {...register('columns')} className={selectCls}>
            <option value="2">2 Products (Spread)</option>
            <option value="3">3 Products (Catalog)</option>
            <option value="4">4 Products (Compact)</option>
          </select>
        </Field>

        <Field label="Card Style">
          <select {...register('cardStyle')} className={selectCls}>
            <option value="bordered">Bordered Frame</option>
            <option value="elevated">Floating Shadow</option>
            <option value="glass">Glass Frosted</option>
            <option value="minimal">Minimal Flat</option>
          </select>
        </Field>
      </div>

      <Field label="Photo Aspect Ratio">
        <select {...register('aspectRatio')} className={selectCls}>
          <option value="1/1">1:1 Square</option>
          <option value="3/4">3:4 Lookbook Portrait</option>
          <option value="4/3">4:3 Standard Landscape</option>
          <option value="16/9">16:9 Widescreen</option>
        </select>
      </Field>

      {/* Hidden File Input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />

      {/* Product List */}
      <div className="space-y-3 pt-2 border-t border-neutral-800">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
            Products ({fields.length})
          </span>
          <button
            type="button"
            onClick={() => {
              append({
                id: crypto.randomUUID(),
                name: 'New Product',
                price: '$190',
                image: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1200&q=85',
                description: 'Product specifications and details.',
                action: 'cart',
                ctaLabel: 'Add to Bag',
                inStock: true,
              })
            }}
            className="flex items-center gap-1 text-xs font-semibold text-[var(--accent-vivid)] hover:underline"
          >
            <Plus size={13} />
            Add Product
          </button>
        </div>

        {fields.map((field, idx) => (
          <div
            key={field.id}
            className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-3.5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-200">
                Item #{idx + 1}
              </span>
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="text-neutral-500 hover:text-red-400 p-1 transition"
                  title="Remove product"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Product Name">
                <input
                  {...register(`items.${idx}.name` as const)}
                  className={inputCls}
                  placeholder="e.g. Silk Trench"
                />
              </Field>
              <Field label="Price">
                <input
                  {...register(`items.${idx}.price` as const)}
                  className={inputCls}
                  placeholder="$480"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Strike Price (Optional)">
                <input
                  {...register(`items.${idx}.originalPrice` as const)}
                  className={inputCls}
                  placeholder="e.g. $600"
                />
              </Field>
              <Field label="Badge Tag (Optional)">
                <input
                  {...register(`items.${idx}.badge` as const)}
                  className={inputCls}
                  placeholder="e.g. Best Seller"
                />
              </Field>
            </div>

            {/* Photo URL & Upload */}
            <Field label="Photo URL">
              <input
                {...register(`items.${idx}.image` as const)}
                className={inputCls}
                placeholder="https://images.unsplash.com/…"
              />
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveUploadIndex(idx)
                    fileRef.current?.click()
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 rounded-lg border border-neutral-700 bg-neutral-900 text-[11px] font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
                >
                  <Upload size={11} />
                  <span>Upload photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveUploadIndex(idx)
                    setShowAssetLibrary(true)
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 rounded-lg border border-neutral-700 bg-neutral-900 text-[11px] font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
                >
                  <FolderOpen size={11} className="text-neutral-400" />
                  <span>Asset library</span>
                </button>
              </div>
            </Field>

            <Field label="Short Description">
              <input
                {...register(`items.${idx}.description` as const)}
                className={inputCls}
                placeholder="Material, sizing, or finish"
              />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Button Action">
                <select {...register(`items.${idx}.action` as const)} className={selectCls}>
                  <option value="cart">Add to Bag (In-Edition Drawer)</option>
                  <option value="checkout">Buy Now (Direct Checkout)</option>
                  <option value="link">External Product Link</option>
                </select>
              </Field>
              <Field label="Button Label">
                <input
                  {...register(`items.${idx}.ctaLabel` as const)}
                  className={inputCls}
                  placeholder="Add to Bag"
                />
              </Field>
            </div>

            <Field label="Checkout / Store URL">
              <input
                {...register(`items.${idx}.buyUrl` as const)}
                className={inputCls}
                placeholder="https://yourstore.com/checkout or Stripe payment link"
              />
            </Field>
          </div>
        ))}
      </div>

      <AssetLibraryModal
        isOpen={showAssetLibrary}
        onClose={() => setShowAssetLibrary(false)}
        onSelect={(url) => {
          if (activeUploadIndex !== null) {
            setValue(`items.${activeUploadIndex}.image`, url, { shouldDirty: true })
          }
          setShowAssetLibrary(false)
          setActiveUploadIndex(null)
        }}
      />
    </div>
  )
}
