import { NextRequest, NextResponse } from 'next/server'
import { REQUIRED_FUNCTIONS } from '@/lib/required-functions'
import crypto from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { PageSchema, EVENT_TYPES } from '@/lib/book-schema'
import { APPSUMO_SIGNATURE_HEADER } from '@/lib/appsumo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Is this deployment actually configured, and does its database match this code?
 *
 * The launch checklists in APPSUMO_LAUNCH.md and LAUNCH.md are boxes a person
 * ticks. Every serious failure this codebase has had was something that looked
 * ticked: a CHECK constraint two values behind the app, a consolidated migration
 * three migrations behind, eight fonts named and none loaded. A box is not
 * evidence.
 *
 * So this asks the running deployment. It reports **presence, never values** —
 * a `true` for `SUPABASE_SERVICE_ROLE_KEY` is safe, the key is not — and it is
 * behind `CRON_SECRET` regardless, because even the shape of a configuration is
 * something to keep to yourself.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/health
 *
 * `scripts/preflight.mjs` formats this. Run it before a launch.
 */

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  // Fails closed, same as the cron route: without a secret this would publish a
  // map of what is and is not configured to anyone who asked.
  if (!secret) return false
  const header = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

type Check = { name: string; ok: boolean; detail: string; critical: boolean }

/**
 * `aliases` because a variable can have more than one accepted spelling and
 * reporting only one is how a preflight raises a false blocker. `lib/supabase.ts`
 * takes `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_KEY`, and `.env.example`
 * documented the second — so an operator who followed it exactly would have been
 * told the deployment was broken.
 */
function envCheck(name: string, critical: boolean, why: string, aliases: string[] = []): Check {
  const found = [name, ...aliases].find((n) => process.env[n]?.trim())
  return {
    name,
    ok: Boolean(found),
    critical,
    detail: found ? (found === name ? 'set' : `set as ${found}`) : why,
  }
}

/**
 * Do the tables and columns this code writes to exist?
 *
 * Each is selected rather than described, so a column added by a migration
 * nobody applied shows up here as the error PostgREST actually returns.
 */
async function schemaChecks(): Promise<Check[]> {
  const checks: Check[] = []

  const { error: reachErr } = await supabaseAdmin.from('books').select('id').limit(1)
  checks.push({
    name: 'database reachable',
    ok: !reachErr,
    critical: true,
    detail: reachErr ? reachErr.message : 'ok',
  })
  if (reachErr) return checks

  // Tables the app writes to beyond the core three. Absent means the app
  // degrades silently — no slug history, no weekly digest, no engagement
  // insight, no version history, no review links.
  //
  // `critical` is the difference between "a buyer cannot pay" and "a feature is
  // missing": only the AppSumo path and the profile it writes to are the
  // former.
  const TABLES: [string, boolean][] = [
    ['profiles', true],
    ['appsumo_licenses', true],
    ['book_slug_history', false],
    ['book_versions', false],
    ['book_review_links', false],
    ['book_comments', false],
  ]
  for (const [table, critical] of TABLES) {
    const { error } = await supabaseAdmin.from(table).select('*').limit(1)
    checks.push({
      name: `table ${table}`,
      ok: !error,
      critical,
      detail: error ? `${error.message} — apply supabase/master_migration.sql` : 'present',
    })
  }

  // Every column the AppSumo path writes. A missing one is a buyer who paid and
  // cannot redeem, on launch day, in public.
  const { error: licenseCols } = await supabaseAdmin
    .from('appsumo_licenses')
    .select(
      'license_key, prev_license_key, tier, plan, status, activation_email, invoice_item_uuid, redeemed_by, redeemed_at'
    )
    .limit(1)
  checks.push({
    name: 'appsumo_licenses columns',
    ok: !licenseCols,
    critical: true,
    detail: licenseCols ? `${licenseCols.message} — apply migration 013` : 'all present',
  })

  const { error: profileCols } = await supabaseAdmin
    .from('profiles')
    .select('plan, status, appsumo_license_key, appsumo_tier, digest_opt_out, stripe_status')
    .limit(1)
  checks.push({
    name: 'profiles columns',
    ok: !profileCols,
    critical: true,
    detail: profileCols
      ? `${profileCols.message} — apply supabase/master_migration.sql`
      : 'all present',
  })

  return checks
}

/**
 * Are the database functions this app calls actually installed?
 *
 * Nothing checked these, and two of them carry the whole launch:
 * `claim_appsumo_license` absent means every redemption answers "We could not
 * find that license code" — the bug this branch opened with — and
 * `replace_book_pages` absent means the page save silently falls back to a
 * non-atomic delete-then-insert. A deployment running an older
 * `master_migration.sql` has all the tables, all the columns, and neither
 * function, and every other check here reports green.
 *
 * Read-only, through the inventory migration 020 adds. Calling each function
 * with harmless arguments was the obvious alternative and is not taken: it
 * would mean a health endpoint that runs an UPDATE and a DELETE every time
 * somebody polls it.
 */
async function functionChecks(): Promise<Check[]> {
  const { data, error } = await supabaseAdmin.rpc('installed_functions')

  if (error) {
    return [
      {
        name: 'database functions',
        ok: false,
        // The inventory itself is missing, which says nothing about the rest of
        // the list — but an unverified function list is how the redemption path
        // broke unnoticed, so it cannot pass quietly either.
        critical: false,
        detail: `could not read — apply supabase/master_migration.sql (migration 020). ${error.message}`,
      },
    ]
  }

  const installed = new Set(((data as { name: string }[] | null) ?? []).map((r) => r.name))

  return REQUIRED_FUNCTIONS.map((fn) => ({
    name: `function ${fn.name}()`,
    ok: installed.has(fn.name),
    critical: fn.critical,
    detail: installed.has(fn.name)
      ? 'present'
      : `missing — apply migration ${fn.migration}. Without it, ${fn.cost}.`,
  }))
}

/**
 * The CHECK constraints on the database that is actually running.
 *
 * Both constraint bugs in this repo's history were a Postgres enum drifting
 * behind a TypeScript one, invisible to every other check.
 * `lib/schema-db-drift.test.ts` compares the app's enums to the `.sql` files,
 * which catches a migration nobody wrote. It cannot catch a migration nobody
 * *applied* — and that is the one that reaches customers.
 *
 * Read-only, via the function migration 014 adds. Probing by inserting rows
 * was the obvious alternative and is not available: `books.owner_id` is NOT
 * NULL against `auth.users`, so there is no row to hang a probe off that is
 * not a real customer's.
 */
async function constraintChecks(): Promise<Check[]> {
  const wanted: [string, string, readonly string[]][] = [
    ['pages', 'layout', PageSchema.shape.layout.options],
    ['pages', 'type', PageSchema.shape.type.options],
    ['events', 'event_type', EVENT_TYPES],
  ]

  const checks: Check[] = []

  for (const [table, column, appValues] of wanted) {
    const { data, error } = await supabaseAdmin.rpc('constraint_allowed_values', {
      p_table: table,
      p_column: column,
    })

    if (error) {
      checks.push({
        name: `${table}.${column} constraint`,
        ok: false,
        // Not launch-blocking on its own: it means the self-check function is
        // absent, not that the constraint is wrong. It still has to be said,
        // because an unchecked constraint is exactly how this shipped twice.
        critical: false,
        detail: `could not read — apply supabase/master_migration.sql (migration 014). ${error.message}`,
      })
      continue
    }

    const allowed = new Set((data as string[] | null) ?? [])
    // An empty result means no CHECK on that column at all, which is permissive
    // rather than broken — flag it, but do not claim values are rejected.
    if (allowed.size === 0) {
      checks.push({
        name: `${table}.${column} constraint`,
        ok: true,
        critical: false,
        detail: 'no CHECK constraint found — nothing is rejected',
      })
      continue
    }

    const missing = appValues.filter((v) => !allowed.has(v))
    checks.push({
      name: `${table}.${column} accepts every value`,
      ok: missing.length === 0,
      critical: true,
      detail: missing.length
        ? `rejects ${missing.join(', ')} — apply supabase/master_migration.sql`
        : `all ${appValues.length} accepted`,
    })
  }

  return checks
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const checks: Check[] = [
    envCheck('NEXT_PUBLIC_SUPABASE_URL', true, 'missing — nothing works'),
    envCheck('NEXT_PUBLIC_SUPABASE_ANON_KEY', true, 'missing — nobody can sign in'),
    envCheck('SUPABASE_SERVICE_ROLE_KEY', true, 'missing — webhooks and analytics cannot write', [
      'SUPABASE_SERVICE_KEY',
    ]),
    envCheck('NEXT_PUBLIC_SITE_URL', true, 'missing — share links and emails point at qlico.app'),
    envCheck('APPSUMO_API_KEY', true, 'missing — every AppSumo webhook is rejected as unsigned'),
    envCheck('CRON_SECRET', true, 'missing — the weekly digest never sends'),
    envCheck('RESEND_API_KEY', false, 'missing — no digest email and no lead notification'),
    envCheck('EMAIL_FROM', false, 'missing — Resend has no From address, so nothing sends'),
    envCheck(
      'STRIPE_SECRET_KEY',
      false,
      'missing — the ongoing Pro channel is off (fine for an LTD-only launch)'
    ),
    envCheck('STRIPE_WEBHOOK_SECRET', false, 'missing — Stripe subscription changes are ignored'),
    envCheck(
      'GOOGLE_GENERATIVE_AI_API_KEY',
      false,
      'missing — hotspot detection falls back to the heuristic'
    ),
    envCheck('NEXT_PUBLIC_SUPPORT_EMAIL', false, 'missing — /help shows support@qlico.app'),
  ]

  checks.push({
    name: 'appsumo webhook signature',
    // The header name is what AppSumo has to be configured to send; the key's
    // presence is checked above. Reported together because the pair is what
    // makes a real event verify.
    ok: Boolean(process.env.APPSUMO_API_KEY?.trim()),
    critical: true,
    detail: `expects ${APPSUMO_SIGNATURE_HEADER}, HMAC-SHA256 of the raw body`,
  })

  try {
    checks.push(...(await schemaChecks()))
    checks.push(...(await functionChecks()))
    checks.push(...(await constraintChecks()))
  } catch (err) {
    checks.push({
      name: 'schema probe',
      ok: false,
      critical: true,
      detail: err instanceof Error ? err.message : 'failed',
    })
  }

  const failing = checks.filter((c) => !c.ok)
  const blocking = failing.filter((c) => c.critical)

  return NextResponse.json(
    {
      ok: blocking.length === 0,
      launchBlocking: blocking.length,
      warnings: failing.length - blocking.length,
      checks,
    },
    { status: blocking.length === 0 ? 200 : 503 }
  )
}
