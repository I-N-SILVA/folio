'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ImageOff, ImagePlus } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import type { ImageBlock } from '@/lib/book-schema'
import { EmptyBlock } from './EmptyBlock'

const aspectStyles: Record<string, string> = {
  auto: 'aspect-video',
  '1/1': 'aspect-square',
  '16/9': 'aspect-video',
  '4/3': 'aspect-[4/3]',
  '3/4': 'aspect-[3/4]',
  '2/3': 'aspect-[2/3]',
  '21/9': 'aspect-[21/9]',
}

const radiusStyles: Record<string, string> = {
  none: 'rounded-none',
  sm: 'rounded-md',
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  xl: 'rounded-3xl',
  full: 'rounded-full',
}

const shadowStyles: Record<string, string> = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  '2xl': 'shadow-2xl',
}

const focalStyles: Record<string, string> = {
  center: 'object-center',
  top: 'object-top',
  bottom: 'object-bottom',
  left: 'object-left',
  right: 'object-right',
}

const widthStyles: Record<string, string> = {
  full: 'w-full max-w-full',
  '3/4': 'w-full max-w-[75%]',
  '1/2': 'w-full max-w-[50%]',
  '1/3': 'w-full max-w-[33.333%]',
  '1/4': 'w-full max-w-[25%]',
}

const alignStyles: Record<string, string> = {
  left: 'mr-auto ml-0',
  center: 'mx-auto',
  right: 'ml-auto mr-0',
}

const heightStyles: Record<string, string> = {
  none: '',
  xs: 'max-h-[160px]',
  sm: 'max-h-[240px]',
  md: 'max-h-[340px]',
  lg: 'max-h-[460px]',
  xl: 'max-h-[600px]',
}

export function ImageBlock({ block }: { block: ImageBlock }) {
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)

  // Empty is a valid draft state — see the note on `draftableUrl` in the schema.
  if (!block.src) {
    return <EmptyBlock label="Choose an image" icon={<ImagePlus size={20} />} />
  }

  const aspectCls = block.aspectRatio ? aspectStyles[block.aspectRatio] ?? 'aspect-video' : 'aspect-video'
  const radiusCls = block.borderRadius ? radiusStyles[block.borderRadius] ?? 'rounded-xl' : 'rounded-xl'
  const shadowCls = block.shadow ? shadowStyles[block.shadow] ?? 'shadow-none' : 'shadow-none'
  const focalCls = block.focalPoint ? focalStyles[block.focalPoint] ?? 'object-center' : 'object-center'
  const fitCls = block.objectFit === 'contain' ? 'object-contain' : block.objectFit === 'fill' ? 'object-fill' : 'object-cover'
  const widthCls = block.width ? widthStyles[block.width] ?? 'w-full' : 'w-full'
  const alignCls = block.align ? alignStyles[block.align] ?? 'mx-auto' : 'mx-auto'
  const heightCls = block.maxHeight ? heightStyles[block.maxHeight] ?? '' : ''

  return (
    <div className={twMerge('w-full flex', block.align === 'left' ? 'justify-start' : block.align === 'right' ? 'justify-end' : 'justify-center')}>
      <figure
        className={twMerge(
          'relative overflow-hidden transition-all',
          widthCls,
          alignCls,
          radiusCls,
          shadowCls,
          block.border ? 'border border-white/20 dark:border-white/10' : ''
        )}
        style={block.borderColor ? { borderColor: block.borderColor, borderWidth: 1, borderStyle: 'solid' } : undefined}
      >
        <div className={twMerge('relative w-full overflow-hidden', aspectCls, radiusCls, heightCls)}>
          {failed ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-current/5 text-current">
              <ImageOff size={20} className="opacity-45" />
              <span className="px-3 text-center text-[11px] leading-4 opacity-55">
                {block.alt ? `Image unavailable — ${block.alt}` : 'Image unavailable'}
              </span>
            </div>
          ) : (
            <Image
              src={block.src}
              alt={block.alt}
              fill
              className={twMerge(
                fitCls,
                focalCls,
                block.lightbox ? 'cursor-zoom-in' : '',
                'transition-transform duration-300'
              )}
              onClick={() => block.lightbox && setOpen(true)}
              onError={() => setFailed(true)}
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          )}
        </div>
        {block.caption && (
          <figcaption className="mt-2 text-xs text-center opacity-70 italic">
            {block.caption}
          </figcaption>
        )}
      </figure>

      {block.lightbox && !failed && (
        <Lightbox
          open={open}
          close={() => setOpen(false)}
          slides={[{ src: block.src, alt: block.alt }]}
        />
      )}
    </div>
  )
}
