import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { relativeTime, AUTO_SNAPSHOT_GAP_MINUTES, VERSIONS_KEPT } from './versions'

const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString()
const now = new Date()

describe('relativeTime', () => {
  it('reads as a timeline rather than a timestamp', () => {
    expect(relativeTime(at(0), now)).toBe('just now')
    expect(relativeTime(at(1), now)).toBe('1 minute ago')
    expect(relativeTime(at(42), now)).toBe('42 minutes ago')
    expect(relativeTime(at(60 * 3), now)).toBe('3 hours ago')
    expect(relativeTime(at(60 * 24), now)).toBe('yesterday')
    expect(relativeTime(at(60 * 24 * 3), now)).toBe('3 days ago')
  })

  it('falls back to a date once "days ago" stops meaning anything', () => {
    expect(relativeTime(at(60 * 24 * 40), now)).toMatch(/\w+ \d+/)
  })

  it('does not throw on a value that is not a date', () => {
    expect(relativeTime('not-a-date', now)).toBe('')
  })
})

describe('the throttle and the cap are one set of numbers', () => {
  /**
   * `snapshot_book_version` takes both as parameters precisely so the schema is
   * not a second copy of them. If a route ever stops passing them, the SQL
   * defaults silently take over and the editor's "the last 20, roughly every
   * half hour" becomes a claim about numbers nobody is enforcing.
   */
  const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')

  it.each(['app/api/books/[id]/versions/route.ts', 'app/api/books/[id]/pages/route.ts'])(
    '%s passes both explicitly',
    (file) => {
      const src = read(file)
      expect(src).toContain('AUTO_SNAPSHOT_GAP_MINUTES')
      expect(src).toContain('VERSIONS_KEPT')
      expect(src).toContain('p_min_gap')
      expect(src).toContain('p_keep')
    }
  )

  it('publishing is a checkpoint, so it bypasses the throttle', () => {
    const src = read('app/api/books/[id]/route.ts')
    expect(src).toContain("p_label: 'Published'")
    expect(src).toContain("p_min_gap: '0 minutes'")
  })

  it('restoring does not roll the public address back', () => {
    // A rename files the old slug in `book_slug_history` and keeps the link
    // working. Restoring a version from before the rename would take the new
    // address away from links that already went out with it.
    const sql = read('supabase/migrations/018_book_versions.sql')
    expect(sql).toMatch(/slug is deliberately not restored/i)
    expect(sql).not.toMatch(/SET[\s\S]{0,200}\bslug\s*=/)
  })

  it('keeps a sane number of points', () => {
    expect(VERSIONS_KEPT).toBeGreaterThanOrEqual(10)
    expect(AUTO_SNAPSHOT_GAP_MINUTES).toBeGreaterThanOrEqual(5)
  })
})
