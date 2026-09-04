'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import {
  ArrowLeft,
  Globe,
  EyeOff,
  Loader2,
  Check,
  Eye,
  Share2,
  Grid,
  Undo2,
  Redo2,
  Keyboard,
  Search,
  FolderOpen,
} from 'lucide-react'
import { toast } from 'sonner'
import { trackProduct } from '@/lib/product-analytics'
import { useEditorStore } from '@/lib/editor-store'
import { PageListSidebar } from '@/components/studio/PageListSidebar'
import { EditorCanvas } from '@/components/studio/EditorCanvas'
import { SettingsPanel } from '@/components/studio/settings'
import { PreviewModal } from '@/components/studio/PreviewModal'
import { PageManagerModal } from '@/components/studio/PageManagerModal'
import { ShareModal } from '@/components/studio/ShareModal'
import { ShortcutsModal } from '@/components/studio/ShortcutsModal'
import { CommandPalette } from '@/components/studio/CommandPalette'
import { PublishChecklistModal } from '@/components/studio/PublishChecklistModal'
import { AssetLibraryModal } from '@/components/studio/AssetLibraryModal'
import { MobileEditorDock } from '@/components/studio/MobileEditorDock'
import { EntitlementsProvider, type StudioEntitlements } from '@/components/studio/EntitlementsContext'
import { publishChecks, type PublishIssue } from '@/lib/publish-checks'
import type { Book } from '@/lib/book-schema'

interface Props {
  book: Book
  entitlements: StudioEntitlements
}

export function EditorClient({ book, entitlements }: Props) {
  const { book: storeBook, isDirty, setBook, setIsSaving } = useEditorStore()
  const past = useEditorStore((s) => s.past)
  const future = useEditorStore((s) => s.future)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [titleEditing, setTitleEditing] = useState(false)
  const [titleValue, setTitleValue] = useState(book.title)
  const [showPreview, setShowPreview] = useState(false)
  const [showPageManager, setShowPageManager] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showAssetLibrary, setShowAssetLibrary] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [pendingChecks, setPendingChecks] = useState<PublishIssue[] | null>(null)

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

  /**
   * What the last successful save wrote, by object identity.
   *
   * Every save used to send both requests unconditionally, so toggling one
   * setting rewrote every page of the edition and re-rendering one text block
   * rewrote the book row — every two seconds, for the whole session. The store
   * replaces only the branch that changed, so identity is an exact and free
   * answer to "did this part move?".
   */
  const saved = useRef<{ pages?: unknown; meta?: string }>({})

  /** The book-level fields, as the API receives them. */
  const metaOf = (b: Book) =>
    JSON.stringify({
      theme: b.theme,
      settings: b.settings,
      title: b.title,
      description: b.description ?? null,
    })

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
      const meta = metaOf(bookAtSaveStart)
      const pagesChanged = bookAtSaveStart.pages !== saved.current.pages
      const metaChanged = meta !== saved.current.meta

      // Book-level fields go through the API so the Zod schema applies to what
      // the editor writes, the same way it applies to every other write path.
      if (metaChanged) {
        const bookRes = await fetch(`/api/books/${bookAtSaveStart.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            theme: bookAtSaveStart.theme,
            settings: bookAtSaveStart.settings,
            title: bookAtSaveStart.title,
            description: bookAtSaveStart.description ?? undefined,
          }),
        })
        if (!bookRes.ok) throw new Error('Could not save this edition’s settings')
      }

      // Pages go through the transactional replace route.
      //
      // This used to upsert the page rows straight from the browser on `id`,
      // which quietly broke the two structural edits the editor offers. A page
      // the author deleted was never deleted — the upsert only writes the rows
      // it is given, so the row survived and the page reappeared on reload. And
      // a reorder renumbers `page_number` into a UNIQUE (book_id, page_number)
      // constraint that is checked per row, so swapping two pages collided
      // mid-statement and surfaced as "Save failed — check your connection".
      //
      // PUT /api/books/[id]/pages replaces the whole set inside one transaction
      // (see supabase/migrations/010), which is what "the pages are now this"
      // actually requires — so it is sent only when the pages have moved.
      if (pagesChanged) {
        const pagesRes = await fetch(`/api/books/${bookAtSaveStart.id}/pages`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            (bookAtSaveStart.pages ?? []).map((p) => ({
              id: p.id,
              page_number: p.page_number,
              type: p.type,
              layout: p.layout,
              background: p.background ?? undefined,
              blocks: p.blocks,
              hotspots: p.hotspots,
            }))
          ),
        })
        if (!pagesRes.ok) throw new Error('Could not save these pages')
      }

      saved.current = { pages: bookAtSaveStart.pages, meta }

      // Only clear isDirty if nothing changed while this save was in
      // flight — otherwise a newer, unsaved edit gets incorrectly marked
      // as saved and the next autosave never fires for it.
      if (useEditorStore.getState().book === bookAtSaveStart) {
        useEditorStore.setState({ isDirty: false })
      }
      setSaveStatus('saved')
      setLastSavedAt(new Date())
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      // Say what failed. "Check your connection" was the message for every
      // failure including constraint violations, which sent authors to retry a
      // save that could never succeed.
      toast.error(err instanceof Error ? err.message : 'Save failed — check your connection')
      setSaveStatus('idle')
    } finally {
      saveInFlight.current = false
      setIsSaving(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Save and actually wait for it — including waiting out an autosave that is
   * already in flight, which `save()` returns early from. Publishing needs this:
   * the share dialog hands over a link, so the publish flag has to have landed
   * before the author can paste it anywhere.
   */
  const saveNow = useCallback(async () => {
    for (let i = 0; i < 50 && saveInFlight.current; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    await save()
  }, [save])

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

      // Cmd+K → Quick Action Command Palette
      if (meta && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette((v) => !v)
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
        setShowCommandPalette(false)
        setShowAssetLibrary(false)
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

      // ? key → toggle shortcuts modal
      if (e.key === '?' && !meta) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        e.preventDefault()
        setShowShortcuts((v) => !v)
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

  /**
   * Publishing used to flip a boolean with nothing looking at the edition first.
   * A button still pointing at `https://example.com`, an image with no alt text
   * or a gate set past the last page are all invisible in the editor and obvious
   * to whoever opens the link. The checks run on the way out, not while writing.
   */
  const handlePublishToggle = async () => {
    if (!storeBook) return
    if (!storeBook.settings.published) {
      setPendingChecks(publishChecks(storeBook))
      return
    }
    await applyPublish()
  }

  const applyPublish = async () => {
    if (!storeBook) return
    const next = !storeBook.settings.published
    useEditorStore.setState((s) => ({
      isDirty: true,
      book: s.book
        ? { ...s.book, settings: { ...s.book.settings, published: next } }
        : s.book,
    }))

    if (!next) {
      toast.success('Edition unpublished')
      return
    }

    trackProduct('edition_published', { pages: storeBook.pages?.length ?? 0 })

    // Publishing used to end in a toast, and that was the whole moment. But an
    // edition nobody has the link to produces nothing — no reader, no analytics,
    // no lead — so the step that creates every downstream value was left for the
    // author to think of on their own. Force the save first so the link works
    // the instant they paste it, then hand them the link.
    setPublishing(true)
    try {
      await saveNow()
    } finally {
      setPublishing(false)
    }
    setShowShare(true)
  }

  const isPublished = storeBook?.settings.published ?? false

  return (
    <EntitlementsProvider value={entitlements}>
    <div className="flex flex-col h-screen bg-neutral-950 text-neutral-100 overflow-hidden">
      {/* Top toolbar */}
      <header className="flex items-center gap-3 px-4 h-13 border-b border-neutral-800 shrink-0 py-2">
        <Link
          href="/dashboard"
          aria-label="QLICO dashboard"
          className="flex items-center gap-2 rounded-lg p-1 transition hover:bg-neutral-800"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/icon.svg" alt="QLICO" width={28} height={28} className="h-7 w-7 rounded-md object-contain" />
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

        {/* Live Autosave & Sync Status Badge */}
        <div
          className="flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/90 px-3 py-1 text-xs text-neutral-300 select-none shadow-sm"
          aria-live="polite"
        >
          {saveStatus === 'saving' ? (
            <>
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping shrink-0" />
              <span className="text-amber-300 font-medium">Syncing changes…</span>
            </>
          ) : saveStatus === 'saved' ? (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-emerald-400 font-medium">Saved</span>
            </>
          ) : isDirty ? (
            <>
              <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-neutral-300">Unsaved edits</span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-500/80 shrink-0" />
              <span className="hidden sm:inline text-neutral-400 font-normal">
                <SavedAgo at={lastSavedAt} />
              </span>
            </>
          )}
        </div>

        {/* Undo / Redo controls */}
        <div className="hidden items-center gap-0.5 rounded-md border border-neutral-800 bg-neutral-900/80 p-0.5 sm:flex">
          <button
            onClick={() => useEditorStore.getState().undo()}
            disabled={past.length === 0}
            className="rounded p-1 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-400"
            title="Undo (⌘Z)"
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={() => useEditorStore.getState().redo()}
            disabled={future.length === 0}
            className="rounded p-1 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-400"
            title="Redo (⇧⌘Z)"
          >
            <Redo2 size={14} />
          </button>
        </div>

        {/* Quick Action Command Palette Trigger */}
        <button
          onClick={() => setShowCommandPalette(true)}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/90 px-2.5 py-1 text-xs text-neutral-300 transition hover:border-neutral-700 hover:bg-neutral-800 hover:text-white"
          title="Search actions (⌘K)"
        >
          <Search size={13} className="text-neutral-400" />
          <span className="hidden md:inline font-medium">Quick Actions</span>
          <kbd className="hidden md:inline rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400">⌘K</kbd>
        </button>

        {/* High-Res Asset & Texture Library Trigger */}
        <button
          onClick={() => setShowAssetLibrary(true)}
          className="hidden sm:flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-200 transition hover:bg-neutral-800 hover:text-white"
          title="Curated Asset & Texture Library"
        >
          <FolderOpen size={13} className="text-neutral-400" />
          <span className="hidden lg:inline">Asset Library</span>
        </button>

        {/* Shortcuts cheatsheet */}
        <button
          onClick={() => setShowShortcuts(true)}
          className="hidden items-center rounded-md border border-neutral-800 bg-neutral-900/80 p-1.5 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-100 sm:flex"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard size={14} />
        </button>

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

        {/* Share. There was no way to copy an edition's link or get its embed
            snippet anywhere in the app — the modal existed but nothing opened
            it. */}
        <button
          onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-700"
          title="Share or embed"
        >
          <Share2 size={13} />
          <span className="hidden sm:inline">Share</span>
        </button>

        {/* Publish toggle */}
        <button
          onClick={handlePublishToggle}
          disabled={publishing}
          className={twMerge(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60',
            isPublished
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'border border-neutral-700 bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
          )}
        >
          {publishing ? (
            <Loader2 size={13} className="animate-spin" />
          ) : isPublished ? (
            <Globe size={13} />
          ) : (
            <EyeOff size={13} />
          )}
          {publishing ? 'Publishing…' : isPublished ? 'Published' : 'Draft'}
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

      {/* The status bar that used to sit here showed save state for the third
          time — the header pill and its timestamp already say it — and spent 32px
          of canvas restating shortcuts the ? modal lists. */}

      {/* Command Palette (⌘K) */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onOpenPreview={() => setShowPreview(true)}
        onOpenShare={() => setShowShare(true)}
        /* Both of these were `() => {}`. A palette that silently no-ops teaches
           people not to open it, so they are wired to the canvas that owns them
           via a small event rather than left as decoration. */
        onToggleGuides={() => window.dispatchEvent(new CustomEvent('qlico:toggle-guides'))}
        onAutoDetectPins={() => window.dispatchEvent(new CustomEvent('qlico:detect-pins'))}
        onOpenAssetLibrary={() => setShowAssetLibrary(true)}
      />

      {/* Asset & Texture Library Modal */}
      <AssetLibraryModal
        isOpen={showAssetLibrary}
        onClose={() => setShowAssetLibrary(false)}
        onSelect={(url, alt) => {
          const { book, currentPageIndex, addBlock } = useEditorStore.getState()
          const currentPage = book?.pages?.[currentPageIndex]
          if (currentPage) {
            addBlock(currentPage.id, {
              id: crypto.randomUUID(),
              type: 'image',
              src: url,
              alt: alt || '',
              lightbox: true,
            })
            toast.success(`Inserted "${alt || 'asset'}" into Page ${currentPage.page_number}`)
          }
        }}
      />

      {/* Preview modal */}
      {showPreview && <PreviewModal onClose={() => setShowPreview(false)} />}

      {/* Page Manager Modal */}
      {showPageManager && <PageManagerModal onClose={() => setShowPageManager(false)} />}

      {/* Shortcuts Modal */}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

      {pendingChecks !== null && (
        <PublishChecklistModal
          issues={pendingChecks}
          onClose={() => setPendingChecks(null)}
          onConfirm={() => {
            setPendingChecks(null)
            applyPublish()
          }}
        />
      )}

      {showShare && storeBook?.slug && (
        <ShareModal
          slug={storeBook.slug}
          published={isPublished}
          book={storeBook}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
    </EntitlementsProvider>
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
