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

export const ViewerEngine = forwardRef<ViewerEngineHandle, ViewerEngineProps>(
  ({ book, onFlip, embed = false }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const bookRef = useRef<any>(null)
    const [dims, setDims] = useState<Dims>({ w: 600, h: 848 })
    const [isMobile, setIsMobile] = useState(false)
    const [ready, setReady] = useState(false)
    const [currentPage, setCurrentPage] = useState(0)
    const [modalOpen, setModalOpen] = useState(false)
    const [isUnlocked, setIsUnlocked] = useState(false)
    const pageFlipTimes = useRef<Record<number, number>>({})

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
        setDims(
          mobile
            ? { w: cw, h: cw * PAGE_RATIO }
            : { w: cw / 2, h: (cw / 2) * PAGE_RATIO }
        )
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

    // Track book_open on mount
    useEffect(() => {
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

        // book_complete on last page
        if (page === pages.length - 1) {
          trackEvent(book.id, 'book_complete', { session_duration_ms: 0 })
        }

        setCurrentPage(page)
        onFlip?.(page)
      },
      [book.id, currentPage, pages.length, onFlip]
    )

    useImperativeHandle(ref, () => ({
      flipNext: () => bookRef.current?.pageFlip()?.flipNext(),
      flipPrev: () => bookRef.current?.pageFlip()?.flipPrev(),
      goTo: (page: number) => bookRef.current?.pageFlip()?.turnToPage(page),
      get currentPage() { return currentPage },
      get totalPages() { return pages.length },
    }))

    if (pages.length === 0) return null

    return (
      <div ref={containerRef} className="w-full flex justify-center">
        <HTMLFlipBook
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
              <PageRenderer page={page} bookId={book.id} theme={book.theme} />
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
      </div>
    )
  }
)

ViewerEngine.displayName = 'ViewerEngine'
