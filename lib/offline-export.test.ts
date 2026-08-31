import { describe, it, expect } from 'vitest'
import { generateOfflineBundle } from './offline-export'
import type { Book } from './book-schema'

describe('Offline Kiosk HTML Bundle Generator', () => {
  const sampleBook: Book = {
    id: 'test-book-id',
    slug: 'test-monograph',
    title: 'Test Monograph',
    description: 'A test edition for offline kiosk testing',
    owner_id: 'user-1',
    theme: {
      preset: 'ivory',
      background: '#fcfbf9',
      primary: '#050508',
    },
    settings: {
      published: true,
      unlisted: false,
      whitelabel: false,
      gating: {
        enabled: false,
        page_number: 3,
        type: 'email',
        title: 'Unlock',
        description: 'Email',
      },
    },
    pages: [
      {
        id: 'p1',
        book_id: 'test-book-id',
        page_number: 1,
        type: 'cover',
        layout: 'hero',
        blocks: [
          { type: 'text', id: 'b1', variant: 'title', content: 'Test Monograph Cover' },
        ],
        hotspots: [],
      },
      {
        id: 'p2',
        book_id: 'test-book-id',
        page_number: 2,
        type: 'content',
        layout: 'hero',
        blocks: [
          { type: 'text', id: 'b2', variant: 'heading', content: 'Architectural Joinery' },
        ],
        hotspots: [
          {
            id: 'hs-1',
            x: 50,
            y: 50,
            label: 'Detail Pin',
            icon: 'Compass',
            action: 'modal',
            modal: { title: 'Detail Pin', body: 'Inspecting joinery' },
          },
        ],
      },
    ],
  }

  it('generates a valid, self-contained single-page HTML bundle', () => {
    const html = generateOfflineBundle(sampleBook)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<title>Test Monograph · Standalone Edition</title>')
    expect(html).toContain('Test Monograph Cover')
    expect(html).toContain('Architectural Joinery')
    expect(html).toContain('Detail Pin')
    expect(html).toContain('Standalone Kiosk Bundle')
  })
})
