import { notFound, redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import { EditorClient } from '@/components/studio/EditorClient'
import type { Book } from '@/lib/book-schema'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditorPage({ params }: Props) {
  const { id } = await params
  const supabase = await createServerSupabase()

  // Ownership is checked here rather than left to RLS. `books` carries two
  // SELECT policies — `owner_all` and `public_read_published` — and the second
  // matches any published book for any caller, so an unqualified select loaded
  // a stranger's published book into the full editor: their gate configuration,
  // SEO settings and publish state, in a UI whose every save then failed
  // silently against the UPDATE policy. Filtering on owner_id makes the query
  // say what the page means.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/editor/${id}`)}`)

  const { data: book, error } = await supabase
    .from('books')
    .select('*, pages(*)')
    .eq('id', id)
    .eq('owner_id', user.id)
    .order('page_number', { referencedTable: 'pages', ascending: true })
    .maybeSingle()

  if (error || !book) {
    notFound()
  }

  return <EditorClient book={book as Book} />
}
