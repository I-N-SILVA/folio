'use client'

import Image from 'next/image'
import { ShoppingBag, ExternalLink, ImageOff, Tag } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
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

  const cols = block.columns ?? '2'
  const colCls = colStyles[cols] ?? 'grid-cols-1 sm:grid-cols-2'
  const aspectCls = aspectStyles[block.aspectRatio ?? '1/1'] ?? 'aspect-square'
  const cardCls = cardStyles[block.cardStyle ?? 'bordered'] ?? cardStyles.bordered

  /**
   * Every product links out to wherever the author actually sells it.
   *
   * There used to be a third path: an "Add to Bag" that filled an in-reader cart
   * ending at a checkout which collected a card number and confirmed an order
   * that never existed. QLICO takes no payment, so it holds no cart — a product
   * is a link to the author's own shop, which is the only honest thing it can be
   * and the only one with no payouts to arrange.
   */
  const handleAction = (item: ProductItem, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!item.buyUrl) return
    window.open(item.buyUrl, '_blank', 'noopener,noreferrer')
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

              {/* A product with nowhere to buy it shows no button. The grid is
                  a catalogue: it can list, price and describe, and it links to
                  the author's own shop — it cannot take the money. */}
              {item.buyUrl && (
                <button
                  type="button"
                  onClick={(e) => handleAction(item, e)}
                  className="flex shrink-0 select-none items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black shadow-md transition-all hover:bg-neutral-200 active:scale-95"
                >
                  <ExternalLink size={12} />
                  <span>{item.ctaLabel || 'View'}</span>
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
