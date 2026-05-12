import { notFound, redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard'

async function getBookWithAnalytics(slug: string) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { redirect: true }

  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('slug', slug)
    .eq('owner_id', user.id)
    .single()

  if (!book) return { notFound: true }
  return { book }
}

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const result = await getBookWithAnalytics(slug)

  if ('redirect' in result) redirect('/login')
  if ('notFound' in result) notFound()

  return <AnalyticsDashboard book={result.book!} />
}
