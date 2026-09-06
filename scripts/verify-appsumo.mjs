/**
 * Exercise the AppSumo integration against a real deployment.
 *
 * APPSUMO_LAUNCH.md's go-live list says "send AppSumo's test event; confirm
 * 200". This does that, and the four things around it that are easier to get
 * wrong and just as fatal:
 *
 *   - a webhook that accepts unsigned requests, which is an open door to
 *     granting yourself a lifetime plan;
 *   - a webhook that rejects *correctly* signed requests, because the key in
 *     the environment is not the key in the AppSumo dashboard, so every real
 *     purchase silently fails to create a license;
 *   - `/redeem` reachable while signed out, where the API's 401 renders to the
 *     buyer as the word "Unauthorized";
 *   - the redemption API answering to an anonymous caller at all.
 *
 *   APPSUMO_API_KEY=... node scripts/verify-appsumo.mjs https://qlico.app
 *
 * Only the `test` action is sent, which `applyAppSumoEvent` handles without
 * touching the database — so this is safe against production. Exits non-zero on
 * any failure.
 */

import crypto from 'node:crypto'

const base = (process.argv[2] ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const key = process.env.APPSUMO_API_KEY

if (!key) {
  console.error('Set APPSUMO_API_KEY to the value configured on that deployment.')
  process.exit(2)
}

const WEBHOOK = `${base}/api/appsumo/webhook`
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

let failures = 0

function report(name, ok, detail) {
  if (!ok) failures++
  console.log(`  ${ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`} ${name.padEnd(46)} ${DIM}${detail}${RESET}`)
}

async function post(body, signature) {
  const res = await fetch(WEBHOOK, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(signature ? { 'x-appsumo-signature': signature } : {}),
    },
    body,
    cache: 'no-store',
  })
  return { status: res.status, text: (await res.text()).slice(0, 160) }
}

console.log(`\n  ${base}\n`)

// 1. The health check AppSumo and uptime monitors GET.
try {
  const res = await fetch(WEBHOOK, { cache: 'no-store' })
  const body = await res.json().catch(() => ({}))
  report('webhook reachable', res.status === 200 && body.ok === true, `GET → ${res.status}`)
} catch (err) {
  report('webhook reachable', false, err.message)
}

const testBody = JSON.stringify({ action: 'test' })
const goodSignature = crypto.createHmac('sha256', key).update(testBody, 'utf8').digest('hex')

// 2. Unsigned must be refused. If this passes, anyone can grant themselves a
//    lifetime plan by posting an `activate`.
{
  const { status } = await post(testBody, null)
  report('unsigned request refused', status === 401, `→ ${status}${status !== 401 ? '  ANYONE CAN FORGE A LICENSE' : ''}`)
}

// 3. A wrong signature must be refused.
{
  const { status } = await post(testBody, 'deadbeef'.repeat(8))
  report('bad signature refused', status === 401, `→ ${status}`)
}

// 4. A correct signature must be accepted. Failing here means the key deployed
//    is not the key AppSumo signs with, and every real purchase is dropped —
//    the failure that looks identical to "no sales yet".
{
  const { status, text } = await post(testBody, goodSignature)
  report('signed test event accepted', status === 200, `→ ${status} ${text}`)
}

// 5. The redemption API must not answer an anonymous caller.
try {
  const res = await fetch(`${base}/api/appsumo/redeem`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'not-a-real-code' }),
    cache: 'no-store',
  })
  report('redeem API requires sign-in', res.status === 401, `→ ${res.status}`)
} catch (err) {
  report('redeem API requires sign-in', false, err.message)
}

// 6. A signed-out buyer arriving from their receipt must be sent to sign in,
//    with the code carried across, rather than shown "Unauthorized".
try {
  const res = await fetch(`${base}/redeem?code=ABC-123`, { redirect: 'manual', cache: 'no-store' })
  const location = res.headers.get('location') ?? ''
  const redirects = res.status >= 300 && res.status < 400
  report(
    'signed-out /redeem goes to sign-in',
    redirects && location.includes('/login') && location.includes('ABC-123'),
    redirects ? `→ ${location.slice(0, 70)}` : `→ ${res.status}, expected a redirect`
  )
} catch (err) {
  report('signed-out /redeem goes to sign-in', false, err.message)
}

console.log('')
if (failures) {
  console.log(`  ${RED}${failures} failing${RESET} — do not open the deal.\n`)
  process.exit(1)
}
console.log(`  ${GREEN}AppSumo integration verified.${RESET}\n`)
