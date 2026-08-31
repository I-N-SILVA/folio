'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ShoppingBag, ExternalLink, Check, ImageOff, Tag } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { toast } from 'sonner'
import type { ProductGridBlock as ProductGridBlockType, ProductItem } from '@/lib/book-schema'

const aspectStyles: Record<string, string> = {
  '1/1': 'aspect-square',
  '3/4': 'aspect-[3/4]',
  '4/3': 'aspect-[4/3]',
  '16/9': 'aspect-video',
}

const colStyles: Record<string, string> = {
  '2': 'grid-cols-1 sm:grid-cols-2',
  '3': 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
  '4': 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4',
}

const cardStyles: Record<string, string> = {
  bordered: 'border border-white/10 bg-black/20 hover:border-white/20 transition-all shadow-sm',
  elevated: 'border border-white/5 bg-neutral-900/90 shadow-xl hover:shadow-2xl transition-all',
  glass: 'border border-white/15 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-all shadow-lg',
  minimal: 'bg-transparent border-0 shadow-none',
}

export function ProductGridBlock({ block }: { block: ProductGridBlockType }) {
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({})

  const cols = block.columns ?? '2'
  const colCls = colStyles[cols] ?? 'grid-cols-1 sm:grid-cols-2'
  const aspectCls = aspectStyles[block.aspectRatio ?? '1/1'] ?? 'aspect-square'
  const cardCls = cardStyles[block.cardStyle ?? 'bordered'] ?? cardStyles.bordered

  const handleAction = (item: ProductItem, e: React.MouseEvent) => {
    e.stopPropagation()

    if (item.action === 'checkout' && item.buyUrl) {
      window.open(item.buyUrl, '_blank')
      return
    }

    if (item.action === 'link' && item.buyUrl) {
      window.open(item.buyUrl, '_blank')
      return
    }

    // Default 'cart' action: dispatch live event to magazine's CartDrawer
    const numeric = parseFloat(item.price.replace(/[^0-9.]/g, '')) || 0
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('folio:add-to-cart', {
          detail: {
            id: item.id,
            title: item.name,
            price: item.price,
            numericPrice: numeric,
            image: item.image,
          },
        })
      )
    }

    setAddedIds((prev) => ({ ...prev, [item.id]: true }))
    toast.success(`Added ${item.name} to your shopping bag!`)
    setTimeout(() => {
      setAddedIds((prev) => ({ ...prev, [item.id]: false }))
    }, 2000)
  }

  const items = block.items ?? []

  if (items.length === 0) {
    return (
      <div className="w-full rounded-xl border border-dashed border-neutral-700 p-6 text-center text-neutral-400">
        <ShoppingBag size={24} className="mx-auto mb-2 opacity-50" />
        <p className="text-xs font-medium">Empty Product Grid Row</p>
        <p className="text-[11px] text-neutral-400 mt-0.5">
          Add products in the sidebar inspector to display side-by-side products with prices and buy buttons.
        </p>
      </div>
    )
  }

  return (
    <div className={twMerge('w-full grid gap-4 items-stretch', colCls)}>
      {items.map((item) => {
        const isAdded = Boolean(addedIds[item.id])

        return (
          <div
            key={item.id}
            className={twMerge(
              'group/product flex flex-col justify-between overflow-hidden rounded-2xl p-3.5',
              cardCls
            )}
          >
            <div>
              {/* Product Image */}
              <div className={twMerge('relative w-full overflow-hidden rounded-xl bg-black/20', aspectCls)}>
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.alt || item.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover/product:scale-105"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-neutral-400">
                    <ImageOff size={20} className="opacity-40" />
                    <span className="text-[10px]">No photo</span>
                  </div>
                )}

                {/* Badge Tag */}
                {item.badge && (
                  <div className="absolute top-2 left-2 z-10">
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/75 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 border border-amber-400/30 shadow-md">
                      <Tag size={9} />
                      {item.badge}
                    </span>
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div className="mt-3 space-y-1">
                <h4 className="text-sm font-semibold text-white tracking-tight line-clamp-1">
                  {item.name}
                </h4>
                {item.description && (
                  <p className="text-[11px] text-neutral-300 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>
            </div>

            {/* Price & Action Row */}
            <div className="mt-3.5 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-1.5 truncate">
                <span className="text-sm font-bold text-white tracking-tight">
                  {item.price}
                </span>
                {item.originalPrice && (
                  <span className="text-[11px] text-neutral-400 line-through">
                    {item.originalPrice}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={(e) => handleAction(item, e)}
                className={twMerge(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 select-none shadow-md',
                  isAdded
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white text-black hover:bg-neutral-200 active:scale-95'
                )}
              >
                {isAdded ? (
                  <>
                    <Check size={12} strokeWidth={3} />
                    <span>Added</span>
                  </>
                ) : item.action === 'checkout' ? (
                  <>
                    <ExternalLink size={12} />
                    <span>{item.ctaLabel || 'Buy Now'}</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag size={12} />
                    <span>{item.ctaLabel || 'Add to Bag'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
