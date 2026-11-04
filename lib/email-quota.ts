import 'server-only'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Daily email budget ──────────────────────────────────────────────────────
//
// Lets the app run on a free email plan. Resend's free plan refuses anything
// past 100 emails a day (and 3,000 a month); set `EMAIL_DAILY_LIMIT` to stay
// under it, e.g. 95, which also keeps a 30-day month under 3,000.
//
// Two classes of email share the day:
//   - `notice` — a lead notification or an abuse report. Someone is waiting
//     on these. They may use the whole limit.
//   - `digest` — the weekly digest. It stops at `DIGEST_DAILY_LIMIT`
//     (default: the total minus 20), so it can never use up the room a lead
//     needs, and whoever it doesn't reach today is reached on a later run.
//
// Unset `EMAIL_DAILY_LIMIT` (a paid plan) and nothing is counted or refused.
// Counted in the database (`claim_email_send`, 024) because every serverless
// instance and every cron run has to see the same total.

export type EmailClass = 'digest' | 'notice'

/** Room kept free for lead notifications when only the total is set. */
const NOTICE_RESERVE = 20

function positiveInt(v: string | undefined): number | null {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** The daily limit for a class of email, or null when there is none. */
export function dailyLimitFor(
  kind: EmailClass,
  env: Record<string, string | undefined> = process.env
): number | null {
  const total = positiveInt(env.EMAIL_DAILY_LIMIT)
  if (total === null) return null
  if (kind === 'notice') return total
  const digest = positiveInt(env.DIGEST_DAILY_LIMIT) ?? Math.max(0, total - NOTICE_RESERVE)
  return Math.min(digest, total)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Whether one more email of this class may go out today, counting it if so.
 *
 * Fails open when the counter is unavailable (024 not applied, database
 * unreachable): the email provider's own limit is the backstop, and refusing
 * every lead notification over a missing table is the worse failure.
 */
export async function claimEmailSend(kind: EmailClass): Promise<boolean> {
  const limit = dailyLimitFor(kind)
  if (limit === null) return true
  if (limit === 0) return false
  try {
    const { data, error } = await supabaseAdmin.rpc('claim_email_send', {
      p_day: today(),
      p_limit: limit,
    })
    if (error) {
      console.warn('[email-quota] claim_email_send unavailable:', error.message)
      return true
    }
    return data === true
  } catch (err) {
    console.error('[email-quota] claim failed, sending anyway:', err)
    return true
  }
}
