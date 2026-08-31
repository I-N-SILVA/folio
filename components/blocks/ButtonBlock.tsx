'use client'

import { trackEvent } from '@/lib/tracking'
import type { ButtonBlock } from '@/lib/book-schema'
import { twMerge } from 'tailwind-merge'

const variantStyles: Record<ButtonBlock['variant'], string> = {
  primary:
    'bg-[var(--primary)] text-white hover:opacity-90 shadow-md',
  secondary:
    'border-2 border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white',
  ghost:
    'text-[var(--primary)] underline underline-offset-4 hover:opacity-70',
}

const sizeStyles: Record<string, string> = {
  sm: 'px-4 py-1.5 text-xs min-h-[36px]',
  md: 'px-7 py-3 text-sm min-h-[44px]',
  lg: 'px-9 py-4 text-base min-h-[52px]',
}

const shapeStyles: Record<string, string> = {
  pill: 'rounded-full',
  rounded: 'rounded-xl',
  square: 'rounded-none',
}

export function ButtonBlock({ block, bookId }: { block: ButtonBlock; bookId: string }) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    trackEvent(bookId, 'cta_click', { block_id: block.id, href: block.href })

    const href = (block.href || '').trim().toLowerCase()
    if (href === '#cart' || href === '#buy' || href === '#checkout' || href === 'cart:open') {
      e.preventDefault()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('folio:add-to-cart', {
            detail: {
              id: block.id,
              title: block.label || 'Featured Item',
              price: '$120',
              numericPrice: 120,
            },
          })
        )
      }
    }
  }

  const shapeCls = block.shape ? shapeStyles[block.shape] ?? 'rounded-full' : 'rounded-full'
  const sizeCls = block.size ? sizeStyles[block.size] ?? sizeStyles.md : sizeStyles.md

  const customStyle: React.CSSProperties = {}
  if (block.customColor && block.variant === 'primary') {
    customStyle.backgroundColor = block.customColor
    customStyle.borderColor = block.customColor
  }
  if (block.textColor) {
    customStyle.color = block.textColor
  }

  return (
    <div className={twMerge('w-full', block.fullWidth ? 'flex' : 'inline-block')}>
      <a
        href={block.href}
        target={block.target}
        rel="noopener noreferrer"
        onClick={handleClick}
        style={customStyle}
        className={twMerge(
          'inline-flex items-center justify-center font-semibold transition-all duration-200',
          block.fullWidth ? 'w-full' : '',
          shapeCls,
          sizeCls,
          variantStyles[block.variant]
        )}
      >
        {block.label}
      </a>
    </div>
  )
}
