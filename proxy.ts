import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PROTECTED_ROUTES = ['/dashboard', '/create', '/editor', '/analytics', '/account']

// Sanitize env vars — Vercel can concatenate preview+production values with a space.
function sanitize(val: string | undefined): string {
  return (val ?? '').trim().split(/\s+/)[0] ?? ''
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only run on protected routes
  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  )
  if (!isProtected) return NextResponse.next()

  const supabaseUrl = sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseAnonKey = sanitize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  // If Supabase isn't configured (e.g. a misconfigured preview), don't hard-fail.
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.next()

  const response = NextResponse.next()

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/create/:path*',
    '/editor/:path*',
    '/analytics/:path*',
    '/account/:path*',
  ],
}
