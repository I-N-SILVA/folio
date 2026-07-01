# KLICKO — Brand Guidelines

KLICKO should feel like Apple-grade software: clean, confident, and effortless.
Lots of whitespace, near-black on white, one decisive accent. Sleek, never loud.

---

## 1. Essence

- **Name:** KLICKO — to flip quickly through the pages of a book.
- **One-liner:** Flip through anything.
- **Promise:** Turn static PDFs into interactive editions people actually finish.
- **Personality:** Minimal · precise · modern · calm · confident.
- **We are:** sleek and product-led. **We are not:** ornamental or busy.

## 2. Logo

- **Wordmark:** "KLICKO" in the display sans, tight tracking (`-0.02em`).
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

Two faces, loaded via `next/font` (see `app/layout.tsx`):

- **Display — Fraunces** (`--font-display`): an editorial variable serif for
  headlines, big numbers, and the price. Tracking `-0.02em`. This is the
  ownable, premium voice — use it for impact, not body copy.
- **UI / body — Geist** (`--font-body`): a clean modern grotesk for nav, cards,
  buttons, and paragraphs. 15–20px, `leading-7/8`, gray for secondary copy.
- Use `.font-display` (or `font-display`) to opt a heading into Fraunces.
  Everything else inherits Geist.
- All-caps only for small eyebrow/label text with wide tracking.

## 5. Surfaces & motion

- **Radii:** soft and generous — cards `1.5–2rem`, buttons fully rounded.
- **Elevation:** subtle, neutral shadows; most surfaces use a hairline border.
- **No texture/grain** — the aesthetic is clean and flat.
- **Motion (framer-motion):** restrained and intentional. Building blocks:
  - `Reveal` — spring fade-up on scroll (`whileInView`, once).
  - Hero — word-by-word blur-up headline + magnetic primary CTA.
  - Product shot — straightens from a slight tilt on scroll, with a single
    accent **BorderBeam** tracing the frame.
  - Accents — `NumberTicker` count-ups, animated bento visuals, a traveling
    flow line in “how it works”.
  - One signature move per surface — never stack effects. Always honor
    `prefers-reduced-motion` (every primitive already does).

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

## 8. Signature & differentiators

What makes KLICKO ownable — lean on these, not generic "flipbook" language:

- **Editions, not exports.** The category word. Frame publications as living
  editions (Vol. 01, issue framing, spine motif), never "flipbooks."
- **The riffle.** The fore-edge — the book's stacked page edges — is the
  navigation: hover fans the pages, click/drag flies anywhere. The logo mark
  riffles its pages on hover. The name is the interaction.
- **Living editions.** `data` blocks bind to a JSON source and update after
  publish — prices, stock, dates. (`components/blocks/DataBlock.tsx`,
  `DataBlockSchema`.)
- **Shoppable hotspots.** A hotspot can carry a price + checkout, turning any
  page into a storefront. (`action: 'checkout'`, `price`, `ctaLabel`.)
- **Reader moments.** Cover-reveal on open; ambient chrome tinted from the
  cover color.
