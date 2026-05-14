'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { twMerge } from 'tailwind-merge'
import { useEditorStore } from '@/lib/editor-store'
import type { TextBlock as TextBlockType } from '@/lib/book-schema'

const variantStyles: Record<TextBlockType['variant'], string> = {
  title: 'text-4xl md:text-6xl font-bold leading-tight',
  heading: 'text-2xl md:text-3xl font-semibold leading-snug',
  body: 'text-base md:text-lg leading-relaxed',
  caption: 'text-sm opacity-70 italic',
  quote: 'text-xl md:text-2xl italic border-l-4 border-[var(--primary)] pl-4 opacity-90',
  stat: 'text-5xl md:text-7xl font-bold tabular-nums',
}

const alignStyles: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

export function TextBlock({ block, pageId }: { block: TextBlockType; pageId?: string }) {
  const [isEditing, setIsEditing] = useState(false)
  const [content, setContent] = useState(block.content)
  const { selectedBlockId, updateBlock } = useEditorStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Exit edit mode if block is deselected
  useEffect(() => {
    if (selectedBlockId !== block.id) {
      setIsEditing(false)
    }
  }, [selectedBlockId, block.id])

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      // Move cursor to end
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length)
    }
  }, [isEditing])

  function handleSave() {
    setIsEditing(false)
    if (pageId && content !== block.content) {
      updateBlock(pageId, block.id, { content })
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setContent(block.content) // Revert
      setIsEditing(false)
    }
  }

  const isHeading = ['title', 'heading', 'stat'].includes(block.variant)

  const containerClasses = twMerge(
    variantStyles[block.variant],
    alignStyles[block.align ?? 'left'],
    'text-[var(--text-color)] transition-all'
  )

  const fontStyle = { fontFamily: isHeading ? 'var(--heading-font)' : 'var(--body-font)' }

  if (isEditing && pageId) {
    return (
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={twMerge(
          containerClasses,
          'w-full bg-transparent border-0 outline-none resize-none ring-2 ring-blue-500 rounded p-1'
        )}
        style={{ minHeight: '1em', overflow: 'hidden', ...fontStyle }}
        rows={content.split('\n').length || 1}
      />
    )
  }

  return (
    <div
      onDoubleClick={() => pageId && setIsEditing(true)}
      className={twMerge(
        containerClasses,
        'prose-a:text-[var(--primary)] prose-a:underline hover:prose-a:opacity-80'
      )}
      style={fontStyle}
    >
      <ReactMarkdown>{block.content}</ReactMarkdown>
    </div>
  )
}
