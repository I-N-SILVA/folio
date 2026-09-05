import { Outfit, Bodoni_Moda, Fraunces, Space_Grotesk, Source_Serif_4, IBM_Plex_Sans } from 'next/font/google'

/**
 * Every face the product can actually render.
 *
 * This file exists because the theme presets and the studio's four "Curated
 * Editorial Font Pairings" named eight Google families — Playfair Display,
 * Sora, Lora, Cormorant Garamond, Syne, Cinzel and the rest — and **not one of
 * them was ever loaded.** `font-family: "Playfair Display", sans-serif` on a
 * machine without Playfair Display installed is `sans-serif`, so all four
 * pairing buttons produced identical output, and picking a theme preset changed
 * the colours and nothing else.
 *
 * So the rule this file enforces is: a font an author can choose is a font the
 * reader is served. Nothing names a family that is not in this list.
 *
 * `preload` is on only for the two the marketing pages and the studio chrome
 * use on first paint. The other four are for the edition an author opens, which
 * is a navigation away; preloading all six would spend the first-paint budget
 * on faces most visitors never see.
 */

export const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

export const bodoni = Bodoni_Moda({
  subsets: ['latin'],
  variable: '--font-bodoni',
  display: 'swap',
  style: ['normal', 'italic'],
})

export const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  style: ['normal', 'italic'],
  preload: false,
})

export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-grotesk',
  display: 'swap',
  preload: false,
})

export const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  display: 'swap',
  style: ['normal', 'italic'],
  preload: false,
})

// Not a variable font, so the weights have to be named. Two is enough for a
// report: text and its headings.
export const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-plex',
  display: 'swap',
  weight: ['400', '600'],
  preload: false,
})

/** Every family's `.variable` class, for the root element. */
export const fontVariables = [outfit, bodoni, fraunces, spaceGrotesk, sourceSerif, plexSans]
  .map((f) => f.variable)
  .join(' ')
