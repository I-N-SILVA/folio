import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { isAiEnabled, detectHotspots } from '@/lib/ai'
import { rateLimitCost } from '@/lib/rate-limit'
import { createServerSupabase } from '@/lib/supabase-server'
import { isFetchableImage } from '@/lib/safe-fetch'
import type { Hotspot, Page } from '@/lib/book-schema'

/**
 * One page or many.
 *
 * The editor only ever asked about the page the author was looking at, so after
 * importing a 24-page PDF the offer was "find the products on this one page" —
 * repeated 24 times, by hand. `pages` lets the post-import step ask once.
 * `page` is kept so the existing single-page button keeps working.
 */
const DetectSchema = z.union([
  z.object({ page: z.custom<Page>() }),
  z.object({ pages: z.array(z.custom<Page>()).min(1).max(120) }),
])

/**
 * Heuristic fallback hotspot generator if Gemini AI is not configured.
 * Extracts prices, links, and bold titles from page blocks.
 */
function extractHeuristicHotspots(page: Page): Hotspot[] {
  const hotspots: Hotspot[] = []
  let yOffset = 25

  for (const block of page.blocks ?? []) {
    if (block.type === 'text') {
      // Find prices like $99.00, €150, £45
      const priceMatches = block.content.match(
        /(?:[$€£¥]\s*\d+(?:\.\d{2})?|\d+(?:\.\d{2})?\s*(?:USD|EUR|GBP))/gi
      )
      if (priceMatches) {
        for (const price of priceMatches) {
          hotspots.push({
            id: uuidv4(),
            label: price.trim(),
            x: 78,
            y: Math.min(85, yOffset),
            icon: 'ShoppingBag',
            action: 'checkout',
            price: price.trim(),
            modal: {
              title: `Purchase (${price.trim()})`,
              body: 'Instant one-click checkout or product details.',
            },
          })
          yOffset += 15
        }
      }

      // Find links
      const linkMatches = block.content.match(/https?:\/\/[^\s)]+/g)
      if (linkMatches) {
        for (const link of linkMatches) {
          hotspots.push({
            id: uuidv4(),
            label: 'Visit Link',
            x: 50,
            y: Math.min(90, yOffset),
            icon: 'ExternalLink',
            action: 'link',
            linkUrl: link,
            modal: {
              title: 'External Resource',
              body: link,
            },
          })
          yOffset += 15
        }
      }
    }
  }

  // If no prices/links found, add a sample interactive highlight pin
  if (hotspots.length === 0 && (page.blocks?.length ?? 0) > 0) {
    const firstText = page.blocks?.find((b) => b.type === 'text') as any
    const heading =
      firstText?.content?.slice(0, 30)?.replace(/#+/g, '')?.trim() || 'Interactive Detail'
    hotspots.push({
      id: uuidv4(),
      label: heading,
      x: 50,
      y: 50,
      icon: 'Compass',
      action: 'modal',
      modal: {
        title: heading,
        body: 'Click to explore expanded notes and high-resolution details.',
      },
    })
  }

  return hotspots
}

/** Whatever we can find on one page, AI first and structure as the fallback. */
async function detectForPage(page: Page): Promise<Hotspot[]> {
  let detected: Hotspot[] = []

  if (isAiEnabled() && page.background?.image && (await isFetchableImage(page.background.image))) {
    try {
      // `redirect: 'manual'` because only the first URL was ever checked: a 302
      // to the metadata service would otherwise be followed without inspection.
      const imgRes = await fetch(page.background.image, { redirect: 'manual' })
      if (imgRes.ok) {
        const buffer = Buffer.from(await imgRes.arrayBuffer())
        detected = await detectHotspots(buffer, page.page_number)
      }
    } catch (e) {
      console.error('[AI] Vision detection fallback:', e)
    }
  }

  return detected.length > 0 ? detected : extractHeuristicHotspots(page)
}

export async function POST(request: NextRequest) {
  // This route spends the project's Gemini quota and makes the server fetch
  // URLs, and it had no authentication at all — only a per-IP request count.
  // Signed-in only, and budgeted per user rather than per address.
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = DetectSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Page data is required.' }, { status: 400 })
  }

  // Charged per page, because that is what the work is. 200 pages a minute
  // covers importing several long PDFs back to back and stops a loop.
  const pageCount = 'page' in parsed.data ? 1 : parsed.data.pages.length
  const limit = rateLimitCost(`ai-detect:${user.id}`, 200, 60_000, pageCount)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'That is a lot of pages at once. Try again in a minute.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  if ('page' in parsed.data) {
    const detected = await detectForPage(parsed.data.page)
    return NextResponse.json({ detected, count: detected.length })
  }

  // Sequential, not Promise.all: each page may fetch and hand an image to
  // Gemini, and firing 24 of those at once is how you get rate-limited by the
  // provider rather than by us.
  const byPage: { pageId: string; pageNumber: number; hotspots: Hotspot[] }[] = []
  for (const page of parsed.data.pages) {
    byPage.push({
      pageId: page.id,
      pageNumber: page.page_number,
      hotspots: await detectForPage(page),
    })
  }

  return NextResponse.json({
    byPage,
    count: byPage.reduce((total, p) => total + p.hotspots.length, 0),
  })
}
