import 'server-only'

// ─── Best-effort in-memory rate limiter ──────────────────────────────────────
//
// A lightweight fixed-window limiter that needs no external service. It is
// intentionally simple and has two known limits:
//   1. State lives in process memory, so each serverless instance has its own
//      window. Under heavy horizontal scaling the effective limit is
//      (limit × instances). It still meaningfully blunts abuse from a single
//      client and is far better than no limit at all.
//   2. Counters reset on cold start.
//
// For hard guarantees (e.g. billing-sensitive endpoints) migrate this to a
// shared store such as Upstash Redis or Vercel KV — the call sites do not need
// to change, only this module.

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

// Opportunistic cleanup so the map cannot grow without bound on a long-lived
// instance. Runs at most once per sweep window.
let lastSweep = 0
const SWEEP_INTERVAL_MS = 60_000

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export type RateLimitResult = {
  ok: boolean
  /** Seconds until the window resets — useful for a Retry-After header. */
  retryAfter: number
}

/**
 * Record a hit against `key` and report whether it is within `limit` per
 * `windowMs`. Identical keys share a window.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }

  bucket.count++
  if (bucket.count > limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  return { ok: true, retryAfter: 0 }
}

/** Derive a stable client identifier from request headers. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}
