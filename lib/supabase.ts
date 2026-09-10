import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

// Sanitize env vars — Vercel can concatenate preview+production values with a space
function sanitizeKey(val: string | undefined): string {
  return (val ?? '').trim().split(/\s+/)[0] ?? ''
}

const supabaseUrl = sanitizeKey(process.env.NEXT_PUBLIC_SUPABASE_URL)
const supabaseAnonKey = sanitizeKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
/**
 * The service-role key. Deliberately does NOT fall back to the anon key.
 *
 * It used to, and that one line turned every server-side "admin" client into an
 * anonymous one on any deployment that had not set the key — silently, with
 * nothing in the logs. Saving broke in two different ways depending on whether
 * the edition happened to be published:
 *
 *   - A draft: `books` RLS ("owner_all") gives an anonymous reader nothing, so
 *     the ownership check in PUT /api/books/[id]/pages found no row and told the
 *     legitimate owner 403 Forbidden.
 *   - A published edition: "public_read_published" lets that check through, and
 *     the save then died inside `replace_book_pages`, which is REVOKEd from anon
 *     and authenticated and granted only to service_role — a 42501 the route
 *     does not recognise, so it surfaced as a 500.
 *
 * Neither says "this deployment has no service key". Failing at the first admin
 * call does, and `hasServiceRoleKey()` lets a route say so before it tries.
 */
const supabaseServiceKey = sanitizeKey(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
)

// Browser client — safe to use in client components
export function createBrowserSupabase() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Service role client — lazy singleton, server-only
let _admin: SupabaseClient | null = null
export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseServiceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Every server-side write needs it — saving an ' +
        'edition, the billing and AppSumo webhooks, PDF import, the digest. Set it in ' +
        '.env.local and in the deployment environment (SUPABASE_SERVICE_KEY is also read).'
    )
  }
  if (!_admin) {
    _admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })
  }
  return _admin
}

/**
 * Whether server-side admin work can run at all, so a route can answer usefully
 * instead of failing somewhere deeper with an unrelated-looking error.
 */
export function hasServiceRoleKey(): boolean {
  return Boolean(supabaseServiceKey)
}

// Ensure the storage bucket exists on demand
let _bucketReady = false
export async function ensureFolioBucket(): Promise<void> {
  if (_bucketReady) return
  try {
    const admin = getSupabaseAdmin()
    await admin.storage.createBucket('folio-assets', { public: true })
    _bucketReady = true
  } catch {
    _bucketReady = true
  }
}

// Keep named export for backwards compat — proxy to lazy getter
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseAdmin() as any)[prop]
  },
})
