'use client'

import { twMerge } from 'tailwind-merge'
import type { TextBlock } from '@/lib/book-schema'

const variantStyles: Record<TextBlock['variant'], string> = {
  title: 'text-4xl md:text-6xl font-bold leading-tight',
  heading: 'text-2xl md:text-3xl font-semibold leading-snug',
  body: 'text-base md:text-lg leading-relaxed',
  caption: 'text-sm text-current opacity-70 italic',
  quote: 'text-xl md:text-2xl italic border-l-4 border-current pl-4 opacity-90',
  stat: 'text-5xl md:text-7xl font-bold tabular-nums',
}

const alignStyles: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

export function TextBlock({ block }: { block: TextBlock }) {
  return (
    <p
      className={twMerge(
        variantStyles[block.variant],
        alignStyles[block.align ?? 'left']
      )}
    >
      {block.content}
    </p>
  )
}
