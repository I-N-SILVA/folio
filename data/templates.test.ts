import { describe, it, expect } from 'vitest'
import { TEMPLATES } from './templates'
import { BookSchema } from '@/lib/book-schema'

describe('Templates Gallery', () => {
  it('contains at least 4 curated templates', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(4)
  })

  it('generates valid Book schema objects for all templates', () => {
    for (const tmpl of TEMPLATES) {
      const book = tmpl.generateBook('test-id', 'test-user', `test-${tmpl.id}`)
      
      expect(book.id).toBe('test-id')
      expect(book.owner_id).toBe('test-user')
      expect(book.pages?.length).toBe(tmpl.pagesCount)
      expect(book.title).toBeTruthy()
      expect(book.theme).toBeDefined()

      // Validate against Zod BookSchema
      const parsed = BookSchema.safeParse(book)
      expect(parsed.success).toBe(true)
    }
  })
})
