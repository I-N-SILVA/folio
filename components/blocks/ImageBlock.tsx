'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ImageOff } from 'lucide-react'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import type { ImageBlock } from '@/lib/book-schema'

export function ImageBlock({ block }: { block: ImageBlock }) {
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <>
      <figure className="relative w-full overflow-hidden rounded">
        <div className="relative aspect-video w-full">
          {/* A missing image used to render as an empty box, in the reader and
              in every preview alike, so an author had no way to tell a broken
              URL from an image that simply hadn't loaded yet. */}
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
              className={`object-cover ${block.lightbox ? 'cursor-zoom-in' : ''}`}
              onClick={() => block.lightbox && setOpen(true)}
              onError={() => setFailed(true)}
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          )}
        </div>
        {block.caption && (
          <figcaption className="mt-2 text-sm text-center opacity-70 italic">
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
    </>
  )
}
