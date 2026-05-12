'use client'

import { forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { BlockRenderer } from '@/components/blocks'
import type { Page } from '@/lib/book-schema'

const layoutStyles: Record<Page['layout'], string> = {
  hero: 'flex flex-col items-center justify-center text-center p-8',
  split: 'grid grid-cols-2 gap-6 p-8 items-center',
  text: 'flex flex-col gap-4 p-8 justify-center max-w-prose mx-auto',
  blank: '',
}

interface PageRendererProps {
  page: Page
  bookId: string
  className?: string
}

export const PageRenderer = forwardRef<HTMLDivElement, PageRendererProps>(
  ({ page, bookId, className }, ref) => {
    const bg = page.background

    const backgroundStyle: React.CSSProperties = {}
    if (bg?.color) backgroundStyle.backgroundColor = bg.color
    if (bg?.image) {
      backgroundStyle.backgroundImage = `url(${bg.image})`
      backgroundStyle.backgroundSize = 'cover'
      backgroundStyle.backgroundPosition = bg.imagePosition ?? 'center'
    }

    return (
      <div
        ref={ref}
        className={twMerge(
          'relative w-full h-full overflow-hidden',
          layoutStyles[page.layout],
          className
        )}
        style={backgroundStyle}
      >
        {/* Overlay for image backgrounds */}
        {bg?.overlay && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: bg.overlay }}
          />
        )}

        {/* Blocks */}
        <div className="relative z-10 flex flex-col gap-4 w-full">
          {page.blocks.map((block) => (
            <BlockRenderer key={block.id} block={block} bookId={bookId} />
          ))}
        </div>
      </div>
    )
  }
)

PageRenderer.displayName = 'PageRenderer'
