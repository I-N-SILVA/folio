import { describe, expect, it } from 'vitest'
import { BookSchema } from '@/lib/book-schema'
import { DEMO_BOOKS } from './index'

// The bundled demos are served straight to the reader without Supabase, so a
// schema drift here would only surface as a broken public page. Validate them.
describe('bundled demo books', () => {
  for (const [slug, book] of Object.entries(DEMO_BOOKS)) {
    it(`${slug} conforms to BookSchema`, () => {
      const parsed = BookSchema.safeParse(book)
      if (!parsed.success) {
        throw new Error(JSON.stringify(parsed.error.issues, null, 2))
      }
      expect(parsed.data.slug).toBe(slug === 'demo' ? 'demo' : slug)
      expect(parsed.data.settings.published).toBe(true)
      expect(parsed.data.pages?.length).toBeGreaterThan(3)
      // Page numbers must be sequential — the viewer indexes by position.
      parsed.data.pages?.forEach((page, i) => {
        expect(page.page_number).toBe(i + 1)
      })
    })
  }
})
