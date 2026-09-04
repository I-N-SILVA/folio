import type { Book, Page, Block } from './book-schema'

/**
 * What has to be true before an edition goes live.
 *
 * Blocks now start empty rather than pre-filled with a sample video off a
 * third-party host — see `draftableUrl` in `book-schema.ts`. That is only safe
 * if something catches the empty ones before the link goes out, and this is it.
 * The check belongs at publish rather than while writing: an author part-way
 * through a page has not made a mistake, and a form that nags them is worse than
 * one that waits.
 *
 * Two severities:
 *   - `blocker` — publishing with this would embarrass the author. It is still
 *     their call: the dialog explains and lets them publish anyway, because a
 *     tool that refuses outright gets worked around.
 *   - `warning` — worth knowing, not worth stopping for.
 */

export type CheckSeverity = 'blocker' | 'warning'

export interface PublishIssue {
  id: string
  severity: CheckSeverity
  /** What is wrong, in the author's words. */
  title: string
  /** What to do about it. */
  detail: string
  /** 1-based, so it matches what the page rail shows. */
  pageNumber?: number
  blockId?: string
}

const PLACEHOLDER_HOSTS = ['w3schools.com', 'placehold.co', 'example.com']

function isPlaceholder(url: string | undefined): boolean {
  if (!url) return false
  return PLACEHOLDER_HOSTS.some((host) => url.includes(host))
}

function checkBlock(block: Block, pageNumber: number): PublishIssue[] {
  const issues: PublishIssue[] = []
  const at = { pageNumber, blockId: block.id }

  switch (block.type) {
    case 'image':
      if (!block.src) {
        issues.push({
          id: `${block.id}:src`,
          severity: 'blocker',
          title: `Image on page ${pageNumber} has no picture`,
          detail: 'Choose an image, or remove the block.',
          ...at,
        })
      } else if (!block.alt.trim()) {
        // Not a blocker: a missing alt text degrades the edition for some
        // readers rather than breaking it for all of them.
        issues.push({
          id: `${block.id}:alt`,
          severity: 'warning',
          title: `Image on page ${pageNumber} has no alt text`,
          detail: 'Describe it in a few words so screen-reader users get the picture too.',
          ...at,
        })
      }
      if (isPlaceholder(block.src)) {
        issues.push({
          id: `${block.id}:placeholder`,
          severity: 'blocker',
          title: `Image on page ${pageNumber} is still a placeholder`,
          detail: 'Replace it with your own picture before this goes out.',
          ...at,
        })
      }
      break

    case 'video':
      if (!block.src || isPlaceholder(block.src)) {
        issues.push({
          id: `${block.id}:src`,
          severity: 'blocker',
          title: `Video on page ${pageNumber} has no file`,
          detail: 'Choose a video, or remove the block.',
          ...at,
        })
      }
      break

    case 'audio':
      if (!block.src || isPlaceholder(block.src)) {
        issues.push({
          id: `${block.id}:src`,
          severity: 'blocker',
          title: `Audio on page ${pageNumber} has no file`,
          detail: 'Choose an audio file, or remove the block.',
          ...at,
        })
      }
      break

    case 'button':
      if (!block.href || isPlaceholder(block.href)) {
        issues.push({
          id: `${block.id}:href`,
          severity: 'blocker',
          title: `“${block.label || 'Button'}” on page ${pageNumber} goes nowhere`,
          detail: 'Give it a destination, or remove it — a dead button costs you the click.',
          ...at,
        })
      }
      break

    case 'data':
      if (!block.source || !block.path) {
        issues.push({
          id: `${block.id}:source`,
          severity: 'blocker',
          title: `Live data on page ${pageNumber} has no source`,
          detail: 'Point it at a JSON endpoint and a path, or remove the block.',
          ...at,
        })
      }
      break

    case 'product-grid':
      if (block.items.length === 0) {
        issues.push({
          id: `${block.id}:items`,
          severity: 'warning',
          title: `Product grid on page ${pageNumber} is empty`,
          detail: 'Add products, or remove the block.',
          ...at,
        })
      }
      break

    case 'embed':
      if (!block.html.trim()) {
        issues.push({
          id: `${block.id}:html`,
          severity: 'warning',
          title: `Embed on page ${pageNumber} is empty`,
          detail: 'Paste the embed code, or remove the block.',
          ...at,
        })
      }
      break

    case 'text':
      if (!block.content.trim()) {
        issues.push({
          id: `${block.id}:content`,
          severity: 'warning',
          title: `Empty text block on page ${pageNumber}`,
          detail: 'Write something, or remove it.',
          ...at,
        })
      }
      break
  }

  return issues
}

function checkPage(page: Page): PublishIssue[] {
  const issues: PublishIssue[] = []
  const n = page.page_number

  if (page.blocks.length === 0 && (page.hotspots?.length ?? 0) === 0 && !page.background) {
    issues.push({
      id: `page:${page.id}:empty`,
      severity: 'warning',
      title: `Page ${n} is blank`,
      detail: 'Readers will flip past a blank page wondering what they missed.',
      pageNumber: n,
    })
  }

  for (const block of page.blocks) issues.push(...checkBlock(block, n))

  for (const hotspot of page.hotspots ?? []) {
    if (hotspot.action === 'link' && !hotspot.linkUrl) {
      issues.push({
        id: `${hotspot.id}:url`,
        severity: 'blocker',
        title: `A pin on page ${n} links nowhere`,
        detail: 'Give it a destination, or change what it does.',
        pageNumber: n,
      })
    }
    if (hotspot.action === 'checkout' && !hotspot.stripeUrl) {
      // Without a buy URL this pin adds to a bag that may have no checkout —
      // see the commerce check below.
      issues.push({
        id: `${hotspot.id}:buy`,
        severity: 'warning',
        title: `A buy pin on page ${n} has no checkout link`,
        detail: 'Add the product’s payment link so a reader can actually complete the purchase.',
        pageNumber: n,
      })
    }
  }

  return issues
}

/** Every issue in an edition, blockers first, then in page order. */
export function publishChecks(book: Book): PublishIssue[] {
  const issues: PublishIssue[] = []
  const pages = book.pages ?? []

  for (const page of pages) issues.push(...checkPage(page))

  // A gate past the last page never fires, so the author gets no emails and no
  // explanation. Cheap to catch, impossible to notice.
  const gate = book.settings?.gating
  if (gate?.enabled && pages.length > 0 && gate.page_number > pages.length) {
    issues.push({
      id: 'gate:past-end',
      severity: 'blocker',
      title: `The email gate is set to page ${gate.page_number}, past the end`,
      detail: `This edition has ${pages.length} page${pages.length === 1 ? '' : 's'}, so the gate never appears and you capture nothing.`,
    })
  }

  // A cart with no checkout destination. Not a blocker — an author may want the
  // bag as a wishlist — but they should know before the link goes out.
  const hasCart = pages.some((p) =>
    p.blocks.some((b) => b.type === 'product-grid' && b.items.some((i) => (i.action ?? 'cart') === 'cart'))
  )
  if (hasCart && !book.settings?.checkoutUrl) {
    issues.push({
      id: 'commerce:no-checkout',
      severity: 'warning',
      title: 'Readers can add to the bag but not check out',
      detail: 'Add a checkout link in Edition settings, or point each product at its own buy URL.',
    })
  }

  const order: Record<CheckSeverity, number> = { blocker: 0, warning: 1 }
  return issues.sort(
    (a, b) => order[a.severity] - order[b.severity] || (a.pageNumber ?? 0) - (b.pageNumber ?? 0)
  )
}

export function countBlockers(issues: PublishIssue[]): number {
  return issues.filter((i) => i.severity === 'blocker').length
}
