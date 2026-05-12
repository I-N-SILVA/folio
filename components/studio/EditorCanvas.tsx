'use client'

import { useRef, useState, useCallback } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  Plus,
  Crosshair,
  Type,
  Image,
  Video,
  Music,
  MousePointerClick,
  Minus,
  Code2,
  X,
} from 'lucide-react'
import { useEditorStore } from '@/lib/editor-store'
import { PageRenderer } from '@/components/viewer/PageRenderer'
import type { Block } from '@/lib/book-schema'

// ─── Block Picker Modal ───────────────────────────────────────────────────────

const BLOCK_TYPES: {
  type: Block['type']
  label: string
  icon: React.ReactNode
  defaults: Omit<Block, 'id' | 'type'>
}[] = [
  {
    type: 'text',
    label: 'Text',
    icon: <Type size={20} />,
    defaults: { variant: 'body', content: 'New text block', align: 'left' },
  },
  {
    type: 'image',
    label: 'Image',
    icon: <Image size={20} />,
    defaults: { src: 'https://placehold.co/800x450', alt: '', lightbox: false },
  },
  {
    type: 'video',
    label: 'Video',
    icon: <Video size={20} />,
    defaults: {
      src: 'https://www.w3schools.com/html/mov_bbb.mp4',
      poster: 'https://placehold.co/800x450',
    },
  },
  {
    type: 'audio',
    label: 'Audio',
    icon: <Music size={20} />,
    defaults: { src: 'https://www.w3schools.com/html/horse.ogg', title: 'Audio' },
  },
  {
    type: 'button',
    label: 'Button',
    icon: <MousePointerClick size={20} />,
    defaults: { label: 'Click me', href: 'https://example.com', variant: 'primary' },
  },
  {
    type: 'divider',
    label: 'Divider',
    icon: <Minus size={20} />,
    defaults: {},
  },
  {
    type: 'embed',
    label: 'Embed',
    icon: <Code2 size={20} />,
    defaults: { html: '<div>Paste embed HTML here</div>', height: 300 },
  },
]

interface BlockPickerModalProps {
  onPick: (type: Block['type'], defaults: Omit<Block, 'id' | 'type'>) => void
  onClose: () => void
}

function BlockPickerModal({ onPick, onClose }: BlockPickerModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-neutral-900 border border-neutral-700 rounded-xl p-4 w-80 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-neutral-200">Add Block</span>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300">
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {BLOCK_TYPES.map(({ type, label, icon, defaults }) => (
            <button
              key={type}
              onClick={() => onPick(type, defaults)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
            >
              {icon}
              <span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Editor Canvas ────────────────────────────────────────────────────────────

export function EditorCanvas() {
  const {
    book,
    currentPageIndex,
    hotspotMode,
    selectedBlockId,
    setHotspotMode,
    selectBlock,
    addBlock,
    addHotspot,
  } = useEditorStore()

  const [showBlockPicker, setShowBlockPicker] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  const currentPage = book?.pages?.[currentPageIndex]

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!hotspotMode || !currentPage || !canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      addHotspot(currentPage.id, {
        id: crypto.randomUUID(),
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        label: 'New Hotspot',
        icon: 'Info',
        modal: { title: 'Hotspot', body: '' },
      })
    },
    [hotspotMode, currentPage, addHotspot]
  )

  const handleBlockPick = useCallback(
    (type: Block['type'], defaults: Omit<Block, 'id' | 'type'>) => {
      if (!currentPage) return
      const newBlock = { type, id: crypto.randomUUID(), ...defaults } as Block
      addBlock(currentPage.id, newBlock)
      setShowBlockPicker(false)
    },
    [currentPage, addBlock]
  )

  if (!book || !currentPage) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
        No page selected
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-neutral-900">
      {/* Canvas toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-800 shrink-0">
        <span className="text-xs text-neutral-500">
          Page {currentPage.page_number} · {currentPage.layout}
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setHotspotMode(!hotspotMode)}
          className={twMerge(
            'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors font-medium',
            hotspotMode
              ? 'bg-amber-500 text-amber-950'
              : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
          )}
        >
          <Crosshair size={13} />
          {hotspotMode ? 'Hotspot Mode ON' : 'Hotspot Mode'}
        </button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:20px_20px]">
        <div
          ref={canvasRef}
          className={twMerge(
            'relative bg-white rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden',
            'w-full max-w-2xl aspect-[4/3]',
            hotspotMode && 'cursor-crosshair'
          )}
          onClick={handleCanvasClick}
        >
          {/* Subtle grid on the page itself */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:40px_40px]" />
          
          {/* Wrap PageRenderer to intercept block clicks */}
          <div className="absolute inset-0">
            <PageRenderer page={currentPage} bookId={book.id} className="w-full h-full" />
          </div>

          {/* Block click overlay: transparent divs per block (z-layered over renderer) */}
          <div
            className={twMerge(
              'absolute inset-0 flex flex-col gap-0',
              hotspotMode && 'pointer-events-none'
            )}
          >
            {currentPage.blocks.map((block, blockIdx) => {
              const isSelected = selectedBlockId === block.id
              return (
                <div
                  key={block.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    selectBlock(block.id)
                  }}
                  className={twMerge(
                    'cursor-pointer transition-all relative group/block',
                    isSelected
                      ? 'ring-2 ring-inset ring-blue-500'
                      : 'hover:ring-1 hover:ring-inset hover:ring-neutral-400'
                  )}
                  style={{ flex: '1 1 auto', minHeight: 32 }}
                >
                  {/* Block reorder controls */}
                  {isSelected && (
                    <div className="absolute -right-1 top-1/2 -translate-y-1/2 translate-x-full flex flex-col gap-0.5 z-20">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          useEditorStore.getState().moveBlock(currentPage.id, block.id, 'up')
                        }}
                        disabled={blockIdx === 0}
                        className="w-5 h-5 rounded bg-blue-500 hover:bg-blue-400 text-white flex items-center justify-center text-xs disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          useEditorStore.getState().moveBlock(currentPage.id, block.id, 'down')
                        }}
                        disabled={blockIdx === currentPage.blocks.length - 1}
                        className="w-5 h-5 rounded bg-blue-500 hover:bg-blue-400 text-white flex items-center justify-center text-xs disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move down"
                      >
                        ↓
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Hotspot markers */}
          {!hotspotMode &&
            currentPage.hotspots.map((hotspot) => (
              <button
                key={hotspot.id}
                onClick={(e) => {
                  e.stopPropagation()
                  useEditorStore.getState().selectHotspot(hotspot.id)
                }}
                className="absolute w-5 h-5 rounded-full bg-amber-400 border-2 border-white shadow-md cursor-pointer -translate-x-1/2 -translate-y-1/2 hover:scale-110 transition-transform"
                style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
                title={hotspot.label}
              />
            ))}

          {hotspotMode &&
            currentPage.hotspots.map((hotspot) => (
              <div
                key={hotspot.id}
                className="absolute w-4 h-4 rounded-full bg-amber-400 border-2 border-white shadow pointer-events-none -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
              />
            ))}
        </div>
      </div>

      {/* Add Block button */}
      <div className="px-4 py-3 border-t border-neutral-800 shrink-0 flex justify-center">
        <button
          onClick={() => setShowBlockPicker(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-medium transition-colors border border-neutral-700"
        >
          <Plus size={14} />
          Add Block
        </button>
      </div>

      {showBlockPicker && (
        <BlockPickerModal
          onPick={handleBlockPick}
          onClose={() => setShowBlockPicker(false)}
        />
      )}
    </div>
  )
}
