import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

// Sanitize env vars — Vercel can concatenate preview+production values with a space
function sanitizeKey(val: string | undefined): string {
  return (val ?? '').trim().split(/\s+/)[0] ?? ''
}

const supabaseUrl = sanitizeKey(process.env.NEXT_PUBLIC_SUPABASE_URL)
const supabaseAnonKey = sanitizeKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const supabaseServiceKey = sanitizeKey(process.env.SUPABASE_SERVICE_KEY)

// Browser client — safe to use in client components
export function createBrowserSupabase() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Service role client — lazy singleton, server-only
let _admin: SupabaseClient | null = null
export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })
  }
  return _admin
}

// Keep named export for backwards compat — proxy to lazy getter
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseAdmin() as any)[prop]
  },
})
