/**
 * A signed-in browser, as a Cookie header.
 *
 * The studio is cookie-authenticated: `createServerSupabase` and `proxy.ts`
 * both read the session out of `@supabase/ssr`'s cookies, so a harness holding
 * a bearer token can reach the database and none of the product. Everything an
 * author does — create, save, publish, redeem, look at Insights — was therefore
 * unreachable from a script, which is why the reader loop got a harness first
 * and the author loop never did.
 *
 * Rather than hand-rolling the cookie name and encoding (both have changed
 * across @supabase/ssr releases, and a wrong guess fails as "signed out" rather
 * than as an error), this drives the library itself over an in-memory jar and
 * prints whatever it wrote.
 *
 *   node scripts/harness-session.mjs --url http://127.0.0.1:5799 --anon <key> \
 *     --user <uuid> --email author@example.com
 */

import { createServerClient } from '@supabase/ssr'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}

const url = arg('url')
const anon = arg('anon')
const userId = arg('user')
const email = arg('email', 'author@example.com')

if (!url || !anon || !userId) {
  console.error(
    'usage: harness-session.mjs --url <supabase-url> --anon <key> --user <uuid> [--email <addr>]'
  )
  process.exit(2)
}

// The gateway hands out a token for whoever asks; there is no password here.
const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', apikey: anon },
  body: JSON.stringify({ email, user_id: userId }),
})
if (!res.ok) {
  console.error(`token endpoint answered ${res.status}: ${await res.text()}`)
  process.exit(1)
}
const session = await res.json()

const jar = new Map()
const supabase = createServerClient(url, anon, {
  cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
  },
})

const { error } = await supabase.auth.setSession({
  access_token: session.access_token,
  refresh_token: session.refresh_token,
})
if (error) {
  console.error(`setSession refused the token: ${error.message}`)
  process.exit(1)
}

if (jar.size === 0) {
  console.error('setSession wrote no cookies — the app would see this as signed out')
  process.exit(1)
}

// A Cookie request header, ready for curl -H.
process.stdout.write([...jar].map(([n, v]) => `${n}=${v}`).join('; ') + '\n')
