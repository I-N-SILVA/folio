'use client'

import { useEditorStore } from '@/lib/editor-store'
import type { Block } from '@/lib/book-schema'
import { TextBlockForm } from './TextBlockForm'
import { ImageBlockForm } from './ImageBlockForm'
import { VideoBlockForm } from './VideoBlockForm'
import { AudioBlockForm } from './AudioBlockForm'
import { ButtonBlockForm } from './ButtonBlockForm'
import { EmbedBlockForm } from './EmbedBlockForm'
import { DataBlockForm } from './DataBlockForm'

export function BlockSettingsForm({ block, pageId }: { block: Block; pageId: string }) {
  const { removeBlock } = useEditorStore()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
          {block.type} block
        </span>
        <button
          onClick={() => removeBlock(pageId, block.id)}
          className="text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          Delete
        </button>
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
    </div>
  )
}
