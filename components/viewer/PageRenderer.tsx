'use client'

import { forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { BlockRenderer } from '@/components/blocks'
import type { Page, Theme } from '@/lib/book-schema'
import { THEME_PRESETS } from '@/lib/book-schema'

const layoutStyles: Record<Page['layout'], string> = {
  hero: 'flex flex-col items-center justify-center text-center p-6 md:p-10',
  split: 'flex flex-col justify-center p-6 md:p-10',
  grid: 'flex flex-col justify-center p-6 md:p-8',
  text: 'flex flex-col gap-4 p-6 md:p-10 justify-center max-w-prose mx-auto',
  blank: 'p-6 md:p-8 flex flex-col justify-start',
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
  /** Hide the binding-gutter shadow — there's no facing page to bind against
   *  in single-page/mobile-portrait mode, so the inset shadow looks wrong. */
  hideGutter?: boolean
  /** Position in a 2-page spread: 'left' has spine on the right, 'right' has spine on the left. */
  pageSide?: 'left' | 'right' | 'single'
  renderBlockWrapper?: (block: import('@/lib/book-schema').Block, children: React.ReactNode) => React.ReactNode
}

export const PageRenderer = forwardRef<HTMLDivElement, PageRendererProps>(
  ({ page, bookId, theme, className, hideGutter, pageSide = 'single', renderBlockWrapper }, ref) => {
    const bg = page.background

    // Resolve theme colors
    const preset = theme?.preset && theme.preset !== 'custom' 
      ? THEME_PRESETS[theme.preset as keyof typeof THEME_PRESETS] 
      : null
    
    const primaryColor = theme?.primary || preset?.primary || '#3c2384'
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
      backgroundStyle.backgroundSize = bg.imageFit ?? 'cover'
      backgroundStyle.backgroundPosition = bg.imagePosition ?? 'center'
      backgroundStyle.backgroundRepeat = 'no-repeat'
    }

    const blurCls = bg?.blur === 'sm' ? 'backdrop-blur-sm' : bg?.blur === 'md' ? 'backdrop-blur-md' : bg?.blur === 'lg' ? 'backdrop-blur-xl' : ''
    const overlayOpacity = typeof bg?.overlayOpacity === 'number' ? bg.overlayOpacity / 100 : (bg?.image ? 0.4 : 0)

    return (
      <div
        ref={ref}
        className={twMerge(
          'relative w-full h-full overflow-hidden select-none',
          layoutStyles[page.layout],
          className
        )}
        style={backgroundStyle}
      >
        {/* Blur backdrop layer if requested */}
        {blurCls && (
          <div className={twMerge('absolute inset-0 pointer-events-none z-0', blurCls)} />
        )}

        {/* Overlay for image backgrounds with adjustable opacity */}
        {(bg?.overlay || (bg?.image && overlayOpacity > 0)) && (
          <div
            className="absolute inset-0 pointer-events-none z-0 transition-opacity"
            style={{
              backgroundColor: bg?.overlay || '#000000',
              opacity: overlayOpacity,
            }}
          />
        )}

        {/* Tactile paper grain & finish texture overlay */}
        <div
          aria-hidden
          className={twMerge(
            'pointer-events-none absolute inset-0 z-[1]',
            (bg?.paperTexture === 'washi' || theme?.paperTexture === 'washi') && 'opacity-[0.08] mix-blend-multiply',
            (bg?.paperTexture === 'linen' || theme?.paperTexture === 'linen') && 'opacity-[0.07] mix-blend-overlay',
            (bg?.paperTexture === 'matte' || theme?.paperTexture === 'matte') && 'opacity-[0.05] mix-blend-multiply',
            (bg?.paperTexture === 'carbon' || theme?.paperTexture === 'carbon') && 'opacity-[0.09] mix-blend-soft-light',
            (bg?.paperTexture === 'gloss' || theme?.paperTexture === 'gloss') && 'opacity-[0.04] mix-blend-screen',
            (!bg?.paperTexture || bg?.paperTexture === 'none') && (!theme?.paperTexture || theme?.paperTexture === 'none') && 'opacity-[0.035] mix-blend-multiply'
          )}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Authentic asymmetric spine binding shadow */}
        {!hideGutter && pageSide !== 'single' && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[2]"
            style={{
              background:
                pageSide === 'left'
                  ? 'linear-gradient(to left, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.04) 8%, transparent 22%)'
                  : 'linear-gradient(to right, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.04) 8%, transparent 22%)',
              boxShadow:
                pageSide === 'left'
                  ? 'inset -22px 0 32px -16px rgba(0,0,0,0.4), inset 1px 0 0 rgba(255,255,255,0.06)'
                  : 'inset 22px 0 32px -16px rgba(0,0,0,0.4), inset -1px 0 0 rgba(255,255,255,0.06)',
            }}
          />
        )}

        {/* Soft edge vignette on single/mobile pages */}
        {!hideGutter && pageSide === 'single' && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[2]"
            style={{
              boxShadow: 'inset 0 0 40px -20px rgba(0,0,0,0.25)',
            }}
          />
        )}

        {/* Blocks */}
        <div
          className={twMerge(
            'relative z-10 w-full',
            page.layout === 'split'
              ? 'grid grid-cols-1 md:grid-cols-2 gap-6 items-center'
              : page.layout === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 gap-4 items-start'
              : 'flex flex-col gap-4'
          )}
        >
          {page.blocks.map((block) => {
            const blockElement = <BlockRenderer key={block.id} block={block} bookId={bookId} pageId={page.id} />
            return renderBlockWrapper ? renderBlockWrapper(block, blockElement) : blockElement
          })}
        </div>

        {/* Dynamic corner peel indicator cues on outer corners */}
        {pageSide === 'right' && (
          <div
            aria-hidden
            className="group/corner pointer-events-none absolute bottom-0 right-0 z-[15] h-12 w-12 overflow-hidden"
          >
            <div className="absolute -bottom-10 -right-10 h-16 w-16 -rotate-45 bg-gradient-to-tr from-black/20 via-black/5 to-transparent transition-all duration-300 group-hover/corner:-bottom-7 group-hover/corner:-right-7 group-hover/corner:opacity-100" />
            <div className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-black/10 transition-all duration-300 group-hover/corner:h-6 group-hover/corner:w-6 group-hover/corner:border-black/30" />
          </div>
        )}
        {pageSide === 'left' && (
          <div
            aria-hidden
            className="group/corner pointer-events-none absolute bottom-0 left-0 z-[15] h-12 w-12 overflow-hidden"
          >
            <div className="absolute -bottom-10 -left-10 h-16 w-16 rotate-45 bg-gradient-to-tl from-black/20 via-black/5 to-transparent transition-all duration-300 group-hover/corner:-bottom-7 group-hover/corner:-left-7 group-hover/corner:opacity-100" />
            <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-black/10 transition-all duration-300 group-hover/corner:h-6 group-hover/corner:w-6 group-hover/corner:border-black/30" />
          </div>
        )}
      </div>
    )
  }
)

PageRenderer.displayName = 'PageRenderer'
