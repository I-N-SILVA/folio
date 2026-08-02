import { notFound, redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard'

async function getBookWithAnalytics(slug: string) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { redirect: true }

  // Pages come along so the dashboard can resolve hotspot and block IDs to
  // their human labels, and render the real page behind the click heatmap.
  const { data: book } = await supabase
    .from('books')
    .select('*, pages(*)')
    .eq('slug', slug)
    .eq('owner_id', user.id)
    .single()

  if (!book) return { notFound: true }
  if (Array.isArray(book.pages)) {
    book.pages.sort((a: { page_number: number }, b: { page_number: number }) => a.page_number - b.page_number)
  }
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
