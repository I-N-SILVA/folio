import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const PAGE = 'app/(reader)/book/[slug]/page.tsx'
const LAYOUT = 'app/(reader)/book/[slug]/layout.tsx'
const LOADING = 'app/(reader)/book/[slug]/loading.tsx'
const RESOLVER = 'lib/reader-slug.ts'

// What "this edition is readable" means. If one side of the pair learns a new
// condition and the other does not, the reader either 404s something it can
// render or streams a soft 404 for a draft.
const PUBLISHED = ".eq('settings->>published', 'true')"

describe('the reader slug resolves before the response streams', () => {
  it('resolves the slug in a layout, which loading.tsx does not wrap', () => {
    // `loading.js` wraps page.js and nested layouts in a Suspense boundary, but
    // not the layout of its own segment. That is the only place in this segment
    // where a throw can still set the HTTP status.
    const layout = read(LAYOUT)
    expect(layout).toContain('resolveReaderSlug')
    expect(layout).toContain('permanentRedirect')
    expect(layout).toContain('notFound')
  })

  it('keeps the miss path out of the page, which streams', () => {
    const page = read(PAGE)
    expect(page).not.toContain('permanentRedirect')
    expect(page).not.toContain('findCurrentSlug')
  })

  it('agrees with the page on what counts as published', () => {
    expect(read(PAGE)).toContain(PUBLISHED)
    expect(read(RESOLVER)).toContain(PUBLISHED)
  })

  it('reads one column, so the first byte is not waiting on the edition', () => {
    // The resolver runs ahead of the skeleton. Selecting the full row here
    // would move the whole fetch in front of the boundary and the skeleton
    // would never be seen.
    const resolver = read(RESOLVER)
    expect(resolver).toContain(".select('slug')")
    expect(resolver).not.toContain('pages(*)')
  })

  it('still has a skeleton to stream behind', () => {
    // If loading.tsx goes away the layout is harmless but redundant; this test
    // exists so its removal is a decision rather than an accident.
    expect(read(LOADING)).toContain('BookSkeleton')
  })
})
