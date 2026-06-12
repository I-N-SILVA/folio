import { ImageResponse } from 'next/og'
import { createServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

// Runs on the Node.js runtime: this route imports the Supabase clients, which
// push the bundle past Vercel's 1 MB Edge Function limit. Node serverless
// functions have a much larger size cap and next/og works there too.
export const runtime = 'nodejs'

export const alt = 'Book Cover'
export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default async function Image({ params }: { params: { slug: string } }) {
  const { data: book } = await supabaseAdmin
    .from('books')
    .select('title, description, theme, settings, pages(*)')
    .eq('slug', params.slug)
    .single()

  if (!book) {
    return new ImageResponse(
      (
        <div style={{ fontSize: 64, background: 'white', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Book Not Found
        </div>
      )
    )
  }

  const coverPage = book.pages?.find((p: any) => p.page_number === 1)
  const coverImage = coverPage?.blocks?.find((b: any) => b.type === 'image')?.src

  return new ImageResponse(
    (
      <div
        style={{
          background: book.theme?.background || '#f3f4f6',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 80,
          fontFamily: 'sans-serif',
        }}
      >
        {coverImage && (
          <img
            src={coverImage}
            alt="Cover"
            style={{
              height: '100%',
              objectFit: 'contain',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              marginRight: 60,
              borderRadius: 8,
            }}
          />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '50%' }}>
          <h1 style={{ fontSize: 64, fontWeight: 'bold', color: book.theme?.primary || '#111827', marginBottom: 24, lineHeight: 1.1 }}>
            {book.title}
          </h1>
          <p style={{ fontSize: 32, color: '#4b5563', lineHeight: 1.4 }}>
            {book.settings?.seo?.description || book.description || 'Interactive Digital Publication'}
          </p>
          <div style={{ display: 'flex', marginTop: 40, alignItems: 'center' }}>
             <div style={{ padding: '12px 24px', background: book.theme?.primary || '#111827', color: 'white', borderRadius: 8, fontSize: 24, fontWeight: 'bold' }}>
               Read Now
             </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
