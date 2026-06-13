# Riffle — Brand Guidelines

Riffle should feel like Apple-grade software: clean, confident, and effortless.
Lots of whitespace, near-black on white, one decisive accent. Sleek, never loud.

---

## 1. Essence

- **Name:** Riffle — to flip quickly through the pages of a book.
- **One-liner:** Flip through anything.
- **Promise:** Turn static PDFs into interactive editions people actually finish.
- **Personality:** Minimal · precise · modern · calm · confident.
- **We are:** sleek and product-led. **We are not:** ornamental or busy.

## 2. Logo

- **Wordmark:** "Riffle" in the display sans, tight tracking (`-0.02em`).
- **Monogram:** a single **R** in white on a near-black (`#1d1d1f`) rounded
  square. Generated at `/icon` and `/apple-icon`.
- **Clear space:** keep at least the height of the "R" around the mark.
- **Don'ts:** don't recolor the mark, add gradients or shadows, stretch it, or
  place it on busy imagery without a solid scrim.

## 3. Color

Monochrome base + a single accent. Source of truth: `app/globals.css` (`:root`).

| Token | Hex | Use |
| ----- | --- | --- |
| White | `#ffffff` | Primary background |
| Off-white | `#fbfbfd` | Alternating section background |
| Ink (`--folio-ink`) | `#1d1d1f` | Text, dark sections, monogram |
| Gray (`--folio-muted`) | `#6e6e73` | Secondary text |
| Subtle | `#f5f5f7` | Fills, chips, secondary buttons |
| Hairline (`--folio-border`) | `#d2d2d7` | Borders / separators |
| **Accent** (`--accent`) | `#0066ff` | Primary actions + links **only** |
| Accent hover | `#0a5be0` | Hover state for accent |

Rule: the accent is reserved for primary CTAs and links. Everything else is
monochrome. Maintain AA contrast on text.

## 4. Typography

- **One typeface, system sans** (SF Pro on Apple devices): `--font-display` /
  `--font-body` both use the `-apple-system, BlinkMacSystemFont, "SF Pro…"`
  stack. Headings are the same family, heavier weight + tighter tracking.
- **Headlines:** large, `font-semibold`, tracking `-0.03em` to `-0.04em`.
- **Body:** 15–20px, `leading-7/8`, gray for secondary copy.
- No serifs, no decorative fonts, no all-caps except small eyebrow labels.

## 5. Surfaces & motion

- **Radii:** soft and generous — cards `1.5–2rem`, buttons fully rounded.
- **Elevation:** subtle, neutral shadows (e.g. `0 40px 120px rgba(0,0,0,0.12)`)
  on the product shot; most surfaces use a hairline border instead.
- **No texture/grain** — the aesthetic is clean and flat.
- **Motion:** restrained — `Reveal` fade-up on scroll, gentle hover states.
  Always honor `prefers-reduced-motion`.

## 6. Voice & tone

- Confident and plain. Short sentences. Concrete nouns.
- Outcome-led ("readers actually finish it"), never hypey.
- Avoid exclamation marks, jargon, and growth-hacker clichés.

## 7. Asset routes (live in the app)

| Asset | Route |
| ----- | ----- |
| App icon (512²) | `/icon` |
| Apple touch icon (180²) | `/apple-icon` |
| Social share image (1200×630) | `/opengraph-image` |
| iOS launch images | `/apple-splash?w=…&h=…` |
| Web app manifest | `/manifest.webmanifest` |
| Brand / press page | `/press` |
