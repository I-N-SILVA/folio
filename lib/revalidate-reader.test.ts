import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')

// Every route that can change what a stranger sees at a public address. The
// reader page is ISR, so a mutation that does not clear the cache is invisible
// for up to `revalidate` seconds — and on a rename or a delete that means the
// old copy is served instead of a redirect or a 404.
const MUTATORS = ['app/api/books/[id]/route.ts', 'app/api/books/[id]/pages/route.ts']

describe('a change to an edition clears its public cache', () => {
  it.each(MUTATORS)('%s revalidates the reader', (file) => {
    expect(read(file)).toContain('revalidateReader(')
  })

  it('clears both the reader and the embed, which are separate routes', () => {
    const helper = read('lib/revalidate-reader.ts')
    expect(helper).toContain('revalidatePath(`/book/${slug}`)')
    expect(helper).toContain('revalidatePath(`/embed/${slug}`)')
  })

  it('is only worth having while the reader is actually cached', () => {
    // If the reader ever becomes force-dynamic this whole helper is dead code
    // and should go, rather than sit there implying a cache that is not there.
    expect(read('app/(reader)/book/[slug]/page.tsx')).toMatch(/export const revalidate = \d+/)
  })

  it('clears the address being left behind on a rename', () => {
    // `current.slug` is read before the update precisely so the old address can
    // be dropped; passing only the new one leaves the old link stale.
    expect(read('app/api/books/[id]/route.ts')).toContain(
      'revalidateReader(current.slug, data.slug)'
    )
  })
})
