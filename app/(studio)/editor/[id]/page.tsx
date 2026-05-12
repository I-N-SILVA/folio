import { notFound } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import { EditorClient } from '@/components/studio/EditorClient'
import type { Book } from '@/lib/book-schema'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditorPage({ params }: Props) {
  const { id } = await params
  const supabase = await createServerSupabase()

  const { data: book, error } = await supabase
    .from('books')
    .select('*, pages(*)')
    .eq('id', id)
    .order('page_number', { referencedTable: 'pages', ascending: true })
    .single()

  if (error || !book) {
    notFound()
  }

  return <EditorClient book={book as Book} />
}
