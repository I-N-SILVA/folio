/**
 * Enough of a Supabase API to run this app against a local PostgreSQL.
 *
 * `supabase-js` talks to `<url>/rest/v1` for data and `<url>/auth/v1` for
 * identity. PostgREST is the real thing behind the first; the second is a few
 * endpoints that read a JWT. That is all this app touches, so that is all this
 * implements — it exists to let the AppSumo licence path be exercised end to
 * end (webhook → licence row → redeem → plan on /account → refund → revert)
 * without a hosted project, which is the one step in the launch runbook a
 * script could not otherwise reach.
 *
 * A test harness. Not a Supabase implementation, and never to be pointed at
 * anything real: it mints tokens for anyone who asks.
 *
 *   node scripts/supabase-gateway.mjs --port 5599 --postgrest http://127.0.0.1:5598
 */

import { createServer } from 'node:http'
import crypto from 'node:crypto'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}

const PORT = Number(arg('port', 5599))
const POSTGREST = arg('postgrest', 'http://127.0.0.1:5598')
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? 'super-secret-jwt-token-with-at-least-32-characters'

const b64url = (buf) => Buffer.from(buf).toString('base64url')

export function mintToken(claims) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(
    JSON.stringify({ iss: 'supabase', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...claims })
  )
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

function verify(token) {
  const [h, p, s] = String(token ?? '').split('.')
  if (!h || !p || !s) return null
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64url')
  // Length-checked first: timingSafeEqual throws on a mismatch.
  if (s.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected))) return null
  try {
    return JSON.parse(Buffer.from(p, 'base64url').toString())
  } catch {
    return null
  }
}

const json = (res, status, body) => {
  const text = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) })
  res.end(text)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const bearer = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')

  // ── /auth/v1 ───────────────────────────────────────────────────────────────
  if (url.pathname === '/auth/v1/user') {
    const claims = verify(bearer)
    if (!claims?.sub) return json(res, 401, { message: 'invalid claim' })
    return json(res, 200, {
      id: claims.sub,
      aud: 'authenticated',
      role: claims.role ?? 'authenticated',
      email: claims.email ?? null,
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    })
  }

  if (url.pathname === '/auth/v1/token' || url.pathname === '/auth/v1/signup') {
    // The harness signs a user in by asking for a token; there is no password
    // check because there is nothing to protect here.
    const body = await readBody(req)
    const email = body?.email ?? 'harness@example.com'
    const id = body?.user_id ?? crypto.randomUUID()
    const access_token = mintToken({ sub: id, email, role: 'authenticated' })
    return json(res, 200, {
      access_token,
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'harness-refresh',
      user: { id, email, aud: 'authenticated', role: 'authenticated' },
    })
  }

  if (url.pathname.startsWith('/auth/v1/')) return json(res, 200, {})

  // ── /rest/v1 → PostgREST ───────────────────────────────────────────────────
  if (url.pathname.startsWith('/rest/v1')) {
    const target = POSTGREST + url.pathname.replace(/^\/rest\/v1/, '') + url.search
    const headers = {}
    for (const [k, v] of Object.entries(req.headers)) {
      // Hop-by-hop and routing headers must not be forwarded.
      if (['host', 'connection', 'content-length', 'apikey', 'accept-encoding'].includes(k)) continue
      headers[k] = v
    }
    // PostgREST decides the role from the JWT. supabase-js sends the key as the
    // bearer for the admin client, which is already a service_role JWT here.
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await rawBody(req)
    try {
      const upstream = await fetch(target, { method: req.method, headers, body })
      const text = await upstream.text()
      const out = {}
      for (const [k, v] of upstream.headers) {
        if (['content-encoding', 'transfer-encoding', 'connection'].includes(k)) continue
        out[k] = v
      }
      res.writeHead(upstream.status, out)
      res.end(text)
    } catch (err) {
      json(res, 502, { message: String(err) })
    }
    return
  }

  json(res, 404, { message: 'not found' })
})

function rawBody(req) {
  return new Promise((resolve) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

async function readBody(req) {
  const buf = await rawBody(req)
  try {
    return JSON.parse(buf.toString() || '{}')
  } catch {
    return {}
  }
}

if (process.argv.includes('--print-keys')) {
  console.log(JSON.stringify({
    anon: mintToken({ role: 'anon' }),
    service_role: mintToken({ role: 'service_role' }),
  }))
  process.exit(0)
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`supabase gateway on http://127.0.0.1:${PORT} → ${POSTGREST}`)
})
