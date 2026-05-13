'use client'

import { forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { BlockRenderer } from '@/components/blocks'
import type { Page, Theme } from '@/lib/book-schema'
import { THEME_PRESETS } from '@/lib/book-schema'

const layoutStyles: Record<Page['layout'], string> = {
  hero: 'flex flex-col items-center justify-center text-center p-8',
  split: 'grid grid-cols-2 gap-6 p-8 items-center',
  text: 'flex flex-col gap-4 p-8 justify-center max-w-prose mx-auto',
  blank: '',
}

interface PageRendererProps {
  page: Page
  bookId: string
  theme?: Theme
  className?: string
  renderBlockWrapper?: (block: import('@/lib/book-schema').Block, children: React.ReactNode) => React.ReactNode
}

export const PageRenderer = forwardRef<HTMLDivElement, PageRendererProps>(
  ({ page, bookId, theme, className, renderBlockWrapper }, ref) => {
    const bg = page.background

    // Resolve theme colors
    const preset = theme?.preset && theme.preset !== 'custom' 
      ? THEME_PRESETS[theme.preset as keyof typeof THEME_PRESETS] 
      : null
    
    const primaryColor = theme?.primary || preset?.primary || '#01696F'
    const bgColor = bg?.color || theme?.background || preset?.background || '#ffffff'

    const backgroundStyle: React.CSSProperties = {
      backgroundColor: bgColor,
      // Inject CSS variables for blocks to use
      ['--primary' as any]: primaryColor,
      ['--background' as any]: bgColor,
      color: theme?.preset === 'carbon' || theme?.preset === 'slate' ? 'white' : 'inherit',
    }
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
        <div className={twMerge("relative z-10 w-full", page.layout !== 'split' && "flex flex-col gap-4")}>
          {page.blocks.map((block) => {
            const blockElement = <BlockRenderer key={block.id} block={block} bookId={bookId} pageId={page.id} />
            return renderBlockWrapper ? renderBlockWrapper(block, blockElement) : blockElement
          })}
        </div>
      </div>
    )
  }
)

PageRenderer.displayName = 'PageRenderer'
