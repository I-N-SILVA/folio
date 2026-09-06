/**
 * Making a template's accent readable as text.
 *
 * Every gallery card paints its own colours: the template chooses a background
 * and an accent, and the little category pill is the accent as text over a 13%
 * wash of itself. An accent is picked to sit *beside* text, not to be text, so
 * some of them land far below AA at 9px — `#d97706` on `#fcfbf9` reads 2.7:1,
 * which `npm run audit:browser` found on /gallery at every width and in both
 * colour schemes.
 *
 * Rejected: hand-correcting the one template that failed. The next accent
 * somebody adds has the same coin flip and nothing would catch it, because the
 * colours are data rather than tokens — `lib/contrast-tokens.test.ts` scans
 * class names and cannot see a hex in `data/templates.ts`. So the pill asks for
 * a readable version of the accent instead, and every template gets it.
 */

type Rgb = { r: number; g: number; b: number }

/** `#abc`, `#aabbcc` and `#aabbccdd` — the last being the 13% wash the pill uses. */
export function parseHex(hex: string): (Rgb & { a: number }) | null {
  const h = hex.trim().replace(/^#/, '')
  const expand = (s: string) =>
    s.length === 3 || s.length === 4
      ? s
          .split('')
          .map((c) => c + c)
          .join('')
      : s
  const full = expand(h)
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(full)) return null
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
    a: full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1,
  }
}

const toHex = ({ r, g, b }: Rgb) =>
  '#' + [r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')

/** WCAG relative luminance. */
function luminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio, 1–21. Both colours must be opaque. */
export function contrastRatio(a: string, b: string): number {
  const x = parseHex(a)
  const y = parseHex(b)
  if (!x || !y) return 1
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p)
  return (hi + 0.05) / (lo + 0.05)
}

/** Flatten a translucent colour onto an opaque one, the way a browser would. */
export function composite(over: string, under: string): string {
  const f = parseHex(over)
  const b = parseHex(under)
  if (!f || !b) return under
  return toHex({
    r: f.r * f.a + b.r * (1 - f.a),
    g: f.g * f.a + b.g * (1 - f.a),
    b: f.b * f.a + b.b * (1 - f.a),
  })
}

/**
 * The nearest version of `color` that meets `min` against `background`.
 *
 * Walks the colour toward black or toward white — whichever direction the
 * background makes darker or lighter — in small steps, so the hue survives and
 * the result still reads as the template's accent. Returns the original when it
 * already passes, and the best it managed if even full black or white does not
 * (which only happens against a mid grey, where nothing would).
 */
export function readableOn(color: string, background: string, min = 4.5): string {
  const c = parseHex(color)
  const bg = parseHex(background)
  if (!c || !bg) return color
  if (contrastRatio(color, background) >= min) return color

  // Push away from the background: darken on a light ground, lighten on a dark one.
  const target = luminance(bg) > 0.18 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 }

  let best = toHex(c)
  let bestRatio = contrastRatio(best, background)
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const step = toHex({
      r: c.r + (target.r - c.r) * t,
      g: c.g + (target.g - c.g) * t,
      b: c.b + (target.b - c.b) * t,
    })
    const ratio = contrastRatio(step, background)
    if (ratio >= min) return step
    if (ratio > bestRatio) {
      best = step
      bestRatio = ratio
    }
  }
  return best
}
