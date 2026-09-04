import { describe, it, expect } from 'vitest'
import { publishChecks, countBlockers } from './publish-checks'
import type { Block, Book, Page } from './book-schema'

function page(blocks: Block[], overrides: Partial<Page> = {}): Page {
  return {
    id: `page-${overrides.page_number ?? 1}`,
    book_id: 'book',
    page_number: 1,
    type: 'content',
    layout: 'text',
    blocks,
    hotspots: [],
    ...overrides,
  }
}

function book(pages: Page[], settings: Partial<Book['settings']> = {}): Book {
  return {
    id: 'book',
    slug: 'an-edition',
    title: 'An edition',
    owner_id: 'owner',
    theme: { preset: 'ivory' },
    settings: {
      published: false,
      unlisted: false,
      whitelabel: false,
      gating: {
        enabled: false,
        page_number: 3,
        type: 'email',
        title: 'Unlock',
        description: 'Enter your email',
      },
      ...settings,
    },
    pages,
  } as Book
}

const text = (content: string): Block => ({
  id: 'text-1',
  type: 'text',
  variant: 'body',
  content,
})

describe('publishChecks', () => {
  it('passes an edition whose blocks all have what they need', () => {
    const issues = publishChecks(book([page([text('Something worth reading.')])]))
    expect(issues).toEqual([])
  })

  it('blocks a media block that never got a source', () => {
    const issues = publishChecks(
      book([page([{ id: 'v', type: 'video', src: '', autoplay: false, muted: true }])])
    )
    expect(countBlockers(issues)).toBe(1)
    expect(issues[0].title).toContain('Video on page 1')
  })

  it('blocks placeholder content that would otherwise publish silently', () => {
    // The exact defaults the editor used to insert: a w3schools sample video
    // and a button pointing at example.com. Neither is obvious on a long import.
    const issues = publishChecks(
      book([
        page([
          {
            id: 'v',
            type: 'video',
            src: 'https://www.w3schools.com/html/mov_bbb.mp4',
            autoplay: false,
            muted: true,
          },
          {
            id: 'b',
            type: 'button',
            label: 'Click me',
            href: 'https://example.com',
            variant: 'primary',
            target: '_blank',
          },
        ]),
      ])
    )
    expect(countBlockers(issues)).toBe(2)
  })

  it('treats missing alt text as a warning, not a blocker', () => {
    const issues = publishChecks(
      book([page([{ id: 'i', type: 'image', src: 'https://cdn.test/a.jpg', alt: '' }])])
    )
    expect(countBlockers(issues)).toBe(0)
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('warning')
  })

  it('catches a gate set past the last page, which would capture nothing', () => {
    const issues = publishChecks(
      book([page([text('One page.')])], {
        gating: {
          enabled: true,
          page_number: 9,
          type: 'email',
          title: 'Unlock',
          description: 'Enter your email',
        },
      })
    )
    const gate = issues.find((i) => i.id === 'gate:past-end')
    expect(gate?.severity).toBe('blocker')
  })

  it('leaves a gate that lands inside the edition alone', () => {
    const pages = [
      page([text('a')]),
      page([text('b')], { page_number: 2 }),
      page([text('c')], { page_number: 3 }),
    ]
    const issues = publishChecks(
      book(pages, {
        gating: {
          enabled: true,
          page_number: 2,
          type: 'email',
          title: 'Unlock',
          description: 'Enter your email',
        },
      })
    )
    expect(issues.find((i) => i.id === 'gate:past-end')).toBeUndefined()
  })

  it('warns when readers can fill a bag the edition cannot check out', () => {
    const issues = publishChecks(
      book([
        page([
          {
            id: 'g',
            type: 'product-grid',
            columns: '2',
            items: [
              {
                id: 'p1',
                name: 'A thing',
                price: '$10',
                image: 'https://cdn.test/p.jpg',
                action: 'cart',
                ctaLabel: 'Add to Bag',
              },
            ],
          },
        ]),
      ])
    )
    const commerce = issues.find((i) => i.id === 'commerce:no-checkout')
    expect(commerce?.severity).toBe('warning')
  })

  it('stays quiet about the bag once a checkout link exists', () => {
    const issues = publishChecks(
      book(
        [
          page([
            {
              id: 'g',
              type: 'product-grid',
              columns: '2',
              items: [
                {
                  id: 'p1',
                  name: 'A thing',
                  price: '$10',
                  image: 'https://cdn.test/p.jpg',
                  action: 'cart',
                  ctaLabel: 'Add to Bag',
                },
              ],
            },
          ]),
        ],
        { checkoutUrl: 'https://shop.test/cart' }
      )
    )
    expect(issues.find((i) => i.id === 'commerce:no-checkout')).toBeUndefined()
  })

  it('reports blockers before warnings so the list reads top-down', () => {
    const issues = publishChecks(
      book([
        page([
          { id: 'i', type: 'image', src: 'https://cdn.test/a.jpg', alt: '' },
          { id: 'v', type: 'video', src: '', autoplay: false, muted: true },
        ]),
      ])
    )
    expect(issues[0].severity).toBe('blocker')
    expect(issues[issues.length - 1].severity).toBe('warning')
  })
})
