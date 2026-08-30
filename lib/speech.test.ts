import { describe, it, expect } from 'vitest'
import { extractPageSpeechText } from './speech'
import type { Page } from './book-schema'

describe('extractPageSpeechText', () => {
  it('returns empty string for null page', () => {
    expect(extractPageSpeechText(null)).toBe('')
  })

  it('extracts and cleans markdown text from blocks', () => {
    const page: Page = {
      id: 'p1',
      book_id: 'b1',
      page_number: 1,
      type: 'content',
      layout: 'text',
      blocks: [
        {
          type: 'text',
          id: 't1',
          variant: 'title',
          content: '### Modern Elegance\nDiscover the *new* collection.',
        },
        {
          type: 'image',
          id: 'i1',
          src: 'https://example.com/img.jpg',
          alt: 'Model wearing trench',
          lightbox: true,
          caption: 'Model wearing ivory silk trench',
        },
      ],
      hotspots: [
        {
          id: 'h1',
          x: 50,
          y: 50,
          label: 'Silk Trench ($350)',
          icon: 'Info',
          action: 'modal',
          modal: { title: 'Trench', body: 'Made in Italy' },
        },
      ],
    }

    const result = extractPageSpeechText(page)
    expect(result).toContain('Modern Elegance')
    expect(result).toContain('Discover the new collection')
    expect(result).toContain('Image: Model wearing ivory silk trench')
    expect(result).toContain('Silk Trench ($350)')
  })
})
