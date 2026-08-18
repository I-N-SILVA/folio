import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * The author's own notification preferences.
 *
 * Deliberately narrow: this route can set exactly one boolean. `profiles` also
 * carries `plan` and `status`, and migration 004 grants end users no UPDATE
 * policy at all precisely so nobody can promote themselves — so the safe shape
 * here is an allowlist of one field rather than a general profile update.
 */

const PreferencesSchema = z.object({
  digestOptOut: z.boolean(),
})

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = PreferencesSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ digest_opt_out: parsed.data.digestOptOut })
    .eq('id', user.id)

  if (error) {
    if (error.code === '42703') {
      return NextResponse.json(
        { error: 'Email preferences are not available on this deployment yet.' },
        { status: 503 }
      )
    }
    console.error('[preferences] update failed:', error)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }

  return NextResponse.json({ digestOptOut: parsed.data.digestOptOut })
}
