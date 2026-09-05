import { describe, it, expect } from 'vitest'
import { duplicateNames } from '@/lib/duplicate-naming'

describe('duplicateNames', () => {
  it('names a copy', () => {
    const { title } = duplicateNames({ title: 'Autumn Report', slug: 'autumn-report' }, false)
    expect(title).toBe('Autumn Report (Copy)')
  })

  it('names a template', () => {
    const { title } = duplicateNames({ title: 'Autumn Report', slug: 'autumn-report' }, true)
    expect(title).toBe('Autumn Report template')
  })

  it('does not stack the suffix', () => {
    // Saving a template as a template is a thing an author will do by accident,
    // and "Report template template template" is how that shows up.
    const once = duplicateNames({ title: 'Report', slug: 'r' }, true).title
    const twice = duplicateNames({ title: once, slug: 'r' }, true).title
    expect(twice).toBe('Report template')
  })

  it('keeps the whole title when copying a template as an edition', () => {
    // Starting *from* a template should not silently rename the result: the
    // author renames it, and losing "template" here would make two identically
    // named things in the library.
    const { title } = duplicateNames({ title: 'Report template', slug: 'r' }, false)
    expect(title).toBe('Report template (Copy)')
  })

  it('bounds the slug so a chain of copies cannot outgrow the column', () => {
    let slug = 'a'.repeat(90)
    for (let i = 0; i < 5; i++) {
      slug = duplicateNames({ title: 'x', slug }, false).slug
    }
    expect(slug.length).toBeLessThanOrEqual(100)
  })

  it('makes a unique slug each time, so two copies do not collide', () => {
    const a = duplicateNames({ title: 'x', slug: 'x' }, false).slug
    const b = duplicateNames({ title: 'x', slug: 'x' }, false).slug
    expect(a).not.toBe(b)
  })

  it('produces a slug the books table will accept', () => {
    // The create route validates /^[a-z0-9-]+$/; a slug this route invents has
    // to satisfy the same rule or the copy fails at insert.
    const { slug } = duplicateNames({ title: 'x', slug: 'autumn-report' }, true)
    expect(slug).toMatch(/^[a-z0-9-]+$/)
    expect(slug).toContain('-template-')
  })
})
