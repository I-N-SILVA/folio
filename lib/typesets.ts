/**
 * Edition styles — a named type set for a whole edition.
 *
 * What was here before was a per-block override panel: font size, letter
 * spacing, colour and padding, block by block. That is a page builder. A
 * publishing tool has a house style, and every heading in the edition obeys it
 * because it is a heading, not because someone remembered to set it to 32px.
 *
 * So one choice at the edition level decides the whole type system: the pairing,
 * the scale, the weights, the tracking, whether captions are italic or small
 * caps. Per-block overrides still exist and still win — they are now genuinely
 * overrides rather than the only mechanism.
 *
 * Every family named here is loaded in `lib/fonts.ts`. That is not a
 * convention, it is the fix: the eight families this app used to name were
 * never loaded, so choosing between them changed nothing at all.
 *
 * Sizes are `clamp()` rather than breakpoints because an edition is rendered at
 * three very different widths — the reader, a two-page spread, and the phone
 * fallback inside a container query — and a viewport media query is wrong in
 * two of the three.
 */

import type { TextBlock } from './book-schema'

export type Variant = TextBlock['variant']

export interface VariantStyle {
  /** Which of the two families this variant is set in. */
  family: 'heading' | 'body'
  /** A `clamp()` or fixed length. */
  size: string
  weight: number
  lineHeight: string
  letterSpacing: string
  italic?: boolean
  uppercase?: boolean
}

export interface Typeset {
  id: string
  label: string
  /** One line an author can choose by, not a font list. */
  description: string
  /** CSS custom property from `lib/fonts.ts`, e.g. `--font-bodoni`. */
  headingVar: string
  bodyVar: string
  /** What the picker shows on the specimen card. */
  headingName: string
  bodyName: string
  variants: Record<Variant, VariantStyle>
}

export const TYPESETS: Typeset[] = [
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'High-contrast display over a geometric sans. Fashion, lookbooks, brand.',
    headingVar: '--font-bodoni',
    bodyVar: '--font-outfit',
    headingName: 'Bodoni Moda',
    bodyName: 'Outfit',
    variants: {
      title: { family: 'heading', size: 'clamp(2.25rem, 5.2vw, 4.25rem)', weight: 700, lineHeight: '1.04', letterSpacing: '-0.035em' },
      heading: { family: 'heading', size: 'clamp(1.4rem, 2.6vw, 2rem)', weight: 600, lineHeight: '1.2', letterSpacing: '-0.02em' },
      body: { family: 'body', size: 'clamp(1rem, 1.2vw, 1.125rem)', weight: 400, lineHeight: '1.65', letterSpacing: '-0.005em' },
      caption: { family: 'body', size: '0.8125rem', weight: 400, lineHeight: '1.45', letterSpacing: '0.02em', italic: true },
      quote: { family: 'heading', size: 'clamp(1.25rem, 2.3vw, 1.65rem)', weight: 400, lineHeight: '1.45', letterSpacing: '-0.01em', italic: true },
      stat: { family: 'heading', size: 'clamp(2.75rem, 6vw, 5rem)', weight: 700, lineHeight: '1', letterSpacing: '-0.05em' },
    },
  },
  {
    id: 'journal',
    label: 'Journal',
    description: 'A warm serif at reading length. Long-form features, essays, letters.',
    headingVar: '--font-fraunces',
    bodyVar: '--font-source-serif',
    headingName: 'Fraunces',
    bodyName: 'Source Serif 4',
    variants: {
      title: { family: 'heading', size: 'clamp(2rem, 4.4vw, 3.5rem)', weight: 600, lineHeight: '1.1', letterSpacing: '-0.02em' },
      heading: { family: 'heading', size: 'clamp(1.3rem, 2.3vw, 1.75rem)', weight: 600, lineHeight: '1.25', letterSpacing: '-0.01em' },
      // Longer measure wants more leading; this is the one style tuned for
      // reading a page of text rather than looking at one.
      body: { family: 'body', size: 'clamp(1.0625rem, 1.3vw, 1.1875rem)', weight: 400, lineHeight: '1.72', letterSpacing: '0' },
      caption: { family: 'body', size: '0.8125rem', weight: 400, lineHeight: '1.5', letterSpacing: '0.01em', italic: true },
      quote: { family: 'body', size: 'clamp(1.15rem, 2vw, 1.5rem)', weight: 400, lineHeight: '1.55', letterSpacing: '0', italic: true },
      stat: { family: 'heading', size: 'clamp(2.5rem, 5.2vw, 4.25rem)', weight: 600, lineHeight: '1.05', letterSpacing: '-0.03em' },
    },
  },
  {
    id: 'modern',
    label: 'Modern',
    description: 'Tight grotesque headlines, wide small caps. Studios, product, decks.',
    headingVar: '--font-grotesk',
    bodyVar: '--font-outfit',
    headingName: 'Space Grotesk',
    bodyName: 'Outfit',
    variants: {
      title: { family: 'heading', size: 'clamp(2.25rem, 5.4vw, 4.5rem)', weight: 700, lineHeight: '1.02', letterSpacing: '-0.045em' },
      heading: { family: 'heading', size: 'clamp(1.35rem, 2.5vw, 1.9rem)', weight: 700, lineHeight: '1.15', letterSpacing: '-0.03em' },
      body: { family: 'body', size: 'clamp(1rem, 1.2vw, 1.0625rem)', weight: 400, lineHeight: '1.6', letterSpacing: '-0.01em' },
      caption: { family: 'heading', size: '0.6875rem', weight: 500, lineHeight: '1.4', letterSpacing: '0.16em', uppercase: true },
      quote: { family: 'heading', size: 'clamp(1.2rem, 2.2vw, 1.6rem)', weight: 500, lineHeight: '1.35', letterSpacing: '-0.02em' },
      stat: { family: 'heading', size: 'clamp(3rem, 6.5vw, 5.5rem)', weight: 700, lineHeight: '0.95', letterSpacing: '-0.055em' },
    },
  },
  {
    id: 'classic',
    label: 'Classic',
    description: 'One serif, working by weight alone. Books, catalogues, programmes.',
    headingVar: '--font-source-serif',
    bodyVar: '--font-source-serif',
    headingName: 'Source Serif 4',
    bodyName: 'Source Serif 4',
    variants: {
      title: { family: 'heading', size: 'clamp(2rem, 4.2vw, 3.25rem)', weight: 600, lineHeight: '1.12', letterSpacing: '-0.015em' },
      heading: { family: 'heading', size: 'clamp(1.25rem, 2.2vw, 1.6rem)', weight: 600, lineHeight: '1.3', letterSpacing: '-0.005em' },
      body: { family: 'body', size: 'clamp(1rem, 1.2vw, 1.125rem)', weight: 400, lineHeight: '1.7', letterSpacing: '0' },
      caption: { family: 'body', size: '0.75rem', weight: 400, lineHeight: '1.5', letterSpacing: '0.08em', uppercase: true },
      quote: { family: 'body', size: 'clamp(1.15rem, 2vw, 1.45rem)', weight: 400, lineHeight: '1.6', letterSpacing: '0', italic: true },
      stat: { family: 'heading', size: 'clamp(2.5rem, 5vw, 4rem)', weight: 600, lineHeight: '1.05', letterSpacing: '-0.03em' },
    },
  },
  {
    id: 'technical',
    label: 'Technical',
    description: 'Plain sans, tabular figures, labelled captions. Reports and data.',
    headingVar: '--font-plex',
    bodyVar: '--font-plex',
    headingName: 'IBM Plex Sans',
    bodyName: 'IBM Plex Sans',
    variants: {
      title: { family: 'heading', size: 'clamp(1.9rem, 4vw, 3rem)', weight: 600, lineHeight: '1.1', letterSpacing: '-0.02em' },
      heading: { family: 'heading', size: 'clamp(1.2rem, 2.1vw, 1.55rem)', weight: 600, lineHeight: '1.3', letterSpacing: '-0.01em' },
      body: { family: 'body', size: 'clamp(0.9375rem, 1.15vw, 1rem)', weight: 400, lineHeight: '1.62', letterSpacing: '0' },
      caption: { family: 'body', size: '0.6875rem', weight: 600, lineHeight: '1.4', letterSpacing: '0.12em', uppercase: true },
      quote: { family: 'body', size: 'clamp(1.05rem, 1.9vw, 1.35rem)', weight: 400, lineHeight: '1.55', letterSpacing: '0' },
      stat: { family: 'heading', size: 'clamp(2.5rem, 5.4vw, 4.25rem)', weight: 600, lineHeight: '1', letterSpacing: '-0.04em' },
    },
  },
]

export const TYPESET_IDS = TYPESETS.map((t) => t.id) as [string, ...string[]]

export const DEFAULT_TYPESET = TYPESETS[0]

export function getTypeset(id: string | undefined | null): Typeset {
  return TYPESETS.find((t) => t.id === id) ?? DEFAULT_TYPESET
}

/**
 * The families the app used to offer but never loaded, mapped to the nearest
 * one it does.
 *
 * Existing editions have `headingFont: "Playfair Display"` stored on them. That
 * has always rendered as the browser's default sans-serif, so honouring it
 * literally would keep the bug alive in every edition already published. Each
 * of these is mapped to the closest loaded face, which is a change in what the
 * reader sees — and in every case a change from "not the font you chose" to
 * "close to the font you chose".
 */
const LEGACY_FAMILIES: Record<string, string> = {
  'playfair display': '--font-bodoni',
  'cormorant garamond': '--font-fraunces',
  cinzel: '--font-bodoni',
  lora: '--font-source-serif',
  'dm serif display': '--font-bodoni',
  'source serif 4': '--font-source-serif',
  syne: '--font-grotesk',
  sora: '--font-grotesk',
  'space grotesk': '--font-grotesk',
  'ibm plex sans': '--font-plex',
  'dm sans': '--font-outfit',
  'plus jakarta sans': '--font-outfit',
  inter: '--font-outfit',
  outfit: '--font-outfit',
  'bodoni moda': '--font-bodoni',
  fraunces: '--font-fraunces',
}

/**
 * A `font-family` value for an author's stored font choice.
 *
 * Returns null when there is no usable override, so the caller falls back to the
 * typeset. Two shapes have to be handled, because the app has stored both:
 *
 *   - a bare family name (`"Playfair Display"`), from the pairing buttons
 *   - a whole stack (`"Georgia, serif"`), from the font dropdowns
 *
 * The second is why the dropdowns never worked either: the renderer wrapped
 * whatever it was given in quotes, so a stack became the single, nonexistent
 * family `"Georgia, serif"` and every choice fell through to `sans-serif`.
 */
export function resolveFontFamily(stored: string | undefined): string | null {
  const value = stored?.trim()
  if (!value) return null

  const mapped = LEGACY_FAMILIES[value.toLowerCase()]
  if (mapped) return `var(${mapped})`

  // Already a stack — pass it through untouched. Quoting it is what broke it.
  if (value.includes(',')) return value

  // An unknown single family: quote it, and give it a real fallback rather than
  // dropping to the browser default.
  return `"${value}", var(--font-outfit), system-ui, sans-serif`
}

/**
 * The generic to end a stack with, per family.
 *
 * `next/font` already appends a metric-matched local fallback, so this is only
 * reached if that fails too — but ending a Plex Sans stack in `serif` is still
 * wrong, and one shared fallback for both roles is how that happens.
 */
const GENERIC: Record<string, string> = {
  '--font-bodoni': 'Georgia, "Times New Roman", serif',
  '--font-fraunces': 'Georgia, "Times New Roman", serif',
  '--font-source-serif': 'Georgia, "Times New Roman", serif',
  '--font-outfit': 'system-ui, sans-serif',
  '--font-grotesk': 'system-ui, sans-serif',
  '--font-plex': 'system-ui, sans-serif',
}

/** The CSS custom properties one typeset contributes to a page. */
export function typesetCssVars(
  typeset: Typeset,
  overrides: { headingFont?: string; bodyFont?: string } = {}
): Record<string, string> {
  const headingOverride = resolveFontFamily(overrides.headingFont)
  const bodyOverride = resolveFontFamily(overrides.bodyFont)
  const heading = headingOverride ?? `var(${typeset.headingVar})`
  const body = bodyOverride ?? `var(${typeset.bodyVar})`

  const vars: Record<string, string> = {
    // Kept under their old names: other blocks (Data, Button) already read
    // these, and a rename would silently unstyle them.
    '--heading-font': `${heading}, ${GENERIC[typeset.headingVar] ?? 'system-ui, sans-serif'}`,
    '--body-font': `${body}, ${GENERIC[typeset.bodyVar] ?? 'system-ui, sans-serif'}`,
  }

  for (const [variant, style] of Object.entries(typeset.variants)) {
    const family = style.family === 'heading' ? '--heading-font' : '--body-font'
    vars[`--t-${variant}-family`] = `var(${family})`
    vars[`--t-${variant}-size`] = style.size
    vars[`--t-${variant}-weight`] = String(style.weight)
    vars[`--t-${variant}-lh`] = style.lineHeight
    vars[`--t-${variant}-ls`] = style.letterSpacing
    vars[`--t-${variant}-style`] = style.italic ? 'italic' : 'normal'
    vars[`--t-${variant}-transform`] = style.uppercase ? 'uppercase' : 'none'
  }

  return vars
}
