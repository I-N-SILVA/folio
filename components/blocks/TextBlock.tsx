'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { twMerge } from 'tailwind-merge'
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight, Check } from 'lucide-react'
import { useEditorStore } from '@/lib/editor-store'
import type { TextBlock as TextBlockType } from '@/lib/book-schema'

const variantStyles: Record<TextBlockType['variant'], string> = {
  title: 'font-display text-4xl md:text-6xl font-bold leading-[1.08] tracking-[-0.04em]',
  heading: 'font-display text-2xl md:text-3xl font-semibold leading-snug tracking-[-0.025em]',
  body: 'text-base md:text-lg leading-relaxed font-normal tracking-[-0.01em]',
  caption: 'text-xs md:text-sm opacity-75 italic leading-normal tracking-wide',
  quote: 'text-xl md:text-2xl italic border-l-3 border-[var(--primary)] pl-4 opacity-95 leading-relaxed tracking-[-0.01em]',
  stat: 'font-display text-5xl md:text-7xl font-bold tabular-nums tracking-[-0.05em]',
}

const fontSizeStyles: Record<string, string> = {
  xs: 'text-xs md:text-xs',
  sm: 'text-sm md:text-sm',
  base: 'text-base md:text-base',
  lg: 'text-lg md:text-lg',
  xl: 'text-xl md:text-xl',
  '2xl': 'text-2xl md:text-3xl',
  '4xl': 'text-3xl md:text-5xl',
  '6xl': 'text-5xl md:text-7xl',
}

const paddingStyles: Record<string, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-8',
}

const radiusStyles: Record<string, string> = {
  none: 'rounded-none',
  sm: 'rounded-md',
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  full: 'rounded-full',
}

const spacingStyles: Record<string, string> = {
  tighter: 'tracking-tighter',
  tight: 'tracking-tight',
  normal: 'tracking-normal',
  wide: 'tracking-wide',
  widest: 'tracking-widest',
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

  useEffect(() => {
    setContent(block.content)
  }, [block.content])

  // Exit edit mode if block is deselected
  useEffect(() => {
    if (selectedBlockId !== block.id) {
      if (isEditing && pageId && content !== block.content) {
        updateBlock(pageId, block.id, { content })
      }
      setIsEditing(false)
    }
  }, [selectedBlockId, block.id, isEditing, pageId, content, block.content, updateBlock])

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length)
    }
  }, [isEditing])

  function handleSave() {
    setIsEditing(false)
    if (pageId && content !== block.content) {
      updateBlock(pageId, block.id, { content })
    }
  }

  function applyFormat(wrapper: string) {
    if (!textareaRef.current) return
    const el = textareaRef.current
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = content.substring(start, end) || 'text'
    const newContent = content.substring(0, start) + `${wrapper}${selected}${wrapper}` + content.substring(end)
    setContent(newContent)
    if (pageId) updateBlock(pageId, block.id, { content: newContent })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setContent(block.content)
      setIsEditing(false)
    } else if (e.key === 'Enter' && !e.shiftKey && ['title', 'heading', 'stat'].includes(block.variant)) {
      e.preventDefault()
      handleSave()
    }
  }

  const isHeading = ['title', 'heading', 'stat'].includes(block.variant)

  const containerClasses = twMerge(
    block.fontSize ? fontSizeStyles[block.fontSize] : variantStyles[block.variant],
    alignStyles[block.align ?? 'left'],
    block.padding ? paddingStyles[block.padding] : '',
    block.borderRadius ? radiusStyles[block.borderRadius] : '',
    block.letterSpacing ? spacingStyles[block.letterSpacing] : '',
    block.backgroundColor ? 'border border-current/10' : '',
    'text-[var(--text-color)] transition-all'
  )

  const customInlineStyle: React.CSSProperties = {
    fontFamily: isHeading ? 'var(--heading-font)' : 'var(--body-font)',
    ...(block.textColor ? { color: block.textColor } : {}),
    ...(block.backgroundColor ? { backgroundColor: block.backgroundColor } : {}),
  }

  if (isEditing && pageId) {
    return (
      <div className="relative group/editor">
        {/* Floating WYSIWYG Format Bar */}
        <div className="absolute -top-11 left-0 z-50 flex items-center gap-1 rounded-full bg-neutral-900 px-2 py-1 text-white shadow-2xl border border-neutral-700 animate-in fade-in zoom-in-95 duration-150 select-none">
          <button
            type="button"
            onClick={() => applyFormat('**')}
            title="Bold"
            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-neutral-800 text-neutral-300 hover:text-white transition"
          >
            <Bold size={12} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('*')}
            title="Italic"
            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-neutral-800 text-neutral-300 hover:text-white transition"
          >
            <Italic size={12} strokeWidth={2.5} />
          </button>

          <span className="h-3 w-px bg-neutral-700 mx-0.5" />

          {/* Align switcher */}
          <button
            type="button"
            onClick={() => updateBlock(pageId, block.id, { align: 'left' })}
            title="Align Left"
            className={twMerge(
              'flex h-6 w-6 items-center justify-center rounded-full transition',
              (block.align ?? 'left') === 'left' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
            )}
          >
            <AlignLeft size={12} />
          </button>
          <button
            type="button"
            onClick={() => updateBlock(pageId, block.id, { align: 'center' })}
            title="Align Center"
            className={twMerge(
              'flex h-6 w-6 items-center justify-center rounded-full transition',
              block.align === 'center' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
            )}
          >
            <AlignCenter size={12} />
          </button>
          <button
            type="button"
            onClick={() => updateBlock(pageId, block.id, { align: 'right' })}
            title="Align Right"
            className={twMerge(
              'flex h-6 w-6 items-center justify-center rounded-full transition',
              block.align === 'right' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
            )}
          >
            <AlignRight size={12} />
          </button>

          <span className="h-3 w-px bg-neutral-700 mx-0.5" />

          {/* Save Done */}
          <button
            type="button"
            onClick={handleSave}
            title="Done editing (Enter / Blur)"
            className="flex items-center gap-1 rounded-full bg-[var(--accent-vivid)] px-2 py-0.5 text-[10px] font-bold text-white shadow hover:opacity-90 transition"
          >
            <Check size={11} strokeWidth={3} />
            Done
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={twMerge(
            containerClasses,
            'w-full bg-black/5 dark:bg-white/5 border border-[var(--accent-vivid)] outline-none resize-none ring-2 ring-[var(--accent-vivid)]/30 rounded-lg p-2 shadow-inner'
          )}
          style={{ minHeight: '1.5em', overflow: 'hidden', ...customInlineStyle }}
          rows={Math.max(1, content.split('\n').length)}
        />
      </div>
    )
  }

  return (
    <div
      onDoubleClick={() => pageId && setIsEditing(true)}
      title={pageId ? 'Double-click to edit text directly on canvas' : undefined}
      className={twMerge(
        containerClasses,
        'prose-a:text-[var(--primary)] prose-a:underline hover:prose-a:opacity-80 transition-all'
      )}
      style={customInlineStyle}
    >
      <ReactMarkdown>{block.content}</ReactMarkdown>
    </div>
  )
}
