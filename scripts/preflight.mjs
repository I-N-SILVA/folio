/**
 * Ask a deployment whether it is ready, instead of ticking a box that says so.
 *
 * Every serious failure this codebase has had looked ticked: a CHECK constraint
 * two values behind the app, a consolidated migration three migrations behind,
 * eight fonts named and none of them loaded. This calls `/api/health` on the
 * real deployment, which reads its own environment and probes its own database.
 *
 *   CRON_SECRET=... node scripts/preflight.mjs https://qlico.app
 *
 * Exits non-zero if anything launch-blocking is failing, so it can gate a
 * deploy. Warnings do not fail it — a missing Stripe key is correct for an
 * LTD-only AppSumo launch.
 */

const base = (process.argv[2] ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const secret = process.env.CRON_SECRET

if (!secret) {
  console.error('Set CRON_SECRET to the value configured on that deployment.')
  process.exit(2)
}

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

let res
try {
  res = await fetch(`${base}/api/health`, {
    headers: { authorization: `Bearer ${secret}` },
    cache: 'no-store',
  })
} catch (err) {
  console.error(`${RED}Could not reach ${base}${RESET} — ${err.message}`)
  process.exit(2)
}

if (res.status === 404) {
  // The route answers 404 rather than 401 to anyone unauthorised, so this is
  // the same response a wrong secret gets. Say both possibilities.
  console.error(
    `${RED}404 from ${base}/api/health${RESET}\n` +
      '  Either CRON_SECRET does not match the deployment, or this build predates the health route.'
  )
  process.exit(2)
}

const body = await res.json().catch(() => null)
if (!body?.checks) {
  console.error(`${RED}Unexpected response (${res.status})${RESET}`)
  process.exit(2)
}

console.log(`\n  ${base}\n`)

for (const check of body.checks) {
  const mark = check.ok ? `${GREEN}✓${RESET}` : check.critical ? `${RED}✗${RESET}` : `${YELLOW}!${RESET}`
  console.log(`  ${mark} ${check.name.padEnd(38)} ${DIM}${check.detail}${RESET}`)
}

console.log('')
if (body.launchBlocking > 0) {
  console.log(`  ${RED}${body.launchBlocking} launch-blocking${RESET}, ${body.warnings} warning(s)\n`)
  process.exit(1)
}
console.log(`  ${GREEN}Ready.${RESET} ${body.warnings} warning(s) — check each is deliberate.\n`)
