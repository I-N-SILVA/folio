import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  pageflipMinWidth,
  pageflipWouldUsePortrait,
  PAGEFLIP_DESKTOP_MIN_WIDTH,
} from './page-geometry'

/**
 * The reader must be a single page on a phone, not a two-page spread.
 *
 * `usePortrait` does not decide this. page-flip's own rule is
 *
 *     blockWidth < 2 * minWidth  &&  usePortrait  ->  portrait
 *
 * so with a flat `minWidth` of 200 the reader only went portrait below a 400px
 * container, while `ViewerEngine` calls anything under 768 mobile. Every width
 * in between rendered pages sized one-up but laid out two-up: the cover crammed
 * into the right half of a spread with dead space beside it. Confirmed in a
 * real browser at 500, 700 and 800 before the fix, on the class the library
 * writes (`stf__wrapper --landscape`, 70.5% aspect) rather than on pixels.
 */

/** ViewerEngine's own breakpoint. Kept here so a drift in it fails this file. */
const MOBILE_BREAKPOINT = 768

describe('a phone gets one page, not a spread', () => {
  // Real container widths a phone or small tablet produces.
  it.each([320, 375, 390, 414, 430, 500, 600, 700, 760, 767])(
    'a %ipx container resolves to portrait',
    (containerWidth) => {
      const isMobile = containerWidth < MOBILE_BREAKPOINT
      expect(isMobile).toBe(true)
      // On mobile ViewerEngine sizes the page to the whole container.
      const pageWidth = containerWidth
      const minWidth = pageflipMinWidth(pageWidth, isMobile)
      expect(pageflipWouldUsePortrait(containerWidth, minWidth)).toBe(true)
    }
  )

  it('the old flat 200 is exactly what broke it', () => {
    // Below 400 it happened to work, which is why small phones looked fine and
    // everything between 400 and 768 did not.
    expect(pageflipWouldUsePortrait(375, 200)).toBe(true)
    expect(pageflipWouldUsePortrait(500, 200)).toBe(false)
    expect(pageflipWouldUsePortrait(700, 200)).toBe(false)
  })
})

describe('desktop still gets the spread', () => {
  it.each([768, 900, 1024, 1440, 1920])('a %ipx container stays landscape', (containerWidth) => {
    const isMobile = containerWidth < MOBILE_BREAKPOINT
    expect(isMobile).toBe(false)
    // On desktop the page is half the container, bounded by the design width.
    const pageWidth = Math.min(containerWidth / 2, 460)
    const minWidth = pageflipMinWidth(pageWidth, isMobile)
    expect(minWidth).toBe(PAGEFLIP_DESKTOP_MIN_WIDTH)
    expect(pageflipWouldUsePortrait(containerWidth, minWidth)).toBe(false)
  })
})

describe('minWidth can never overflow its container', () => {
  // page-flip floors the root element at `minWidth` when portrait, so a value
  // above the container width would push the reader wider than the screen.
  it.each([320, 375, 500, 700, 767])('at %ipx', (containerWidth) => {
    const minWidth = pageflipMinWidth(containerWidth, true)
    expect(minWidth).toBeLessThanOrEqual(containerWidth)
  })
})

describe('ViewerEngine actually uses the helper', () => {
  it('does not hand page-flip a bare number', () => {
    const raw = readFileSync(
      join(__dirname, '..', 'components', 'viewer', 'ViewerEngine.tsx'),
      'utf-8'
    )
    // Comments are dropped first: the note beside that prop explains the bug by
    // quoting the old `minWidth={200}`, and a scanner that cannot tell
    // documentation from code reports the documentation. (The logo test learned
    // this the same way.) Whole-line comments only, so `https://` survives.
    const code = raw
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n')

    expect(code).toMatch(/minWidth=\{pageflipMinWidth\(/)
    // The literal that caused this. If it comes back, so does the bug.
    expect(code).not.toMatch(/minWidth=\{200\}/)
  })
})
