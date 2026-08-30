'use client'

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react'
import HTMLFlipBook from 'react-pageflip'
import { LeadGate } from './LeadGate'
import { PageRenderer } from './PageRenderer'
import { HotspotLayer } from './HotspotLayer'
import { getSessionId, trackEvent } from '@/lib/tracking'
import type { Book } from '@/lib/book-schema'
import { PAGE_DESIGN_WIDTH, PAGE_RATIO } from '@/lib/page-geometry'

export interface ViewerEngineHandle {
  flipNext: () => void
  flipPrev: () => void
  goTo: (page: number) => void
  currentPage: number
  totalPages: number
}

interface ViewerEngineProps {
  book: Book
  onFlip?: (page: number) => void
  embed?: boolean
  /** Multiplier on the computed page width, driven by the reader's zoom control. */
  zoom?: number
  /** Pages the server withheld behind the lead gate; 0 when nothing is gated. */
  lockedCount?: number
  /** Needed by the gate to ask the server for the withheld pages. */
  slug?: string
  onUnlocked?: (pages: unknown[]) => void
}

interface Dims {
  w: number
  h: number
}

// A page never renders wider than the shared design width — that is what
// every preview lays out at, so exceeding it here would make the previews
// wrong rather than the reader right.
const MAX_PAGE_WIDTH = PAGE_DESIGN_WIDTH

export const ViewerEngine = forwardRef<ViewerEngineHandle, ViewerEngineProps>(
  ({ book, onFlip, embed = false, zoom = 1, lockedCount = 0, slug = '', onUnlocked }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const bookRef = useRef<any>(null)
    const [dims, setDims] = useState<Dims>({ w: 600, h: 848 })
    const [isMobile, setIsMobile] = useState(false)
    // react-pageflip locks in portrait vs. landscape mode at mount time —
    // it doesn't react to a later `usePortrait` prop change. Don't mount it
    // until the first real container measurement lands, or it can init in
    // the wrong orientation (a two-page spread crammed into a phone width).
    const [measured, setMeasured] = useState(false)
    const [ready, setReady] = useState(false)
    const [currentPage, setCurrentPage] = useState(0)
    const [modalOpen, setModalOpen] = useState(false)
    const pageFlipTimes = useRef<Record<number, number>>({})
    const openedAt = useRef<number>(0)
    const completed = useRef(false)

    const pages = book.pages ?? []
    const gating = book.settings?.gating
    const isLocked = lockedCount > 0

    // Handle coordinate-based clicks for heatmaps
    const handlePageClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>, pageIdx: number) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * 100
        const y = ((e.clientY - rect.top) / rect.height) * 100

        trackEvent(book.id, 'page_click', {
          page_number: pageIdx + 1,
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
        })
      },
      [book.id]
    )

    // Responsive sizing. The container width is remembered so a zoom change
    // can recompute without waiting for a resize that may never come.
    const containerWidth = useRef(0)
    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      const obs = new ResizeObserver(([entry]) => {
        containerWidth.current = entry.contentRect.width
        applySize()
        setMeasured(true)
      })
      obs.observe(container)
      return () => obs.disconnect()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const applySize = useCallback(() => {
      const cw = containerWidth.current
      if (!cw) return
      const mobile = cw < 768
      setIsMobile(mobile)
      // MAX_PAGE_WIDTH keeps the default at a comfortable "book on a table"
      // size; zoom lets a large display actually use its space, still bounded
      // by the container so the spread can't overflow.
      const base = mobile ? cw : Math.min(cw / 2, MAX_PAGE_WIDTH)
      let pageWidth = mobile ? base : Math.min(base * zoom, cw / 2)

      // An embed lives in whatever box the host sized the iframe to, and that
      // is usually shorter than a full A4 page. Sizing on width alone pushed
      // the bottom of every page outside the frame, so bound by height too and
      // leave room for the control bar.
      if (embed && typeof window !== 'undefined') {
        const available = window.innerHeight - 72
        if (available > 120) pageWidth = Math.min(pageWidth, available / PAGE_RATIO)
      }

      setDims({ w: pageWidth, h: pageWidth * PAGE_RATIO })
    }, [zoom, embed])

    useEffect(() => {
      applySize()
    }, [applySize])

    // Keyboard navigation
    useEffect(() => {
      function handler(e: KeyboardEvent) {
        if (modalOpen) return
        if (e.key === 'ArrowRight') bookRef.current?.pageFlip()?.flipNext()
        if (e.key === 'ArrowLeft') bookRef.current?.pageFlip()?.flipPrev()
      }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }, [modalOpen])

    // Preload adjacent page images for smooth flipping
    useEffect(() => {
      const toPreload = [currentPage + 1, currentPage + 2, currentPage - 1]
      toPreload.forEach((idx) => {
        const page = pages[idx]
        if (!page) return
        page.blocks.forEach((block) => {
          if (block.type === 'image' && block.src) {
            const img = new window.Image()
            img.src = block.src
          }
          if (block.type === 'video' && block.poster) {
            const img = new window.Image()
            img.src = block.poster
          }
        })
        if (page.background?.image) {
          const img = new window.Image()
          img.src = page.background.image
        }
      })
    }, [currentPage, pages])

    // Track book_open on mount, and seed the dwell clock for the opening
    // page so its view time isn't lost (handleFlip only records dwell for
    // pages it has *left*, so page 0 needs a timestamp before any flip).
    useEffect(() => {
      openedAt.current = Date.now()
      pageFlipTimes.current[0] = openedAt.current
      trackEvent(book.id, 'book_open', {
        referrer: typeof document !== 'undefined' ? document.referrer : '',
        device_type: typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop',
        embed,
      })
    }, [book.id, embed])

    const handleFlip = useCallback(
      (e: any) => {
        const page: number = e.data
        const now = Date.now()

        // Calculate dwell time for previous page
        if (pageFlipTimes.current[currentPage]) {
          const dwell = now - pageFlipTimes.current[currentPage]
          trackEvent(book.id, 'page_view', {
            page_number: currentPage + 1,
            dwell_ms: dwell,
          })
        }

        pageFlipTimes.current[page] = now

        trackEvent(book.id, 'page_flip', {
          from_page: currentPage + 1,
          to_page: page + 1,
          method: 'click',
        })

        // book_complete on reaching the last page (once per session)
        if (page === pages.length - 1 && !completed.current) {
          completed.current = true
          trackEvent(book.id, 'book_complete', {
            session_duration_ms: now - openedAt.current,
          })
        }

        setCurrentPage(page)
        onFlip?.(page)
      },
      [book.id, currentPage, pages.length, onFlip]
    )

    // Flush dwell time for whichever page is on screen when the reader
    // navigates away or closes the tab — otherwise the last page viewed
    // in a session never gets a page_view/dwell_ms recorded.
    const currentPageRef = useRef(0)
    useEffect(() => {
      currentPageRef.current = currentPage
    }, [currentPage])

    useEffect(() => {
      function flush() {
        const page = currentPageRef.current
        const startedAt = pageFlipTimes.current[page]
        if (!startedAt) return
        trackEvent(book.id, 'page_view', {
          page_number: page + 1,
          dwell_ms: Date.now() - startedAt,
        })
      }
      function onVisibilityChange() {
        if (document.visibilityState === 'hidden') flush()
      }
      document.addEventListener('visibilitychange', onVisibilityChange)
      window.addEventListener('pagehide', flush)
      return () => {
        document.removeEventListener('visibilitychange', onVisibilityChange)
        window.removeEventListener('pagehide', flush)
        flush()
      }
    }, [book.id])

    useImperativeHandle(ref, () => ({
      flipNext: () => bookRef.current?.pageFlip()?.flipNext(),
      flipPrev: () => bookRef.current?.pageFlip()?.flipPrev(),
      goTo: (page: number) => bookRef.current?.pageFlip()?.turnToPage(page),
      get currentPage() { return currentPage },
      get totalPages() { return pages.length + (isLocked ? 1 : 0) },
    }))

    if (pages.length === 0) return null

    return (
      <div ref={containerRef} className="w-full flex justify-center" style={{ minHeight: measured ? undefined : dims.h }}>
        {measured && (
        <HTMLFlipBook
          // Force a clean remount if the container crosses the mobile
          // breakpoint — the library won't reorient a live instance.
          key={`${isMobile ? 'portrait' : 'landscape'}-${pages.length}`}
          ref={bookRef}
          width={dims.w}
          height={dims.h}
          minWidth={200}
          maxWidth={2000}
          minHeight={280}
          maxHeight={2800}
          size="stretch"
          mobileScrollSupport={!modalOpen}
          onFlip={handleFlip}
          onInit={() => setReady(true)}
          showCover={true}
          useMouseEvents={!modalOpen}
          className="shadow-2xl"
          style={{}}
          startPage={0}
          drawShadow={true}
          flippingTime={700}
          usePortrait={isMobile}
          startZIndex={0}
          autoSize={true}
          maxShadowOpacity={0.5}
          showPageCorners={true}
          disableFlipByClick={false}
          clickEventForward={true}
          swipeDistance={30}
        >
          {/* Built as an array rather than JSX siblings with a `&&`: react-pageflip
              walks its children expecting every one to be an element, and a
              falsy branch reaches it as `false` and throws "The argument must be
              a React element". That took out the whole reader, not just the
              gated case. */}
          {[
            ...pages.map((page, idx) => {
              const pageSide: 'single' | 'left' | 'right' = isMobile
                ? 'single'
                : idx === 0
                  ? 'single'
                  : idx % 2 === 1
                    ? 'left'
                    : 'right'

              return (
                <div
                  key={page.id}
                  className="relative bg-white group cursor-pointer"
                  style={{ width: dims.w, height: dims.h }}
                  onClick={(e) => handlePageClick(e, idx)}
                >
                  <PageRenderer
                    page={page}
                    bookId={book.id}
                    theme={book.theme}
                    hideGutter={isMobile}
                    pageSide={pageSide}
                  />
                  <HotspotLayer
                    hotspots={page.hotspots}
                    bookId={book.id}
                    pageNumber={idx + 1}
                    onModalOpenChange={setModalOpen}
                  />
                </div>
              )
            }),
            // The gate stands in for the withheld pages rather than covering
            // pages that were sent anyway.
            ...(isLocked
              ? [
                  <div
                    key="lead-gate"
                    className="relative bg-white"
                    style={{ width: dims.w, height: dims.h }}
                  >
                    <LeadGate
                      gating={gating}
                      bookId={book.id}
                      lockedCount={lockedCount}
                      slug={slug}
                      sessionId={getSessionId()}
                      onUnlocked={(released) => onUnlocked?.(released)}
                    />
                  </div>,
                ]
              : []),
          ]}
        </HTMLFlipBook>
        )}
      </div>
    )
  }
)

ViewerEngine.displayName = 'ViewerEngine'
