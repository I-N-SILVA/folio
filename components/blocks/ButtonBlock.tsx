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

export function ButtonBlock({ block, bookId }: { block: ButtonBlock; bookId: string }) {
  function handleClick() {
    trackEvent(bookId, 'cta_click', { block_id: block.id, href: block.href })
  }

  return (
    <a
      href={block.href}
      target={block.target}
      rel="noopener noreferrer"
      onClick={handleClick}
      className={twMerge(
        'inline-flex items-center justify-center px-7 py-3 rounded-full text-sm font-semibold transition-all duration-200 min-h-[44px]',
        variantStyles[block.variant]
      )}
    >
      {block.label}
    </a>
  )
}
