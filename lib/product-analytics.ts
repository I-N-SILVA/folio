'use client'

import { track } from '@vercel/analytics'

/**
 * Product funnel events.
 *
 * Distinct from `lib/tracking.ts`, which records what *readers* do inside a
 * published edition. This file records what *authors* do inside the studio, and
 * it exists because that half was almost entirely unmeasured: four events fired
 * anywhere in the app, and between "we sent a magic link" and "an edition was
 * published" there was nothing at all. Every step where users were suspected of
 * dropping out — the inbox round-trip, the import, the publish, the share — was
 * invisible, so no decision about any of them could be checked afterwards.
 *
 * The list is deliberately short. These are the steps of one funnel:
 *
 *   landing → try → signup → import → publish → share → first read → upgrade
 *
 * If an event doesn't sit on that path or answer "why did they stop here", it
 * doesn't belong. Resist adding one per feature.
 */
export type ProductEvent =
  // ── Landing ──────────────────────────────────────────────────────────────
  | 'landing_viewed'
  | 'demo_opened'
  | 'cta_click'
  // ── Try before signup ────────────────────────────────────────────────────
  | 'try_upload_started'
  | 'try_preview_shown'
  | 'try_failed'
  | 'try_claim_clicked'
  // ── Auth ─────────────────────────────────────────────────────────────────
  | 'signup_started'
  | 'signup_magic_link_sent'
  | 'signup_completed'
  // ── Creating an edition ──────────────────────────────────────────────────
  | 'edition_create_started'
  | 'import_started'
  | 'import_completed'
  | 'import_failed'
  | 'edition_enriched'
  // ── The moment that matters ──────────────────────────────────────────────
  | 'edition_published'
  | 'share_link_copied'
  // ── Money ────────────────────────────────────────────────────────────────
  | 'upgrade_viewed'
  | 'checkout_started'

type Props = Record<string, string | number | boolean | null>

/**
 * Fire a funnel event. Never throws: analytics failing is not a reason for a
 * publish or an import to fail, which is the same rule `lib/tracking.ts` follows
 * on the reader side.
 */
export function trackProduct(event: ProductEvent, props?: Props): void {
  try {
    track(event, props)
  } catch {
    /* analytics must never break the studio */
  }
}

/**
 * Minutes since a timestamp, rounded — for "how long did this take" properties
 * like time-to-publish. Returns null when the origin is unknown, so a missing
 * value is distinguishable from a genuine zero.
 */
export function minutesSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return null
  return Math.max(0, Math.round((Date.now() - then) / 60_000))
}
