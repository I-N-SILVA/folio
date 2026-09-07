import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { newReviewToken, reviewPath, REVIEW_LINK_DAYS } from './review'

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')

describe('a review token is a credential', () => {
  it('is long, random, and URL-safe', () => {
    const a = newReviewToken()
    const b = newReviewToken()
    expect(a).not.toBe(b)
    // 32 bytes as base64url: 43 characters, no padding, nothing to escape.
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(encodeURIComponent(a)).toBe(a)
  })

  it('goes somewhere crawlers are told not to look', () => {
    const page = read('app/review/[token]/page.tsx')
    expect(page).toContain('robots')
    expect(page).toMatch(/index:\s*false/)
  })

  it('expires by default', () => {
    // A link handed to a contractor in March should not still open in December
    // because nobody remembered it existed.
    expect(REVIEW_LINK_DAYS).toBeGreaterThan(0)
    expect(REVIEW_LINK_DAYS).toBeLessThanOrEqual(90)
    expect(reviewPath('abc')).toBe('/review/abc')
  })
})

describe('what a token may and may not reach', () => {
  it('resolves to exactly one edition, in one statement', () => {
    // Revocation and expiry are checked in the same place the token is
    // resolved, so a caller cannot check one and forget the other.
    const sql = read('supabase/migrations/019_review_comments.sql')
    expect(sql).toContain('revoked_at IS NULL')
    expect(sql).toContain('expires_at IS NULL OR')
  })

  it('gives revoked, expired and never-existed the same answer', () => {
    // Distinguishing them tells somebody holding a guessed token it was real.
    //
    // Matched against the strings the route actually answers with, not against
    // the file: the first version of this test searched the whole source and
    // tripped on the comment above the code explaining the rule. A regex over
    // prose is the same mistake `supabase/master-migration.test.ts` documents.
    const messages = [
      ...read('app/api/review/[token]/route.ts').matchAll(/error:\s*'([^']+)'/g),
      ...read('app/api/review/[token]/comments/route.ts').matchAll(/error:\s*'([^']+)'/g),
    ].map((m) => m[1])

    expect(messages).toContain('This review link is no longer active.')
    for (const message of messages) {
      expect(message).not.toMatch(/revoked|expired/i)
    }
  })

  it('never exposes the comment tables to anon', () => {
    const sql = read('supabase/migrations/019_review_comments.sql')
    // Every policy on these tables is the owner's; a reviewer goes through a
    // route holding a token, never through PostgREST.
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql).not.toMatch(/GRANT[^;]*\bTO\b[^;]*\banon\b/)
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.review_link_book\(text\)[^;]*anon/)
  })

  it('lets only the author resolve a comment', () => {
    // Resolving is a judgement about the work. A reviewer holding a link is not
    // the person who makes it, so there is no token-authenticated path to it.
    const reviewerRoutes = [
      'app/api/review/[token]/route.ts',
      'app/api/review/[token]/comments/route.ts',
    ]
    for (const file of reviewerRoutes) {
      expect(read(file)).not.toContain('resolved_at:')
    }
    expect(read('app/api/books/[id]/comments/[commentId]/route.ts')).toContain('resolved_at:')
  })
})
