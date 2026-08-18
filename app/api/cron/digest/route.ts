import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getEditionEngagement } from '@/lib/insights'
import { isEmailEnabled, sendWeeklyDigest } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Weekly reader digest.
 *
 * The product gave an author no reason to return: reader numbers change while
 * they are away, which is the entire point of the analytics, and nothing ever
 * told them. This is the cheapest answer — one email a week saying whether
 * anything happened, linking to the screen that says more.
 *
 * Scheduled by `vercel.json`. It is also safe to call by hand, because the send
 * is guarded by `digest_last_sent_at` rather than by the scheduler firing
 * exactly once: a retry, an overlapping run, or a curious operator must not
 * double-send.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://qlico.app'

/** How long before a profile is due again. Six days, not seven — a weekly cron drifts. */
const DIGEST_INTERVAL_DAYS = 6

/** Bounds one invocation. Remaining profiles are picked up by the next run. */
const BATCH_SIZE = 200

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  // Fails closed. Without a secret configured this endpoint would be an
  // unauthenticated way to make the app send email to its own users.
  if (!secret) return false

  const header = request.headers.get('authorization')
  return header === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isEmailEnabled()) {
    // Not an error: email is optional at deploy time, and a keyless install
    // should report that clearly rather than look like a broken cron.
    return NextResponse.json({ skipped: 'email_not_configured' })
  }

  const due = new Date(Date.now() - DIGEST_INTERVAL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, digest_last_sent_at')
    .eq('digest_opt_out', false)
    .or(`digest_last_sent_at.is.null,digest_last_sent_at.lt.${due}`)
    .not('email', 'is', null)
    .limit(BATCH_SIZE)

  if (error) {
    // 42703 = undefined_column: migration 013 hasn't been applied.
    if (error.code === '42703') {
      console.error(
        '[cron/digest] digest columns missing — apply supabase/migrations/013_weekly_digest.sql'
      )
      return NextResponse.json({ skipped: 'migration_missing' }, { status: 200 })
    }
    console.error('[cron/digest] could not list profiles:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  let sent = 0
  let skipped = 0

  for (const profile of profiles ?? []) {
    // Claim the slot before sending, and only if nothing else claimed it first.
    // Sending and then recording would double-send whenever the write fails;
    // this way a failed send costs one missed week, which is the cheaper error.
    const claim = await supabaseAdmin
      .from('profiles')
      .update({ digest_last_sent_at: new Date().toISOString() })
      .eq('id', profile.id)
      .or(`digest_last_sent_at.is.null,digest_last_sent_at.lt.${due}`)
      .select('id')

    if (!claim.data?.length) {
      skipped++
      continue
    }

    const { data: books } = await supabaseAdmin
      .from('books')
      .select('id, title, settings')
      .eq('owner_id', profile.id)

    const published = (books ?? []).filter(
      (b) => (b.settings as { published?: boolean } | null)?.published
    )

    // Nothing published means nothing to report. Say nothing rather than sending
    // a weekly zero to someone who hasn't started.
    if (published.length === 0) {
      skipped++
      continue
    }

    const engagement = await getEditionEngagement(
      profile.id,
      published.map((b) => b.id),
      profile.email
    )

    const top = published
      .map((b) => ({
        title: b.title as string,
        readers: engagement.byBook.get(b.id)?.readers ?? 0,
      }))
      .sort((a, b) => b.readers - a.readers)[0]

    const result = await sendWeeklyDigest({
      to: profile.email as string,
      readers: engagement.totalReaders,
      leads: engagement.totalLeads,
      windowDays: engagement.windowDays,
      top: top && top.readers > 0 ? top : null,
      insightsUrl: `${SITE_URL}/insights`,
      accountUrl: `${SITE_URL}/account`,
    })

    if (result.sent) sent++
    else skipped++
  }

  return NextResponse.json({
    considered: profiles?.length ?? 0,
    sent,
    skipped,
    more: (profiles?.length ?? 0) === BATCH_SIZE,
  })
}
