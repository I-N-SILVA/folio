'use client'

import { useEditorStore } from '@/lib/editor-store'
import { Copy, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import type { Block } from '@/lib/book-schema'
import { TextBlockForm } from './TextBlockForm'
import { ImageBlockForm } from './ImageBlockForm'
import { VideoBlockForm } from './VideoBlockForm'
import { AudioBlockForm } from './AudioBlockForm'
import { ButtonBlockForm } from './ButtonBlockForm'
import { EmbedBlockForm } from './EmbedBlockForm'
import { DataBlockForm } from './DataBlockForm'
import { ProductGridBlockForm } from './ProductGridBlockForm'

export function BlockSettingsForm({ block, pageId }: { block: Block; pageId: string }) {
  const { removeBlock, duplicateBlock, moveBlock, book } = useEditorStore()
  const page = book?.pages?.find((p) => p.id === pageId)
  const blockIndex = page?.blocks.findIndex((b) => b.id === block.id) ?? -1
  const canMoveUp = blockIndex > 0
  const canMoveDown = page ? blockIndex < page.blocks.length - 1 : false

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
        <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
          {block.type === 'product-grid' ? 'Product Grid' : block.type} block
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={() => moveBlock(pageId, block.id, 'up')}
            title="Move block up"
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-25"
          >
            <ArrowUp size={13} />
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={() => moveBlock(pageId, block.id, 'down')}
            title="Move block down"
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-25"
          >
            <ArrowDown size={13} />
          </button>
          <button
            type="button"
            onClick={() => duplicateBlock(pageId, block.id)}
            title="Duplicate block"
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800"
          >
            <Copy size={13} />
          </button>
          <button
            type="button"
            onClick={() => removeBlock(pageId, block.id)}
            title="Delete block"
            className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-950/40"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {block.type === 'text' && <TextBlockForm block={block} pageId={pageId} />}
      {block.type === 'image' && <ImageBlockForm block={block} pageId={pageId} />}
      {block.type === 'video' && <VideoBlockForm block={block} pageId={pageId} />}
      {block.type === 'audio' && <AudioBlockForm block={block} pageId={pageId} />}
      {block.type === 'button' && <ButtonBlockForm block={block} pageId={pageId} />}
      {block.type === 'divider' && (
        <p className="text-xs text-neutral-500">No settings for divider block.</p>
      )}
      {block.type === 'embed' && <EmbedBlockForm block={block} pageId={pageId} />}
      {block.type === 'data' && <DataBlockForm block={block} pageId={pageId} />}
      {block.type === 'product-grid' && <ProductGridBlockForm block={block} pageId={pageId} />}
    </div>
  )
}
