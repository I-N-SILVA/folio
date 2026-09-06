import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { contrastRatio, composite, readableOn, parseHex } from './contrast'
import { TEMPLATES } from '@/data/templates'

/** WCAG AA for normal-size text. The pill is 9px, so it is not "large". */
const AA = 4.5

describe('contrast maths', () => {
  it('reads the three hex forms', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseHex('#d97706')).toEqual({ r: 217, g: 119, b: 6, a: 1 })
    expect(parseHex('#00000080')?.a).toBeCloseTo(0.502, 2)
    expect(parseHex('nonsense')).toBeNull()
  })

  it('agrees with the known extremes', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
  })

  it('flattens a wash onto its ground', () => {
    // 0x80/255 is 0.502, so the flattened value is 127 rather than a clean half.
    expect(composite('#00000080', '#ffffff')).toBe('#7f7f7f')
    expect(composite('#ff0000', '#00ff00')).toBe('#ff0000')
  })

  it('leaves a colour alone when it already passes', () => {
    expect(readableOn('#000000', '#ffffff')).toBe('#000000')
  })

  it('keeps the hue while it fixes the ratio', () => {
    const bg = composite('#d9770622', '#fcfbf9')
    const fixed = readableOn('#d97706', bg)
    expect(contrastRatio('#d97706', bg)).toBeLessThan(AA)
    expect(contrastRatio(fixed, bg)).toBeGreaterThanOrEqual(AA)
    // Still amber: red highest, blue lowest, same ordering as the original.
    const c = parseHex(fixed)!
    expect(c.r).toBeGreaterThan(c.g)
    expect(c.g).toBeGreaterThan(c.b)
  })
})

describe('every template card is readable', () => {
  /**
   * The colours are data, so `lib/contrast-tokens.test.ts` — which scans class
   * names — cannot see them. `npm run audit:browser` found "MONOGRAPH 2026" at
   * 2.7:1 on /gallery, at all four widths and in both colour schemes, and would
   * find the next one only if somebody ran it. This finds them at build time.
   */
  it.each(TEMPLATES.map((t) => [t.id, t.previewMockup] as const))(
    '%s',
    (_id, mockup) => {
      const pill = composite(`${mockup.accentHex}22`, mockup.bgHex)
      expect(contrastRatio(readableOn(mockup.accentHex, pill), pill)).toBeGreaterThanOrEqual(AA)
      // The headline and subheadline are the template's own text colour on its
      // own background, with no correction available — those hexes have to be
      // chosen right.
      expect(contrastRatio(mockup.textHex, mockup.bgHex)).toBeGreaterThanOrEqual(AA)
    }
  )
})

describe('both cards ask for the corrected colour', () => {
  it.each(['app/gallery/page.tsx', 'components/studio/CreateBookModal.tsx'])('%s', (file) => {
    const src = readFileSync(join(__dirname, '..', file), 'utf8')
    expect(src).toContain('readableOn(')
    // The pill's ground is the wash over the card, not the card itself; passing
    // bgHex directly would compute against the wrong background.
    expect(src).toMatch(/composite\(\s*(`|')?\$?\{?tmpl\.previewMockup\.accentHex/)
  })
})
