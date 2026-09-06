/**
 * Enough of a Supabase API to run this app against a local PostgreSQL.
 *
 * `supabase-js` talks to `<url>/rest/v1` for data, `<url>/auth/v1` for identity
 * and `<url>/storage/v1` for files. PostgREST is the real thing behind the
 * first; the second is a few endpoints that read a JWT, and the third is a
 * directory. That is all this app touches, so that is all this implements — it exists to let the AppSumo licence path be exercised end to
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
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}

const PORT = Number(arg('port', 5599))
const POSTGREST = arg('postgrest', 'http://127.0.0.1:5598')
const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? 'super-secret-jwt-token-with-at-least-32-characters'

// Storage lives on disk under a temp root, one directory per bucket. It is
// wiped on start so a run never inherits the last one's objects.
const STORAGE_ROOT = arg('storage', path.join(os.tmpdir(), `qlico-gateway-storage-${PORT}`))
fs.rmSync(STORAGE_ROOT, { recursive: true, force: true })
fs.mkdirSync(STORAGE_ROOT, { recursive: true })

/** Signed upload tokens, minted by createSignedUploadUrl and spent by the PUT. */
const uploadTokens = new Map()

/** Object keys are `<bucket>/<path>`; `..` in a path would escape the root. */
const objectFile = (key) => {
  const safe = key.split('/').filter((seg) => seg && seg !== '.' && seg !== '..')
  return path.join(STORAGE_ROOT, ...safe)
}

const b64url = (buf) => Buffer.from(buf).toString('base64url')

export function mintToken(claims) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(
    JSON.stringify({
      iss: 'supabase',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...claims,
    })
  )
  const sig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url')
  return `${header}.${payload}.${sig}`
}

function verify(token) {
  const [h, p, s] = String(token ?? '').split('.')
  if (!h || !p || !s) return null
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64url')
  // Length-checked first: timingSafeEqual throws on a mismatch.
  if (
    s.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected))
  )
    return null
  try {
    return JSON.parse(Buffer.from(p, 'base64url').toString())
  } catch {
    return null
  }
}

const json = (res, status, body) => {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(text),
  })
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
      if (['host', 'connection', 'content-length', 'apikey', 'accept-encoding'].includes(k))
        continue
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

  // ── /storage/v1 ────────────────────────────────────────────────────────────
  //
  // Enough of Supabase Storage to run the PDF import, which is the product's
  // first sentence and the one path no harness could reach: the importer hands
  // the browser a signed target per page, the browser writes the PNGs straight
  // to storage, and /api/import/pdf/finalize reads back whatever landed. None of
  // that is expressible against PostgREST.
  //
  // The endpoints and payload shapes are @supabase/storage-js's, read out of
  // `node_modules/@supabase/storage-js/src/packages/StorageFileApi.ts` rather
  // than remembered — `createSignedUploadUrl` in particular answers with a
  // relative `url` that the client re-parses for its `token`.
  if (url.pathname.startsWith('/storage/v1/')) {
    const p = url.pathname.replace('/storage/v1', '')

    // createBucket. Buckets are directories, and making one twice is fine.
    if (req.method === 'POST' && p === '/bucket') {
      const body = await readBody(req)
      const name = body?.id ?? body?.name
      if (!name) return json(res, 400, { message: 'bucket name required' })
      fs.mkdirSync(objectFile(name), { recursive: true })
      return json(res, 200, { name })
    }

    // createSignedUploadUrl → { url: "/object/upload/sign/<key>?token=…" }
    if (req.method === 'POST' && p.startsWith('/object/upload/sign/')) {
      const key = decodeURIComponent(p.slice('/object/upload/sign/'.length))
      const token = crypto.randomBytes(16).toString('hex')
      uploadTokens.set(token, key)
      return json(res, 200, { url: `/object/upload/sign/${key}?token=${token}` })
    }

    // uploadToSignedUrl spends the token; a token is good for its own key once.
    if (req.method === 'PUT' && p.startsWith('/object/upload/sign/')) {
      const key = decodeURIComponent(p.slice('/object/upload/sign/'.length))
      const token = url.searchParams.get('token')
      if (!token || uploadTokens.get(token) !== key) {
        return json(res, 400, { message: 'Invalid signature' })
      }
      uploadTokens.delete(token)
      await writeObject(req, key)
      return json(res, 200, { Id: crypto.randomUUID(), Key: key })
    }

    // list — POST { prefix, limit }. Only the file names are read back.
    if (req.method === 'POST' && p.startsWith('/object/list/')) {
      const bucket = p.slice('/object/list/'.length)
      const body = await readBody(req)
      const dir = objectFile(`${bucket}/${body?.prefix ?? ''}`)
      let names = []
      try {
        names = fs
          .readdirSync(dir, { withFileTypes: true })
          .filter((d) => d.isFile())
          .map((d) => d.name)
          .sort()
      } catch {
        names = []
      }
      const limit = Number(body?.limit) || 100
      return json(
        res,
        200,
        names.slice(0, limit).map((name) => ({
          name,
          id: crypto.randomUUID(),
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          metadata: {},
        }))
      )
    }

    // download, both the authenticated and the public form.
    if (req.method === 'GET' && p.startsWith('/object/')) {
      const key = decodeURIComponent(p.replace(/^\/object\/(public\/)?/, ''))
      try {
        const buf = fs.readFileSync(objectFile(key))
        res.writeHead(200, {
          'content-type': 'application/octet-stream',
          'content-length': buf.length,
        })
        return res.end(buf)
      } catch {
        return json(res, 404, { message: 'Object not found' })
      }
    }

    // plain upload
    if ((req.method === 'POST' || req.method === 'PUT') && p.startsWith('/object/')) {
      const key = decodeURIComponent(p.slice('/object/'.length))
      await writeObject(req, key)
      return json(res, 200, { Id: crypto.randomUUID(), Key: key })
    }

    return json(res, 404, { message: 'not found' })
  }

  json(res, 404, { message: 'not found' })
})

/**
 * Store the request body at `key`.
 *
 * storage-js sends a Blob as multipart/form-data and everything else raw. The
 * harness only needs the bytes back byte-for-byte, so a multipart body is
 * unwrapped by finding the blank line that ends the part headers and trimming
 * the trailing boundary — enough for one file part, which is all either upload
 * path ever sends.
 */
async function writeObject(req, key) {
  let body = await rawBody(req)
  const type = req.headers['content-type'] ?? ''
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(type)
  if (boundary) {
    const marker = Buffer.from(`--${boundary[1] ?? boundary[2]}`)
    const parts = []
    let from = 0
    for (;;) {
      const at = body.indexOf(marker, from)
      if (at === -1) break
      if (from !== 0) parts.push(body.subarray(from, at))
      from = at + marker.length
    }
    // The file part is the one whose headers name a filename.
    const file = parts.find((part) => /filename=/i.test(part.subarray(0, 400).toString('latin1')))
    if (file) {
      const sep = file.indexOf('\r\n\r\n')
      body = sep === -1 ? file : file.subarray(sep + 4, file.length - 2)
    }
  }
  const file = objectFile(key)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body)
}

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
  console.log(
    JSON.stringify({
      anon: mintToken({ role: 'anon' }),
      service_role: mintToken({ role: 'service_role' }),
    })
  )
  process.exit(0)
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`supabase gateway on http://127.0.0.1:${PORT} → ${POSTGREST}`)
})
