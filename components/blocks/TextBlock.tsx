'use client'

import ReactMarkdown from 'react-markdown'
import { twMerge } from 'tailwind-merge'
import type { TextBlock } from '@/lib/book-schema'

const variantStyles: Record<TextBlock['variant'], string> = {
  title: 'text-4xl md:text-6xl font-bold leading-tight',
  heading: 'text-2xl md:text-3xl font-semibold leading-snug',
  body: 'text-base md:text-lg leading-relaxed',
  caption: 'text-sm opacity-70 italic',
  quote: 'text-xl md:text-2xl italic border-l-4 border-[var(--primary)] pl-4 opacity-90',
  stat: 'text-5xl md:text-7xl font-bold tabular-nums',
}

const alignStyles: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

export function TextBlock({ block }: { block: TextBlock }) {
  return (
    <div
      className={twMerge(
        variantStyles[block.variant],
        alignStyles[block.align ?? 'left'],
        'prose-a:text-[var(--primary)] prose-a:underline hover:prose-a:opacity-80 transition-all'
      )}
    >
      <ReactMarkdown>{block.content}</ReactMarkdown>
    </div>
  )
}
