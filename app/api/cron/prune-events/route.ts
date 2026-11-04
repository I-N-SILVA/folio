import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { EVENT_RETENTION_DAYS } from '@/lib/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Daily event retention.
 *
 * `events` was append-only with nothing ever deleting from it, at ~15 rows per
 * read. No surface reads further back than the longest plan window, so rows
 * older than EVENT_RETENTION_DAYS are telemetry nobody can see, paid for in
 * database size every month.
 *
 * `prune_events` (022) deletes in batches and never touches `gate_unlock` —
 * those rows are the authors' leads. Scheduled by `vercel.json`; safe to call
 * by hand, since deleting what is already gone deletes nothing.
 */

/** Rows per statement. Small enough that no single delete holds a long lock. */
const BATCH = 5_000

/** Stop well inside maxDuration; tomorrow's run picks up the rest. */
const BUDGET_MS = 45_000

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  // Fails closed, like the digest: without a secret this would be an
  // unauthenticated way to make the app delete data.
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const before = new Date(Date.now() - EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const started = Date.now()
  let deleted = 0
  let batches = 0

  while (Date.now() - started < BUDGET_MS) {
    const { data, error } = await supabaseAdmin.rpc('prune_events', {
      p_before: before,
      p_batch: BATCH,
    })
    if (error) {
      console.error('[cron/prune-events] prune_events failed:', error.message)
      return NextResponse.json(
        { error: 'prune_events unavailable — apply supabase/migrations/022', deleted, batches },
        { status: 500 }
      )
    }
    const n = Number(data) || 0
    deleted += n
    batches++
    if (n < BATCH) {
      return NextResponse.json({ deleted, batches, before, done: true })
    }
  }

  return NextResponse.json({ deleted, batches, before, done: false })
}
