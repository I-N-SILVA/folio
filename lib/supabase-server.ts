import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Sanitize env vars — Vercel can concatenate preview+production values with a space
function sanitizeKey(val: string | undefined): string {
  return (val ?? '').trim().split(/\s+/)[0] ?? ''
}

const supabaseUrl = sanitizeKey(process.env.NEXT_PUBLIC_SUPABASE_URL)
const supabaseAnonKey = sanitizeKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// Server client — only use in Server Components, Route Handlers, Server Actions
export async function createServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {}
      },
    },
  })
}
