'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { ArrowLeft, Globe, EyeOff, Loader2, Check, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { track } from '@vercel/analytics'
import { useEditorStore } from '@/lib/editor-store'
import { createBrowserSupabase } from '@/lib/supabase'
import { PageListSidebar } from '@/components/studio/PageListSidebar'
import { EditorCanvas } from '@/components/studio/EditorCanvas'
import { SettingsPanel } from '@/components/studio/settings'
import { PreviewModal } from '@/components/studio/PreviewModal'
import { PageManagerModal } from '@/components/studio/PageManagerModal'
import { MobileEditorDock } from '@/components/studio/MobileEditorDock'
import { Grid } from 'lucide-react'
import type { Book } from '@/lib/book-schema'

interface Props {
  book: Book
}

export function EditorClient({ book }: Props) {
  const { book: storeBook, isDirty, setBook, setIsSaving } = useEditorStore()
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [titleEditing, setTitleEditing] = useState(false)
  const [titleValue, setTitleValue] = useState(book.title)
  const [showPreview, setShowPreview] = useState(false)
  const [showPageManager, setShowPageManager] = useState(false)

  // Warn about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveInFlight = useRef(false)
  const supabase = createBrowserSupabase()

  // Initialize store on mount
  useEffect(() => {
    setBook(book)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave: debounced 2s after any dirty change
  const save = useCallback(async () => {
    if (saveInFlight.current) return // a save is already in flight — the trailing edit will schedule its own
    const current = useEditorStore.getState()
    if (!current.book || !current.isDirty) return

    const bookAtSaveStart = current.book
    saveInFlight.current = true
    setIsSaving(true)
    setSaveStatus('saving')

    try {
      // Save book-level fields
      await supabase
        .from('books')
        .update({
          theme: bookAtSaveStart.theme,
          settings: bookAtSaveStart.settings,
          title: bookAtSaveStart.title,
          description: bookAtSaveStart.description ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookAtSaveStart.id)

      // Upsert all pages
      if (bookAtSaveStart.pages && bookAtSaveStart.pages.length > 0) {
        const pagesPayload = bookAtSaveStart.pages.map((p) => ({
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

      // Only clear isDirty if nothing changed while this save was in
      // flight — otherwise a newer, unsaved edit gets incorrectly marked
      // as saved and the next autosave never fires for it.
      if (useEditorStore.getState().book === bookAtSaveStart) {
        useEditorStore.setState({ isDirty: false })
      }
      setSaveStatus('saved')
      setLastSavedAt(new Date())
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      toast.error('Save failed — check your connection')
      setSaveStatus('idle')
    } finally {
      saveInFlight.current = false
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

        const { selectedBlockId, selectedHotspotId, book } = useEditorStore.getState()
        const currentPage = book?.pages?.[useEditorStore.getState().currentPageIndex]
        if (selectedBlockId && currentPage) {
          e.preventDefault()
          useEditorStore.getState().removeBlock(currentPage.id, selectedBlockId)
        } else if (selectedHotspotId && currentPage) {
          e.preventDefault()
          useEditorStore.getState().removeHotspot(currentPage.id, selectedHotspotId)
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
    toast.success(next ? 'Edition published — it\'s live!' : 'Edition unpublished')
    if (next) track('edition_published')
  }

  const isPublished = storeBook?.settings.published ?? false

  return (
    <div className="flex flex-col h-screen bg-neutral-950 text-neutral-100 overflow-hidden">
      {/* Top toolbar */}
      <header className="flex items-center gap-3 px-4 h-13 border-b border-neutral-800 shrink-0 py-2">
        <Link
          href="/dashboard"
          aria-label="QLICO dashboard"
          className="grid h-7 w-7 place-items-center overflow-hidden rounded-md transition hover:brightness-110"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/icon-192.png" alt="" width={28} height={28} className="h-7 w-7 rounded-md" />
        </Link>
        <Link
          href="/dashboard"
          className="hidden sm:flex items-center gap-1 text-neutral-500 hover:text-neutral-200 transition-colors text-xs font-medium"
        >
          <ArrowLeft size={13} />
          <span>Dashboard</span>
        </Link>

        <div className="w-px h-5 bg-neutral-800 mx-1" />

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

        {/* Save indicator. Always says something — an empty slot next to a
            live document reads as "did my work save?" */}
        <div
          className="flex items-center gap-1.5 whitespace-nowrap text-xs text-neutral-400"
          aria-live="polite"
        >
          {saveStatus === 'saving' ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              <span>Saving…</span>
            </>
          ) : saveStatus === 'saved' ? (
            <>
              <Check size={12} className="text-emerald-400" />
              <span className="text-emerald-400">Saved</span>
            </>
          ) : (
            <span className="hidden sm:inline">
              {isDirty ? 'Unsaved changes' : <SavedAgo at={lastSavedAt} />}
            </span>
          )}
        </div>

        {/* Visual page manager */}
        <button
          onClick={() => setShowPageManager(true)}
          className="hidden items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-700 sm:flex"
          title="Arrange pages"
        >
          <Grid size={13} />
          Pages
        </button>

        {/* Preview button */}
        <button
          onClick={() => setShowPreview(true)}
          className="flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-700"
          title="Preview (⌘P)"
        >
          <Eye size={13} />
          <span className="hidden sm:inline">Preview</span>
        </button>

        {/* Publish toggle */}
        <button
          onClick={handlePublishToggle}
          className={twMerge(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
            isPublished
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'border border-neutral-700 bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
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
            className="hidden whitespace-nowrap text-xs text-neutral-400 underline underline-offset-2 transition-colors hover:text-neutral-100 sm:inline"
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

      {/* Small screens get the side panels back as bottom sheets. */}
      <MobileEditorDock />

      {/* Status Bar */}
      <div className="hidden h-8 shrink-0 items-center justify-between border-t border-neutral-800 bg-neutral-900 px-4 lg:flex">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-300">
          <div className={twMerge(
            "w-1.5 h-1.5 rounded-full",
            isDirty ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
          )} />
          {isDirty ? 'UNSAVED CHANGES' : 'ALL CHANGES SAVED'}
        </div>

        {/* neutral-400 rather than neutral-500: at 9–10px on neutral-900 the
            old value sat under the 4.5:1 contrast floor. */}
        <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-tight text-neutral-400">
          <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-neutral-300">⌘Z</kbd> Undo
          <span className="mx-1 opacity-40">|</span>
          <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-neutral-300">⇧⌘Z</kbd> Redo
          <span className="mx-1 opacity-40">|</span>
          <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-neutral-300">⌘S</kbd> Save
        </div>
      </div>

      {/* Preview modal */}
      {showPreview && <PreviewModal onClose={() => setShowPreview(false)} />}

      {/* Page Manager Modal */}
      {showPageManager && <PageManagerModal onClose={() => setShowPageManager(false)} />}
    </div>
  )
}

/**
 * "Saved" flashing for two seconds and then vanishing leaves the question
 * people actually have mid-session unanswered: when did this last save? An
 * absolute clock time beats a relative one here — it needs no ticking timer
 * to stay true, and it stays readable after a long idle.
 */
function SavedAgo({ at }: { at: Date | null }) {
  if (at === null) return null
  return (
    <>
      Saved{' '}
      <time dateTime={at.toISOString()}>
        {at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
      </time>
    </>
  )
}
