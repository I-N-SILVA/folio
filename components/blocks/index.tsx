'use client'

import { Suspense, lazy } from 'react'
import type { Block } from '@/lib/book-schema'

// Lazy-load heavy block components — code-splits the bundle
const TextBlock = lazy(() => import('./TextBlock').then((m) => ({ default: m.TextBlock })))
const ImageBlock = lazy(() => import('./ImageBlock').then((m) => ({ default: m.ImageBlock })))
const VideoBlock = lazy(() => import('./VideoBlock').then((m) => ({ default: m.VideoBlock })))
const AudioBlock = lazy(() => import('./AudioBlock').then((m) => ({ default: m.AudioBlock })))
const ButtonBlock = lazy(() => import('./ButtonBlock').then((m) => ({ default: m.ButtonBlock })))
const DividerBlock = lazy(() => import('./DividerBlock').then((m) => ({ default: m.DividerBlock })))
const EmbedBlock = lazy(() => import('./EmbedBlock').then((m) => ({ default: m.EmbedBlock })))

function BlockFallback() {
  return <div className="h-8 bg-current opacity-10 rounded animate-pulse" />
}

export function BlockRenderer({ block, bookId, pageId }: { block: Block; bookId: string; pageId?: string }) {
  return (
    <Suspense fallback={<BlockFallback />}>
      {block.type === 'text' && <TextBlock block={block} pageId={pageId} />}
      {block.type === 'image' && <ImageBlock block={block} />}
      {block.type === 'video' && <VideoBlock block={block} bookId={bookId} />}
      {block.type === 'audio' && <AudioBlock block={block} bookId={bookId} />}
      {block.type === 'button' && <ButtonBlock block={block} bookId={bookId} />}
      {block.type === 'divider' && <DividerBlock block={block} />}
      {block.type === 'embed' && <EmbedBlock block={block} />}
    </Suspense>
  )
}
