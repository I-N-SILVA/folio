/* Qlico service worker — conservative offline support.
 *
 * Strategy:
 *   - Navigations (HTML): network-first, fall back to the cached /offline page.
 *   - Hashed build assets (/_next/static): cache-first (immutable, safe).
 *   - Images, fonts and stylesheets: stale-while-revalidate.
 *   - Everything else is left alone entirely.
 *
 * The last line is the important one. This used to end with "other same-origin
 * GETs → stale-while-revalidate", which is a catch-all, and catch-alls in a
 * service worker are how you ship a bug you cannot recall: the worker outlives
 * the deploy that installed it. Two things fell into it —
 *
 *   - React Server Component payloads. App Router client navigations and
 *     prefetches fetch `?_rsc=…`, which is not `mode: 'navigate'`, so the
 *     dashboard's payload was cached and served stale-first. Create a book,
 *     navigate back, and the new book was missing until the revalidation
 *     landed and you navigated a second time. Those payloads are also private:
 *     they were persisted to disk under the Cache API and survived sign-out.
 *   - Media range requests. `<audio>`/`<video>` seeks send a Range header, and
 *     Cache API matching ignores it, so a cached 200 was handed back in place
 *     of a 206 and seeking broke.
 *
 * An allowlist can't grow those cases back by accident; a denylist could.
 */
const VERSION = 'qlico-v2'
const STATIC_CACHE = `${VERSION}-static`
const RUNTIME_CACHE = `${VERSION}-runtime`
const OFFLINE_URL = '/offline'

/** Keeps the runtime cache from growing without bound across deploys. */
const RUNTIME_MAX_ENTRIES = 60

/** Signed-in surfaces. Never cache these — not the HTML, not the payloads. */
const PRIVATE_PATHS = ['/dashboard', '/editor', '/account', '/analytics', '/create', '/redeem']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll([OFFLINE_URL])).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

function isPrivate(url) {
  return PRIVATE_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))
}

function isBypassed(request, url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/embed/') ||
    // RSC payloads: private, and staleness here reads as lost data.
    url.searchParams.has('_rsc') ||
    request.headers.has('range') ||
    isPrivate(url)
  )
}

/** Trim the oldest entries once the runtime cache goes over budget. */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  // cache.keys() returns insertion order, so the front is the oldest.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map((k) => cache.delete(k)))
}

/** Only these are safe to serve stale: static, public, and not range-requested. */
function isCacheableAsset(request) {
  return (
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'style'
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (isBypassed(request, url)) return

  // HTML navigations → network-first with offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
    return
  }

  // Immutable hashed assets → cache-first.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res && res.ok) {
              const copy = res.clone()
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
            }
            return res
          })
      )
    )
    return
  }

  if (!isCacheableAsset(request)) return

  // Public static assets → stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches
              .open(RUNTIME_CACHE)
              .then((cache) => cache.put(request, copy))
              .then(() => trimCache(RUNTIME_CACHE, RUNTIME_MAX_ENTRIES))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    })
  )
})
