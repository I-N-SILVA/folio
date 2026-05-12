'use client'

import { useState } from 'react'
import Image from 'next/image'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import type { ImageBlock } from '@/lib/book-schema'

export function ImageBlock({ block }: { block: ImageBlock }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <figure className="relative w-full overflow-hidden rounded">
        <div className="relative w-full aspect-video">
          <Image
            src={block.src}
            alt={block.alt}
            fill
            className={`object-cover ${block.lightbox ? 'cursor-zoom-in' : ''}`}
            onClick={() => block.lightbox && setOpen(true)}
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
        {block.caption && (
          <figcaption className="mt-2 text-sm text-center opacity-70 italic">
            {block.caption}
          </figcaption>
        )}
      </figure>

      {block.lightbox && (
        <Lightbox
          open={open}
          close={() => setOpen(false)}
          slides={[{ src: block.src, alt: block.alt }]}
        />
      )}
    </>
  )
}
