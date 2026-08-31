import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { isAiEnabled, detectHotspots } from '@/lib/ai'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import type { Hotspot, Page } from '@/lib/book-schema'

const DetectSchema = z.object({
  page: z.custom<Page>(),
})

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
      const priceMatches = block.content.match(/(?:[$€£¥]\s*\d+(?:\.\d{2})?|\d+(?:\.\d{2})?\s*(?:USD|EUR|GBP))/gi)
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
    const heading = firstText?.content?.slice(0, 30)?.replace(/#+/g, '')?.trim() || 'Interactive Detail'
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

export async function POST(request: NextRequest) {
  const limit = rateLimit(`ai-detect:${clientIp(request)}`, 15, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait a moment.' },
      { status: 429 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = DetectSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Page data is required.' }, { status: 400 })
  }

  const { page } = parsed.data

  let detected: Hotspot[] = []

  // If image background URL exists and AI is enabled, we could fetch and analyze
  if (isAiEnabled() && page.background?.image) {
    try {
      const imgRes = await fetch(page.background.image)
      if (imgRes.ok) {
        const buffer = Buffer.from(await imgRes.arrayBuffer())
        detected = await detectHotspots(buffer, page.page_number)
      }
    } catch (e) {
      console.error('[AI] Vision detection fallback:', e)
    }
  }

  // Fallback to structural heuristic extraction
  if (detected.length === 0) {
    detected = extractHeuristicHotspots(page)
  }

  return NextResponse.json({ detected, count: detected.length })
}
