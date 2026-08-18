import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next')
  // Only allow same-origin relative paths to prevent open-redirects.
  const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  if (!code) {
    // Landing here without a code means the link was malformed or already
    // consumed. Silently redirecting to /dashboard just bounced back to /login
    // with no explanation of what went wrong.
    return NextResponse.redirect(new URL('/login?error=link_invalid', request.url))
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // Expired or reused magic links land here. The old code ignored the result
    // and sent the user to /dashboard, which redirects to /login — an
    // unexplained loop that looks like the app is broken.
    const reason = /expire/i.test(error.message) ? 'link_expired' : 'link_invalid'
    return NextResponse.redirect(new URL(`/login?error=${reason}`, request.url))
  }

  // `signed_in` marks the one hop where the magic link actually worked, which is
  // the only place the gap between "we sent a link" and "they came back" can be
  // measured. The destination fires `signup_completed` and strips the param.
  const destination = new URL(next, request.url)
  destination.searchParams.set('signed_in', '1')
  return NextResponse.redirect(destination)
}
