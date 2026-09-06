import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import { RedeemForm } from '@/components/studio/RedeemForm'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Redeem your deal',
  description: 'Enter your AppSumo license code to unlock your lifetime plan.',
}

/**
 * Redemption, behind sign-in.
 *
 * This page had no auth check. `/api/appsumo/redeem` correctly answers 401 to a
 * signed-out caller, and the form rendered that as the literal word
 * "Unauthorized" — to a buyer arriving from their AppSumo receipt, who is
 * signed out almost by definition, on the one screen that stands between paying
 * and using the product. At launch volume that is the support queue.
 *
 * `?code=` survives the round trip through the magic link, so a buyer who has
 * to sign in first does not come back to an empty field holding a code they now
 * have to find again.
 */
export default async function RedeemPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const { code } = await searchParams
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const next = code ? `/redeem?code=${encodeURIComponent(code)}` : '/redeem'
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }

  return <RedeemForm initialCode={code ?? ''} />
}
