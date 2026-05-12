'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { ArrowLeft, Globe, EyeOff, Loader2, Check, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { useEditorStore } from '@/lib/editor-store'
import { createBrowserSupabase } from '@/lib/supabase'
import { PageListSidebar } from '@/components/studio/PageListSidebar'
import { EditorCanvas } from '@/components/studio/EditorCanvas'
import { SettingsPanel } from '@/components/studio/SettingsPanel'
import { PreviewModal } from '@/components/studio/PreviewModal'
import type { Book } from '@/lib/book-schema'

interface Props {
  book: Book
}

export function EditorClient({ book }: Props) {
  const { book: storeBook, isDirty, isSaving, setBook, setIsSaving, updatePage } = useEditorStore()
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [titleEditing, setTitleEditing] = useState(false)
  const [titleValue, setTitleValue] = useState(book.title)
  const [showPreview, setShowPreview] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createBrowserSupabase()

  // Initialize store on mount
  useEffect(() => {
    setBook(book)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave: debounced 2s after any dirty change
  const save = useCallback(async () => {
    const current = useEditorStore.getState()
    if (!current.book || !current.isDirty) return

    setIsSaving(true)
    setSaveStatus('saving')

    try {
      // Save book-level fields
      await supabase
        .from('books')
        .update({
          theme: current.book.theme,
          settings: current.book.settings,
          title: current.book.title,
          description: current.book.description ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', current.book.id)

      // Upsert all pages
      if (current.book.pages && current.book.pages.length > 0) {
        const pagesPayload = current.book.pages.map((p) => ({
          id: p.id,
          book_id: p.book_id,
          page_number: p.page_number,
          type: p.type,
          layout: p.layout,
          background: p.background ?? null,
          blocks: p.blocks,
          hotspots: p.hotspots,
        }))

        await supabase
          .from('pages')
          .upsert(pagesPayload, { onConflict: 'id' })
      }

      useEditorStore.setState({ isDirty: false })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      toast.error('Save failed — check your connection')
      setSaveStatus('idle')
    } finally {
      setIsSaving(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isDirty) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      save()
    }, 2000)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [isDirty, storeBook, save])

  // Sync title from store
  useEffect(() => {
    if (storeBook?.title) setTitleValue(storeBook.title)
  }, [storeBook?.title])

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey

      // Cmd+S → force save
      if (meta && e.key === 's') {
        e.preventDefault()
        save()
        return
      }

      // Cmd+P → preview
      if (meta && e.key === 'p') {
        e.preventDefault()
        setShowPreview(true)
        return
      }

      // Escape → deselect block/hotspot
      if (e.key === 'Escape') {
        useEditorStore.getState().selectBlock(null)
        useEditorStore.getState().selectHotspot(null)
        setShowPreview(false)
        return
      }

      // Cmd+Z → undo
      if (meta && e.key === 'z' && !e.shiftKey) {
        // Don't capture if user is typing in an input/textarea
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        e.preventDefault()
        useEditorStore.getState().undo()
        return
      }

      // Cmd+Shift+Z → redo
      if (meta && e.key === 'z' && e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        e.preventDefault()
        useEditorStore.getState().redo()
        return
      }

      // Delete/Backspace → remove selected block
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't capture if user is typing in an input/textarea
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

        const { selectedBlockId, book } = useEditorStore.getState()
        const currentPage = book?.pages?.[useEditorStore.getState().currentPageIndex]
        if (selectedBlockId && currentPage) {
          e.preventDefault()
          useEditorStore.getState().removeBlock(currentPage.id, selectedBlockId)
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [save])

  const handleTitleBlur = () => {
    setTitleEditing(false)
    if (!storeBook) return
    const trimmed = titleValue.trim() || 'Untitled'
    setTitleValue(trimmed)
    useEditorStore.setState((s) => ({
      isDirty: true,
      book: s.book ? { ...s.book, title: trimmed } : s.book,
    }))
  }

  const handlePublishToggle = async () => {
    if (!storeBook) return
    const next = !storeBook.settings.published
    useEditorStore.setState((s) => ({
      isDirty: true,
      book: s.book
        ? { ...s.book, settings: { ...s.book.settings, published: next } }
        : s.book,
    }))
    toast.success(next ? 'Book published — it\'s live!' : 'Book unpublished')
  }

  const isPublished = storeBook?.settings.published ?? false

  return (
    <div className="flex flex-col h-screen bg-neutral-950 text-neutral-100 overflow-hidden">
      {/* Top toolbar */}
      <header className="flex items-center gap-3 px-4 h-12 border-b border-neutral-800 shrink-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-100 transition-colors text-sm"
        >
          <ArrowLeft size={15} />
          <span>Dashboard</span>
        </Link>

        <div className="w-px h-5 bg-neutral-700 mx-1" />

        {/* Editable title */}
        {titleEditing ? (
          <input
            autoFocus
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()}
            className="bg-neutral-800 border border-neutral-600 rounded px-2 py-0.5 text-sm font-medium text-neutral-100 outline-none focus:border-neutral-400 min-w-[160px] max-w-[360px]"
          />
        ) : (
          <button
            onClick={() => setTitleEditing(true)}
            className="text-sm font-medium text-neutral-200 hover:text-white px-1 rounded hover:bg-neutral-800 transition-colors max-w-[360px] truncate"
          >
            {titleValue}
          </button>
        )}

        <div className="flex-1" />

        {/* Save indicator */}
        <div className="flex items-center gap-1.5 text-xs text-neutral-500 w-20 justify-end">
          {saveStatus === 'saving' && (
            <>
              <Loader2 size={12} className="animate-spin" />
              <span>Saving…</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Check size={12} className="text-emerald-400" />
              <span className="text-emerald-400">Saved</span>
            </>
          )}
        </div>

        {/* Preview button */}
        <button
          onClick={() => setShowPreview(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors bg-neutral-700 hover:bg-neutral-600 text-neutral-200"
          title="Preview (⌘P)"
        >
          <Eye size={13} />
          Preview
        </button>

        {/* Publish toggle */}
        <button
          onClick={handlePublishToggle}
          className={twMerge(
            'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors',
            isPublished
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-neutral-700 hover:bg-neutral-600 text-neutral-200'
          )}
        >
          {isPublished ? <Globe size={13} /> : <EyeOff size={13} />}
          {isPublished ? 'Published' : 'Draft'}
        </button>

        {/* View Live */}
        {isPublished && storeBook?.slug && (
          <Link
            href={`/book/${storeBook.slug}`}
            target="_blank"
            className="text-xs text-neutral-400 hover:text-neutral-100 transition-colors underline underline-offset-2"
          >
            View Live
          </Link>
        )}
      </header>

      {/* Three-panel layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[240px_1fr_320px] overflow-hidden">
        <aside className="hidden lg:flex flex-col border-r border-neutral-800 overflow-hidden">
          <PageListSidebar />
        </aside>

        <main className="flex flex-col overflow-hidden">
          <EditorCanvas />
        </main>

        <aside className="hidden lg:flex flex-col border-l border-neutral-800 overflow-hidden">
          <SettingsPanel />
        </aside>
      </div>

      {/* Status Bar */}
      <div className="h-8 bg-neutral-900 border-t border-neutral-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400">
            <div className={twMerge(
              "w-1.5 h-1.5 rounded-full",
              isDirty ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
            )} />
            {isDirty ? 'UNSAVED CHANGES' : 'ALL CHANGES SAVED'}
          </div>
          <div className="h-3 w-px bg-neutral-800" />
          <div className="flex items-center gap-2 text-[10px] text-neutral-500 uppercase tracking-wider">
            <span className="font-bold text-neutral-400">Studio</span>
            <span>v1.2.4</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[9px] font-medium text-neutral-500 uppercase tracking-tighter">
            <kbd className="px-1 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-400">⌘Z</kbd> Undo
            <span className="mx-1 opacity-30">|</span>
            <kbd className="px-1 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-400">⇧⌘Z</kbd> Redo
            <span className="mx-1 opacity-30">|</span>
            <kbd className="px-1 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-400">⌘S</kbd> Save
          </div>
        </div>
      </div>

      {/* Preview modal */}
      {showPreview && <PreviewModal onClose={() => setShowPreview(false)} />}
    </div>
  )
}
