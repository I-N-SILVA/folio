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

/** Relative luminance of a hex color (0 = black, 1 = white). */
function luminance(hex: string): number {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return 1
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => {
    const v = parseInt(h, 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
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
    
    const primaryColor = theme?.primary || preset?.primary || '#0066ff'
    const bgColor = bg?.color || theme?.background || preset?.background || '#ffffff'
    const headingFont = theme?.headingFont || preset?.headingFont || 'inherit'
    const bodyFont = theme?.bodyFont || preset?.bodyFont || 'inherit'
    
    // Determine text color from the actual page background luminance so any
    // background — preset, per-page color, or image+overlay — stays legible.
    const hasImage = Boolean(bg?.image)
    const isDark = hasImage ? true : luminance(bgColor) < 0.5
    const textColor = isDark ? '#ffffff' : '#1d1d1f'
    const mutedColor = isDark ? 'rgba(255,255,255,0.66)' : 'rgba(0,0,0,0.55)'

    const backgroundStyle: React.CSSProperties = {
      backgroundColor: bgColor,
      // Inject CSS variables for blocks to use
      ['--primary' as any]: primaryColor,
      ['--background' as any]: bgColor,
      ['--text-color' as any]: textColor,
      ['--muted-color' as any]: mutedColor,
      ['--heading-font' as any]: `"${headingFont}", sans-serif`,
      ['--body-font' as any]: `"${bodyFont}", sans-serif`,
      color: 'var(--text-color)',
      fontFamily: 'var(--body-font)',
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

        {/* Printed-page depth — a soft gutter + curl shadow on the binding edges */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            boxShadow:
              'inset 18px 0 34px -24px rgba(0,0,0,0.45), inset -18px 0 34px -24px rgba(0,0,0,0.22)',
          }}
        />

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
