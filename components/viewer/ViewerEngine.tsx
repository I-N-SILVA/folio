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
import { trackEvent } from '@/lib/tracking'
import type { Book } from '@/lib/book-schema'

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
}

interface Dims {
  w: number
  h: number
}

const PAGE_RATIO = 1.41 // A4
// Cap how wide a single page can render, even in a wide container — keeps
// the spread at a comfortable "book on a table" size instead of zooming in
// to fill the whole viewport.
const MAX_PAGE_WIDTH = 460

export const ViewerEngine = forwardRef<ViewerEngineHandle, ViewerEngineProps>(
  ({ book, onFlip, embed = false }, ref) => {
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
    const [isUnlocked, setIsUnlocked] = useState(false)
    const pageFlipTimes = useRef<Record<number, number>>({})
    const openedAt = useRef<number>(0)
    const completed = useRef(false)

    const pages = book.pages ?? []
    const gating = book.settings?.gating

    // Check if current page is gated
    const isGated = gating?.enabled && !isUnlocked && currentPage >= (gating.page_number ?? 3)

    // Handle coordinate-based clicks for heatmaps
    const handlePageClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>, pageIdx: number) => {
        if (isGated) return

        const rect = e.currentTarget.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * 100
        const y = ((e.clientY - rect.top) / rect.height) * 100

        trackEvent(book.id, 'page_click', {
          page_number: pageIdx + 1,
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
        })
      },
      [book.id, isGated]
    )

    // Responsive sizing
    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      const obs = new ResizeObserver(([entry]) => {
        const cw = entry.contentRect.width
        const mobile = cw < 768
        setIsMobile(mobile)
        const pageWidth = mobile ? cw : Math.min(cw / 2, MAX_PAGE_WIDTH)
        setDims({ w: pageWidth, h: pageWidth * PAGE_RATIO })
        setMeasured(true)
      })
      obs.observe(container)
      return () => obs.disconnect()
    }, [])

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
      get totalPages() { return pages.length },
    }))

    if (pages.length === 0) return null

    return (
      <div ref={containerRef} className="w-full flex justify-center" style={{ minHeight: measured ? undefined : dims.h }}>
        {measured && (
        <HTMLFlipBook
          // Force a clean remount if the container crosses the mobile
          // breakpoint — the library won't reorient a live instance.
          key={isMobile ? 'portrait' : 'landscape'}
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
          {pages.map((page, idx) => (
            <div
              key={page.id}
              className="relative bg-white group cursor-pointer"
              style={{ width: dims.w, height: dims.h }}
              onClick={(e) => handlePageClick(e, idx)}
            >
              <PageRenderer page={page} bookId={book.id} theme={book.theme} hideGutter={isMobile} />
              <HotspotLayer
                hotspots={page.hotspots}
                bookId={book.id}
                pageNumber={idx + 1}
                onModalOpenChange={setModalOpen}
              />

              {/* Gating Overlay */}
              <LeadGate
                gating={gating}
                isUnlocked={isUnlocked}
                onUnlock={() => setIsUnlocked(true)}
                bookId={book.id}
                pageIndex={idx}
              />
            </div>
          ))}
        </HTMLFlipBook>
        )}
      </div>
    )
  }
)

ViewerEngine.displayName = 'ViewerEngine'
