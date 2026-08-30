import { describe, it, expect } from 'vitest'
import type { Book } from '@/lib/book-schema'

// Extract search index logic for pure unit testing
export function searchBook(book: Book, query: string) {
  const q = query.trim().toLowerCase()
  if (!q || q.length < 2) return []

  const matches: { pageIndex: number; pageNumber: number; snippet: string; matchedTerm: string }[] = []

  book.pages?.forEach((page, pageIndex) => {
    page.blocks?.forEach((block) => {
      if (block.type === 'text' && block.content) {
        const lower = block.content.toLowerCase()
        const idx = lower.indexOf(q)
        if (idx !== -1) {
          const start = Math.max(0, idx - 40)
          const end = Math.min(block.content.length, idx + q.length + 40)
          const snippet = (start > 0 ? '…' : '') + block.content.slice(start, end).replace(/[#*_~`]/g, '') + (end < block.content.length ? '…' : '')
          matches.push({
            pageIndex,
            pageNumber: page.page_number,
            snippet,
            matchedTerm: q,
          })
        }
      } else if (block.type === 'image' && block.caption) {
        if (block.caption.toLowerCase().includes(q)) {
          matches.push({
            pageIndex,
            pageNumber: page.page_number,
            snippet: block.caption,
            matchedTerm: q,
          })
        }
      }
    })

    page.hotspots?.forEach((spot) => {
      const spotText = `${spot.label || ''} ${spot.modal?.title || ''} ${spot.modal?.body || ''}`
      if (spotText.toLowerCase().includes(q)) {
        matches.push({
          pageIndex,
          pageNumber: page.page_number,
          snippet: spot.label || spot.modal?.title || spotText.slice(0, 60),
          matchedTerm: q,
        })
      }
    })
  })

  return matches
}

describe('In-Edition Full-Text Search', () => {
  const sampleBook: Book = {
    id: 'b1',
    slug: 'sample',
    title: 'Lookbook',
    owner_id: 'u1',
    theme: { preset: 'ivory' },
    settings: {
      published: true,
      unlisted: false,
      whitelabel: false,
      gating: { enabled: false, page_number: 1, type: 'email', title: '', description: '' },
    },
    pages: [
      {
        id: 'p1',
        book_id: 'b1',
        page_number: 1,
        type: 'cover',
        layout: 'hero',
        blocks: [
          { type: 'text', id: 't1', variant: 'title', content: 'Monochrome Spring Collection' },
          { type: 'text', id: 't2', variant: 'body', content: 'Organic silks and structured trench coats.' },
        ],
        hotspots: [],
      },
      {
        id: 'p2',
        book_id: 'b1',
        page_number: 2,
        type: 'content',
        layout: 'split',
        blocks: [
          { type: 'text', id: 't3', variant: 'heading', content: 'Mulberry Trench' },
          { type: 'image', id: 'i1', src: 'https://example.com/img.jpg', alt: 'Trench', lightbox: true, caption: 'Tailored in Milan from 100% silk' },
        ],
        hotspots: [
          {
            id: 'h1',
            x: 50,
            y: 50,
            label: 'Silk Trench ($480)',
            icon: 'ShoppingBag',
            action: 'checkout',
            modal: { title: 'Trench Coat', body: 'Handcrafted luxury apparel' },
          },
        ],
      },
    ],
  }

  it('returns empty array for short queries (< 2 chars)', () => {
    expect(searchBook(sampleBook, 'a')).toEqual([])
    expect(searchBook(sampleBook, '')).toEqual([])
  })

  it('finds text matches across page titles and bodies case-insensitively', () => {
    const results = searchBook(sampleBook, 'monochrome')
    expect(results.length).toBe(1)
    expect(results[0].pageNumber).toBe(1)
    expect(results[0].snippet).toContain('Monochrome')
  })

  it('finds matches in image captions', () => {
    const results = searchBook(sampleBook, 'Milan')
    expect(results.length).toBe(1)
    expect(results[0].pageNumber).toBe(2)
    expect(results[0].snippet).toContain('Tailored in Milan')
  })

  it('finds matches in interactive hotspot pins', () => {
    const results = searchBook(sampleBook, 'Handcrafted')
    expect(results.length).toBe(1)
    expect(results[0].pageNumber).toBe(2)
    expect(results[0].snippet).toContain('Silk Trench')
  })

  it('returns multiple results when terms appear across different pages', () => {
    const results = searchBook(sampleBook, 'trench')
    expect(results.length).toBeGreaterThanOrEqual(2)
  })
})
