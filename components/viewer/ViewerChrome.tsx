'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { twMerge } from 'tailwind-merge'
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Lock,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  Headphones,
  Printer,
  Search,
  ShoppingBag,
  MessageSquare,
  Globe,
  MoreHorizontal,
} from 'lucide-react'
import { LANGUAGES, type LanguageCode, getTranslation } from '@/lib/translate'
import { ViewerEngine, ViewerEngineHandle } from './ViewerEngine'
import { KeyboardHints } from './KeyboardHints'
import { ForeEdge } from './ForeEdge'
import { TableOfContents } from './TableOfContents'
import { FilmstripScrubber } from './FilmstripScrubber'
import { CartDrawer, type CartItem } from './CartDrawer'
import { SearchModal } from './SearchModal'
import { ReviewDrawer, type ReviewComment } from './ReviewDrawer'
import { playPageFlipSound, type PaperPhysics } from '@/lib/sound'
import { trackEvent } from '@/lib/tracking'
import {
  isSpeechSupported,
  speakPageText,
  stopSpeech,
  extractPageSpeechText,
} from '@/lib/speech'
import type { Book, Page } from '@/lib/book-schema'
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP, roundZoom } from '@/lib/page-geometry'

/** Width of the reading frame at 100%; scales with zoom. */
const BASE_FRAME_WIDTH = 1040

/** One row of the More menu — named, rather than an icon the reader must decode. */
function MenuRow({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value?: string
  onClick: () => void
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-[var(--qlico-ink)] transition-colors hover:bg-[var(--tint)]"
    >
      <span className="grid w-4 shrink-0 place-items-center text-[var(--qlico-muted)]">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {value && <span className="shrink-0 text-[11px] font-semibold text-[var(--qlico-muted)]">{value}</span>}
    </button>
  )
}

function subscribeToFullscreen(onChange: () => void) {
  document.addEventListener('fullscreenchange', onChange)
  return () => document.removeEventListener('fullscreenchange', onChange)
}

/** Capability checks never change after load, but still need a subscriber. */
function subscribeToNothing() {
  return () => {}
}

/** Relative luminance of a hex color (1 = white). */
function luminance(hex: string): number {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return 1
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}



export function ViewerChrome({
  book,
  embed = false,
  lockedCount = 0,
  showBadge = true,
}: {
  book: Book
  embed?: boolean
  /** Pages the server withheld behind the lead gate. */
  lockedCount?: number
  /**
   * Whether to show the "Powered by QLICO" badge. Decided on the server from the
   * *owner's plan* — this used to read `book.settings.whitelabel` directly, which
   * is a toggle the editor offers every account, so any free user could remove it.
   * Defaults to shown: a caller that forgets to pass it gets the badge, not a
   * silent free white-label.
   */
  showBadge?: boolean
}) {
  const engineRef = useRef<ViewerEngineHandle>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [showToc, setShowToc] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const reduce = useReducedMotion()

  const [narrating, setNarrating] = useState(false)
  const [speechSpeed, setSpeechSpeed] = useState<number>(1)
  const [canSpeech, setCanSpeech] = useState(false)

  useEffect(() => {
    setCanSpeech(isSpeechSupported())
    return () => {
      stopSpeech()
    }
  }, [])

  useEffect(() => {
    try {
      setSoundEnabled(localStorage.getItem('qlico:sound_enabled') === '1')
    } catch {
      // localStorage unavailable
    }
  }, [])

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev
      try {
        localStorage.setItem('qlico:sound_enabled', next ? '1' : '0')
      } catch {}
      if (next) playPageFlipSound(0.25)
      return next
    })
  }

  const handleFlip = (pageIndex: number) => {
    if (pageIndex !== currentPage && soundEnabled) {
      playPageFlipSound(0.22, (visibleBook.theme?.paperPhysics as PaperPhysics) || 'magazine')
    }
    setCurrentPage(pageIndex)
  }

  const toggleNarration = () => {
    setNarrating((prev) => !prev)
  }

  const cycleSpeed = () => {
    setSpeechSpeed((curr) => (curr === 1 ? 1.25 : curr === 1.25 ? 1.5 : 1))
  }

  const [currentLang, setCurrentLang] = useState<LanguageCode>('en')

  // Pages released by the unlock endpoint are merged in here, which remounts
  // the flip engine with the full edition — react-pageflip fixes its page count
  // at mount, so it can't grow in place.
  const [released, setReleased] = useState<Page[]>([])
  const unlocked = released.length > 0
  const visibleBook = unlocked ? { ...book, pages: [...(book.pages ?? []), ...released] } : book
  const stillLocked = unlocked ? 0 : lockedCount

  // Two different totals. `navigable` is what the flip engine actually holds —
  // the free pages plus the gate standing in for the rest — and bounds the
  // stepper. `edition` is how long the edition really is, which is what the
  // counter should say: showing "1 / 3" for a gated ten-page edition made the
  // reader think that was the whole thing.
  const navigablePages = (visibleBook.pages?.length ?? 0) + (stillLocked > 0 ? 1 : 0)
  const editionPages = (visibleBook.pages?.length ?? 0) + stillLocked
  const onGatePage = stillLocked > 0 && currentPage >= (visibleBook.pages?.length ?? 0)
  // The last spread of what the reader can actually reach — the gate counts as
  // the end for a gated edition, since that is as far as they get.
  const atEnd = navigablePages > 1 && currentPage >= navigablePages - 1

  // The button used to track its own state, so leaving fullscreen any other
  // way — Escape, F11, the OS chrome — left the icon showing "exit" while the
  // page was already windowed. The browser is the only source of truth, so
  // subscribe to it rather than mirroring it into React state.
  const fullscreen = useSyncExternalStore(
    subscribeToFullscreen,
    () => Boolean(document.fullscreenElement),
    () => false
  )

  // iOS Safari has no Element.requestFullscreen — don't offer a button that
  // can't do anything there.
  const canFullscreen = useSyncExternalStore(
    subscribeToNothing,
    () => typeof document.documentElement.requestFullscreen === 'function',
    () => false
  )

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch {
      // Fullscreen denied by browser permission policy.
    }
  }

  const [showSearch, setShowSearch] = useState(false)
  const [showCart, setShowCart] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [reviewComments, setReviewComments] = useState<ReviewComment[]>([])

  // Cmd+F shortcut for full-text search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleAddToCart = (item: Omit<CartItem, 'quantity'>) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === item.id)
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))
      }
      return [...prev, { ...item, quantity: 1 }]
    })
    setShowCart(true)
  }

  // Global event listener for shoppable block cards and hotspot buttons
  useEffect(() => {
    const onAdd = (e: Event) => {
      const customEvent = e as CustomEvent<Omit<CartItem, 'quantity'>>
      if (customEvent.detail) {
        handleAddToCart(customEvent.detail)
      }
    }
    window.addEventListener('folio:add-to-cart', onAdd)
    return () => window.removeEventListener('folio:add-to-cart', onAdd)
  }, [])

  const handleUpdateCartQuantity = (id: string, qty: number) => {
    if (qty <= 0) {
      setCartItems((prev) => prev.filter((i) => i.id !== id))
    } else {
      setCartItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: qty } : i)))
    }
  }

  const handleRemoveCartItem = (id: string) => {
    setCartItems((prev) => prev.filter((i) => i.id !== id))
  }

  const handleAddReviewComment = (c: { author: string; text: string; pageNumber: number }) => {
    setReviewComments((prev) => [
      ...prev,
      {
        id: `rev-${Date.now()}`,
        author: c.author,
        text: c.text,
        pageNumber: c.pageNumber,
        timestamp: 'Just now',
        resolved: false,
      },
    ])
  }

  const handleResolveReviewComment = (id: string) => {
    setReviewComments((prev) => prev.map((c) => (c.id === id ? { ...c, resolved: true } : c)))
  }

  // Synchronize speech synthesis with current page
  useEffect(() => {
    if (!narrating) {
      stopSpeech()
      return
    }

    const activePage = visibleBook.pages?.[currentPage]
    const textToRead = extractPageSpeechText(activePage)

    if (!textToRead) return

    speakPageText(textToRead, {
      rate: speechSpeed,
      onEnd: () => {
        if (currentPage < navigablePages - 1) {
          engineRef.current?.flipNext()
        } else {
          setNarrating(false)
        }
      },
    })
  }, [narrating, currentPage, speechSpeed, visibleBook.pages, navigablePages])

  // Handle spread ambient audio soundscape cross-fade
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    const activePage = visibleBook.pages?.[currentPage]
    const ambient = activePage?.ambientAudio

    if (ambient?.src) {
      if (!ambientAudioRef.current) {
        ambientAudioRef.current = new Audio(ambient.src)
      } else if (ambientAudioRef.current.src !== ambient.src) {
        ambientAudioRef.current.src = ambient.src
      }
      ambientAudioRef.current.loop = ambient.loop ?? true
      ambientAudioRef.current.volume = ambient.volume ?? 0.4
      ambientAudioRef.current.play().catch(() => {})
    } else {
      if (ambientAudioRef.current && !ambientAudioRef.current.paused) {
        ambientAudioRef.current.pause()
      }
    }

    return () => {
      if (ambientAudioRef.current && !ambientAudioRef.current.paused) {
        ambientAudioRef.current.pause()
      }
    }
  }, [currentPage, visibleBook.pages])

  return (
    // `relative` anchors the embed's absolutely-positioned control bar.
    <div className="relative flex w-full flex-col items-center gap-4">
      {/* Book settles in gracefully on the gallery surface. Capped width keeps a
          comfortable margin around the spread instead of edge-to-edge zoom. */}
      <motion.div
        className="relative mx-auto w-full"
        // The frame has to widen with the zoom, or the engine's own
        // `container / 2` clamp swallows anything past ~113%.
        style={{ maxWidth: Math.round(BASE_FRAME_WIDTH * zoom) }}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Ambient gallery backdrop aura */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-8 -z-10 rounded-3xl opacity-60 blur-3xl"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.04) 45%, transparent 75%)',
          }}
        />

        <ViewerEngine
          ref={engineRef}
          book={visibleBook}
          onFlip={handleFlip}
          embed={embed}
          zoom={zoom}
          lockedCount={stillLocked}
          slug={book.slug}
          onUnlocked={(pages) => setReleased(pages as Page[])}
        />
      </motion.div>

      {!embed && (
        <FilmstripScrubber
          book={visibleBook}
          currentPage={currentPage}
          onSelectPage={(i) => engineRef.current?.goTo(i)}
        />
      )}

      {!embed && (
        <ForeEdge
          total={navigablePages}
          current={currentPage}
          onSeek={(i) => engineRef.current?.goTo(i)}
        />
      )}

      {/* Every control used to be behind `!embed`, so an embedded edition had
          no page navigation at all — readers had to guess that clicking a page
          corner turned it. Embeds get a compact version of the same bar. */}
      <div
        className={twMerge(
          'z-40 flex items-center rounded-full border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/80 text-[var(--qlico-ink)] shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-2xl',
          embed
            // fixed, not absolute: inside an iframe the spread can be taller
            // than the frame, and a bar pinned to the content's bottom edge sits
            // below the visible area and gets clipped away.
            ? 'fixed bottom-3 left-1/2 -translate-x-1/2 gap-1 px-2 py-1.5'
            : 'sticky bottom-4 gap-3 px-4 py-3 sm:gap-6 sm:px-6'
        )}
      >
          <button
            onClick={() => engineRef.current?.flipPrev()}
            className={twMerge(
              'flex items-center justify-center rounded-full transition-colors hover:bg-[var(--tint)] disabled:opacity-30',
              embed ? 'h-8 w-8' : 'min-h-[44px] min-w-[44px]'
            )}
            aria-label="Previous page"
            disabled={currentPage === 0}
          >
            <ChevronLeft size={embed ? 16 : 20} />
          </button>

          <span
            className={twMerge(
              'text-center font-semibold tabular-nums tracking-[0.08em]',
              embed ? 'min-w-[54px] text-xs' : 'min-w-[80px] text-sm'
            )}
          >
            {Math.min(currentPage + 1, editionPages)} / {editionPages}
          </span>

          {stillLocked > 0 && !embed && (
            <span
              className="flex items-center gap-1 rounded-full bg-[var(--tint)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--qlico-muted)]"
              title={`${editionPages - stillLocked} of ${editionPages} pages are free to read`}
            >
              <Lock size={10} />
              {onGatePage ? 'Email to continue' : `${editionPages - stillLocked} free`}
            </span>
          )}

          <button
            onClick={() => engineRef.current?.flipNext()}
            className={twMerge(
              'flex items-center justify-center rounded-full transition-colors hover:bg-[var(--tint)] disabled:opacity-30',
              embed ? 'h-8 w-8' : 'min-h-[44px] min-w-[44px]'
            )}
            aria-label="Next page"
            disabled={currentPage >= navigablePages - 1}
          >
            <ChevronRight size={embed ? 16 : 20} />
          </button>

          {/* A capped spread left a large display mostly empty with no way to
              fill it. Desktop only — on a phone the page already spans the
              full width. */}
          <div className={twMerge('items-center gap-1', embed ? 'hidden' : 'hidden md:flex')}>
            <span className="mx-1 h-5 w-px bg-[var(--tint)]" aria-hidden="true" />
            <button
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, roundZoom(z - ZOOM_STEP)))}
              disabled={zoom <= ZOOM_MIN}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-[var(--tint)] disabled:opacity-30"
              aria-label="Zoom out"
            >
              <ZoomOut size={18} />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="min-w-[52px] rounded-full px-1 py-1 text-xs font-semibold tabular-nums transition-colors hover:bg-[var(--tint)]"
              aria-label={`Zoom ${Math.round(zoom * 100)} percent — reset to 100 percent`}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, roundZoom(z + ZOOM_STEP)))}
              disabled={zoom >= ZOOM_MAX}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-[var(--tint)] disabled:opacity-30"
              aria-label="Zoom in"
            >
              <ZoomIn size={18} />
            </button>
          </div>

          {/* In-Edition Full-Text Search */}
          {!embed && (
            <button
              onClick={() => setShowSearch(true)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[var(--qlico-muted)] transition-colors hover:bg-[var(--tint)] hover:text-[var(--qlico-ink)]"
              aria-label="Search edition (Cmd+F)"
              title="Search edition (Cmd+F)"
            >
              <Search size={18} />
            </button>
          )}

          {/* Shoppable Bag Drawer */}
          {!embed && (
            <button
              onClick={() => setShowCart(true)}
              className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[var(--qlico-muted)] transition-colors hover:bg-[var(--tint)] hover:text-[var(--qlico-ink)]"
              aria-label="Shopping Bag"
              title="Shopping Bag"
            >
              <ShoppingBag size={18} />
              {cartItems.length > 0 && (
                <span className="absolute top-1.5 right-1.5 grid h-4 w-4 place-items-center rounded-full bg-white text-[9px] font-bold text-black shadow">
                  {cartItems.reduce((acc, i) => acc + i.quantity, 0)}
                </span>
              )}
            </button>
          )}

          {/* Client Feedback & Proofing Drawer (Desktop / Tablet) */}
          {!embed && (
            <button
              onClick={() => setShowReview(true)}
              className="relative hidden sm:flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[var(--qlico-muted)] transition-colors hover:bg-[var(--tint)] hover:text-[var(--qlico-ink)]"
              aria-label="Feedback & Review"
              title="Feedback & Review"
            >
              <MessageSquare size={18} />
              {reviewComments.filter((c) => !c.resolved).length > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-400" />
              )}
            </button>
          )}

          {/* TOC / Overview drawer */}
          {!embed && (
            <button
              onClick={() => setShowToc(true)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-[var(--tint)]"
              aria-label="Table of Contents"
              title="Table of Contents"
            >
              <Layers size={18} />
            </button>
          )}

          {/* Fourteen controls met anyone who clicked a link to look at a
              lookbook. Contents, search, the bag and fullscreen stay; sound,
              narration, translation and print move behind one menu where they
              can carry a name instead of an icon. */}
          {!embed && (
            <div className="relative">
              <button
                onClick={() => setShowMore((v) => !v)}
                aria-expanded={showMore}
                aria-haspopup="menu"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[var(--qlico-muted)] transition-colors hover:bg-[var(--tint)] hover:text-[var(--qlico-ink)]"
                aria-label="More reading options"
                title="More"
              >
                <MoreHorizontal size={18} />
              </button>

              {showMore && (
                <div
                  role="menu"
                  className="absolute bottom-full right-0 z-50 mb-2 w-60 rounded-2xl border border-[var(--qlico-border)] bg-[var(--qlico-paper)] p-1.5 shadow-2xl"
                >
                  <MenuRow
                    icon={soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    label="Page-turn sound"
                    value={soundEnabled ? 'On' : 'Off'}
                    onClick={toggleSound}
                  />

                  {canSpeech && (
                    <MenuRow
                      icon={<Headphones size={16} className={narrating ? 'animate-pulse' : ''} />}
                      label={narrating ? 'Stop reading aloud' : 'Read aloud'}
                      value={narrating ? `${speechSpeed}x` : undefined}
                      onClick={() => {
                        if (narrating) cycleSpeed()
                        else toggleNarration()
                      }}
                    />
                  )}

                  <MenuRow
                    icon={<Printer size={16} />}
                    label="Print or save as PDF"
                    onClick={() => {
                      setShowMore(false)
                      window.print()
                    }}
                  />

                  <div className="my-1 h-px bg-[var(--qlico-border)]" />
                  <div className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--qlico-muted)]">
                    Language
                  </div>
                  <div className="max-h-44 overflow-y-auto">
                    {LANGUAGES.map((l) => (
                      <MenuRow
                        key={l.code}
                        icon={<span aria-hidden="true">{l.flag}</span>}
                        label={l.name}
                        value={currentLang === l.code ? '✓' : undefined}
                        onClick={() => {
                          setCurrentLang(l.code)
                          setShowMore(false)
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {canFullscreen && (
            <button
              onClick={toggleFullscreen}
              className={twMerge(
                'flex items-center justify-center rounded-full transition-colors hover:bg-[var(--tint)]',
                embed ? 'h-8 w-8' : 'min-h-[44px] min-w-[44px]'
              )}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              aria-pressed={fullscreen}
            >
              {fullscreen ? <Minimize size={embed ? 15 : 18} /> : <Maximize size={embed ? 15 : 18} />}
            </button>
          )}
      </div>

      {!embed && <KeyboardHints />}

      {/* Accessible page announcements */}
      <div className="sr-only" aria-live="polite">
        {onGatePage
          ? `Email required to read the remaining ${stillLocked} ${stillLocked === 1 ? 'page' : 'pages'}`
          : `Page ${Math.min(currentPage + 1, editionPages)} of ${editionPages}`}
      </div>

      {/* The second half of the growth loop */}
      {showBadge && !embed && atEnd && (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-2xl border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/90 px-6 py-5 text-center shadow-sm backdrop-blur"
        >
          <p className="text-[15px] font-semibold text-[var(--qlico-ink)]">
            Made with QLICO
          </p>
          <p className="text-[13px] leading-5 text-[var(--qlico-muted)]">
            Turn your own PDF into an edition like this one. It takes a couple of minutes and
            there&apos;s nothing to sign up for to try it.
          </p>
          <a
            href="https://qlico.app/?via=reader#try"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            Try it with your PDF
          </a>
        </motion.div>
      )}

      {/* In-Edition Search Modal */}
      {showSearch && (
        <SearchModal
          isOpen={showSearch}
          onClose={() => setShowSearch(false)}
          book={visibleBook}
          onSelectPage={(i) => engineRef.current?.goTo(i)}
        />
      )}

      {/* Shoppable Cart Drawer */}
      {showCart && (
        <CartDrawer
          isOpen={showCart}
          onClose={() => setShowCart(false)}
          items={cartItems}
          onUpdateQuantity={handleUpdateCartQuantity}
          onRemoveItem={handleRemoveCartItem}
          checkoutUrl={book.settings.checkoutUrl}
          onCheckout={() => {
            trackEvent(book.id, 'cta_click', { action: 'checkout', items: cartItems.length })
            setShowCart(false)
          }}
        />
      )}

      {/* Client Feedback & Review Drawer */}
      {showReview && (
        <ReviewDrawer
          isOpen={showReview}
          onClose={() => setShowReview(false)}
          currentPageNumber={currentPage + 1}
          comments={reviewComments}
          onAddComment={handleAddReviewComment}
          onResolveComment={handleResolveReviewComment}
        />
      )}

      {/* Table of Contents Drawer */}
      {showToc && (
        <TableOfContents
          book={visibleBook}
          currentPage={currentPage}
          onSelectPage={(i) => engineRef.current?.goTo(i)}
          onClose={() => setShowToc(false)}
        />
      )}

      {/* Branding */}
      {showBadge && (
        <a
          href="https://qlico.app/?via=badge#try"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-4 right-4 z-[9000] rounded-full border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/85 px-3 py-1.5 text-xs font-semibold text-[var(--qlico-muted)] shadow-sm backdrop-blur-md transition-colors hover:text-[var(--qlico-ink)]"
        >
          Powered by <span className="font-display font-semibold text-[var(--qlico-ink)]">QLICO</span>
        </a>
      )}
    </div>
  )
}
