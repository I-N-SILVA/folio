// A stand-in for PostgREST, just enough for the studio (dashboard, editor,
// account, insights) to render for one signed-in author, with the bundled demo
// editions as their books. Used by `npm run measure:ux`; never pointed at
// anything real. Run behind scripts/supabase-gateway.mjs, which handles auth.
import { createServer } from 'node:http'
import fs from 'node:fs'

const ROOT = new URL('../data/books', import.meta.url).pathname
const USER = '11111111-1111-4111-8111-111111111111'
const ids = [
  'a1111111-1111-4111-8111-111111111111',
  'a2222222-2222-4222-8222-222222222222',
  'a3333333-3333-4333-8333-333333333333',
]
const books = ['demo-lookbook', 'demo-report', 'demo-portfolio'].map((dir, i) => {
  const b = JSON.parse(fs.readFileSync(`${ROOT}/${dir}/book.json`, 'utf8'))
  return {
    ...b,
    id: ids[i],
    owner_id: USER,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-28T00:00:00Z',
    pages: (b.pages ?? []).map((p, j) => ({
      ...p,
      id: p.id ?? `${ids[i]}-p${j}`,
      book_id: ids[i],
    })),
  }
})
const profile = {
  id: USER,
  email: 'author@example.com',
  plan: 'free',
  status: 'active',
  appsumo_license_key: null,
  appsumo_tier: null,
  digest_opt_out: false,
}

const send = (res, code, body, headers = {}) => {
  res.writeHead(code, { 'content-type': 'application/json', ...headers })
  res.end(body === undefined ? '' : JSON.stringify(body))
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  const single = (req.headers.accept ?? '').includes('vnd.pgrst.object')
  const table = url.pathname.replace(/^\//, '')
  const q = Object.fromEntries(url.searchParams)
  if (req.method === 'POST' && table.startsWith('rpc/')) return send(res, 200, null)
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 200, single ? {} : [])
  let rows = []
  if (table === 'books') {
    rows = books
    if (q.id) rows = rows.filter((b) => b.id === q.id.replace('eq.', ''))
    if (q.slug) rows = rows.filter((b) => b.slug === q.slug.replace('eq.', ''))
    if (!String(q.select ?? '').includes('pages')) rows = rows.map(({ pages, ...b }) => b)
  } else if (table === 'profiles') rows = [profile]
  else if (table === 'pages') rows = books.flatMap((b) => b.pages)
  const range = `0-${Math.max(rows.length - 1, 0)}/${rows.length}`
  if (req.method === 'HEAD') return send(res, 200, undefined, { 'content-range': range })
  if (single)
    return rows[0]
      ? send(res, 200, rows[0])
      : send(res, 406, { code: 'PGRST116', message: 'no rows' })
  send(res, 200, rows, { 'content-range': range })
}).listen(Number(process.env.MOCK_REST_PORT ?? 5598), () =>
  console.log('mock rest on', process.env.MOCK_REST_PORT ?? 5598)
)
