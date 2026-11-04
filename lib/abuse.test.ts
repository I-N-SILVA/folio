import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isSuspended, REPORT_REASONS } from './abuse'

describe('isSuspended', () => {
  it('is true only when the operator set a suspension', () => {
    expect(isSuspended({ suspended_at: '2026-10-29T00:00:00Z' })).toBe(true)
    expect(isSuspended({ suspended_at: null })).toBe(false)
    // A deployment without 023 has no such column at all, and must keep serving.
    expect(isSuspended({})).toBe(false)
    expect(isSuspended(null)).toBe(false)
  })
})

describe('report reasons', () => {
  it('matches the CHECK constraint on edition_reports, so no report is refused by the database', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase', 'migrations', '023_abuse_controls.sql'),
      'utf8'
    )
    const check = /reason\s+text NOT NULL CHECK \(reason IN \(([\s\S]*?)\)\)/.exec(sql)
    expect(check).not.toBeNull()
    const allowed = [...check![1].matchAll(/'(\w+)'/g)].map((m) => m[1]).sort()
    expect(REPORT_REASONS.map((r) => r.value).sort()).toEqual(allowed)
  })
})

describe('service-role reads of public editions', () => {
  it('check suspension in every route that bypasses the public read policy', () => {
    // These read with the service role, which skips `public_read_published`,
    // so a suspended edition stays visible through them unless they ask.
    for (const file of [
      'app/api/books/unlock/route.ts',
      'app/api/live-data/route.ts',
      'app/(reader)/book/[slug]/opengraph-image.tsx',
    ]) {
      const src = readFileSync(join(process.cwd(), file), 'utf8')
      expect(src, file).toContain('isSuspended(')
    }
  })
})
