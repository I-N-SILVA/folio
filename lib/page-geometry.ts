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
