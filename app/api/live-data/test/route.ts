import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase-server'
import { probeLiveValue } from '@/lib/live-data'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * "Test data source", from the studio.
 *
 * Unlike the reader-facing route this one does take a URL, because the author is
 * testing a source they have just typed and not yet saved. Three things keep
 * that from being an open proxy: it requires a signed-in user, it is rate
 * limited per user rather than per IP, and `probeLiveValue` runs every hop of
 * the request through the same address guard as everything else. What it will
 * fetch is therefore no more than what the author could already save into a
 * block and have the reader route fetch for them.
 *
 * It exists at all because the button used to `fetch(source)` from the browser.
 * That meant the test was answering a different question from the one the author
 * was asking: it passed for a same-origin path and failed on CORS for every real
 * source — the exact reverse of what happens after publish, where the server
 * fetches and CORS never applies.
 */

const TestSchema = z.object({
  source: z.string().min(1).max(2000),
  path: z.string().min(1).max(200),
})

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })

  const limit = rateLimit(`live-data-test:${user.id}`, 30, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many tests — wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  const parsed = TestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Add a source and a path first.' }, { status: 400 })
  }

  const probe = await probeLiveValue(parsed.data.source, parsed.data.path)
  return NextResponse.json(probe)
}
