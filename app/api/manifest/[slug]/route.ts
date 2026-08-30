import { NextRequest, NextResponse } from 'next/server'
import { getDemoBook } from '@/data/books'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  let title = 'QLICO Edition'
  let description = 'Interactive publication on QLICO'
  let themeColor = '#000000'
  let bgColor = '#ffffff'

  const demo = getDemoBook(slug)
  if (demo) {
    title = demo.title
    description = demo.description || description
    themeColor = demo.theme?.primary || themeColor
    bgColor = demo.theme?.background || bgColor
  } else {
    try {
      const supabase = await createServerSupabase()
      const { data: book } = await supabase
        .from('books')
        .select('title, description, theme')
        .eq('slug', slug)
        .maybeSingle()

      if (book) {
        title = book.title || title
        description = book.description || description
        if (book.theme?.primary) themeColor = book.theme.primary
        if (book.theme?.background) bgColor = book.theme.background
      }
    } catch {
      // Fallback
    }
  }

  const manifest = {
    name: `${title} — QLICO`,
    short_name: title.slice(0, 18),
    description,
    start_url: `/book/${slug}?pwa=1`,
    display: 'standalone',
    orientation: 'any',
    background_color: bgColor,
    theme_color: themeColor,
    icons: [
      {
        src: '/brand/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/brand/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
