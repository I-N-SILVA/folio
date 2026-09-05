/**
 * One definition of a page's shape, shared by every surface that draws one.
 *
 * Block styles are absolute — `p-8`, `text-2xl`, fixed gaps — so a page's
 * composition depends on the pixel width it is laid out at, not just its
 * aspect ratio. Rendering a preview at a different width silently changes the
 * design: at 280px the same content occupies ~1.6x the relative space it does
 * at 460px, which is enough to overflow the page and clip.
 *
 * Every preview therefore lays the page out at PAGE_DESIGN_WIDTH and scales the
 * result down to fit its frame. That keeps a thumbnail, a library cover, the
 * editor canvas, and the reader showing the same page rather than four
 * different ones. These numbers drifting apart is what made previews look
 * wrong, so they live here and nowhere else.
 */

/** A4 portrait. */
export const PAGE_RATIO = 1.41

/** The width the reader lays a page out at (ViewerEngine's per-page cap). */
export const PAGE_DESIGN_WIDTH = 460

export const PAGE_DESIGN_HEIGHT = Math.round(PAGE_DESIGN_WIDTH * PAGE_RATIO)

/** CSS `aspect-ratio` value for a page-shaped frame. */
export const PAGE_ASPECT = `1 / ${PAGE_RATIO}`

/** Scale that fits a design-width page into `frameWidth`. */
export function pageScale(frameWidth: number): number {
  return frameWidth / PAGE_DESIGN_WIDTH
}

/**
 * Zoom bounds, shared by the reader's control and the editor canvas. These were
 * duplicated per surface — the same drift that made the page previews wrong,
 * one level down.
 */
export const ZOOM_MIN = 0.7
export const ZOOM_MAX = 2
export const ZOOM_STEP = 0.1

/** Discrete steps the editor canvas snaps through. */
export const ZOOM_STEPS = [0.75, 0.9, 1, 1.25, 1.5, 2]

/** Avoids labels reading 109.99999%. */
export function roundZoom(z: number): number {
  return Math.round(z * 10) / 10
}

// ─── Spreads ─────────────────────────────────────────────────────────────────
//
// The reader shows two facing pages on anything wider than a phone
// (`usePortrait={isMobile}` in ViewerEngine), while the editor only ever showed
// one. So an author composing page 12 never saw page 13, never saw the gutter,
// and could not tell which of their pages face each other — the most basic
// thing anyone laying out a publication needs to know.
//
// The pairing lives here, with the rest of the page's shape, so the editor and
// the reader cannot drift apart on it.

export type PageSide = 'single' | 'left' | 'right'

/**
 * Which half of a spread a page sits on.
 *
 * Page 1 stands alone as the cover (`showCover` in the flipbook), so the pairs
 * are (2,3), (4,5), and so on — index 1 with 2, 3 with 4.
 */
export function pageSideFor(index: number, portrait: boolean): PageSide {
  if (portrait || index === 0) return 'single'
  return index % 2 === 1 ? 'left' : 'right'
}

/**
 * The two page indices facing each other, given any page in the spread.
 *
 * `right` is null for the cover, and for a final left-hand page with nothing
 * opposite it — both of which a reader sees as a half-empty spread, so the
 * editor should show them the same way.
 */
export function spreadFor(
  index: number,
  total: number
): { left: number | null; right: number | null } {
  if (index <= 0) return { left: null, right: 0 }
  const left = index % 2 === 1 ? index : index - 1
  const right = left + 1
  return { left, right: right < total ? right : null }
}
