# QLICO — Brand Guidelines

QLICO should feel like Apple-grade software: clean, confident, and effortless.
Lots of whitespace, near-black on white, one decisive accent. Sleek, never loud.

---

## 1. Essence

- **Name:** QLICO — to flip quickly through the pages of a book.
- **One-liner:** Flip through anything.
- **Promise:** Turn static PDFs into interactive editions people actually finish.
- **Personality:** Minimal · precise · modern · calm · confident.
- **We are:** sleek and product-led. **We are not:** ornamental or busy.

## 2. Logo

- **Lockup:** the violet cursor-page mark + lowercase "qlico" wordmark in
  ink navy, with a play triangle inside the final "o".
  Files: `public/brand/qlico-logo.png` (on light) and
  `public/brand/qlico-logo-white.png` (on dark).
- **Mark:** the violet mark alone (`public/brand/qlico-mark.png`). Use it
  when space is tight (favicons, avatars, app icons).
- **App icon:** white mark on QLICO Violet (`public/brand/icon-512.png`,
  `icon-192.png`, `apple-icon-180.png`; also `app/icon.png` /
  `app/apple-icon.png` for the favicon + touch icon).
- **Clear space:** keep at least the height of the mark's circular counter
  around the lockup.
- **Don'ts:** don't recolor the lockup (white-on-dark and icon-white are the
  only sanctioned variants), add gradients or shadows, stretch it, or place it
  on busy imagery without a solid scrim.

## 3. Color

The palette is drawn from the logo itself: ink navy for text, one violet
accent. Source of truth: `app/globals.css` (`:root`).

| Token | Hex | Use |
| ----- | --- | --- |
| White | `#ffffff` | Primary background |
| Off-white | `#fcfcfd` | Page background |
| Ink (`--qlico-ink`) | `#141a3a` | Text, dark sections (the wordmark navy) |
| Gray (`--qlico-muted`) | `#575d78` | Secondary text |
| Subtle | `#f4f4f7` | Fills, chips, secondary buttons |
| Hairline (`--qlico-border`) | `#e3e4ea` | Borders / separators |
| **QLICO Violet** (`--accent`) | `#3c2384` | Primary actions + links **only** (the mark's color) |
| Accent hover | `#2e1a66` | Hover state for accent |

Rule: the accent is reserved for primary CTAs and links. Everything else is
ink-on-white. Maintain AA contrast on text.

## 4. Typography

Two faces, loaded via `next/font` (see `app/layout.tsx`):

- **Display — Fraunces** (`--font-display`): an editorial variable serif for
  headlines, big numbers, and the price. Tracking `-0.02em`, tuned via
  `font-variation-settings` to high optical size (`opsz 144`), soft terminals
  (`SOFT 40`), and wonky alternates (`WONK 1`) — this tuning is what makes the
  voice ownable. Use it for impact, not body copy.
- **UI / body — DM Sans** (`--font-body`): a clean geometric grotesk for nav,
  cards, buttons, and paragraphs. 15–20px, `leading-7/8`, gray for secondary
  copy.
- Use `.font-display` (or `font-display`) to opt a heading into Fraunces.
  Everything else inherits DM Sans.
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
| Logo lockup (transparent PNG) | `/brand/qlico-logo.png` (white: `/brand/qlico-logo-white.png`) |
| Mark only (transparent PNG) | `/brand/qlico-mark.png` |
| App icon (512² / 192²) | `/brand/icon-512.png`, `/brand/icon-192.png` |
| Apple touch icon (180²) | `/brand/apple-icon-180.png` |
| Social share image (1200×630) | `/opengraph-image` |
| iOS launch images | `/apple-splash?w=…&h=…` |
| Web app manifest | `/manifest.webmanifest` |
| Brand / press page | `/press` |

## 8. Signature & differentiators

What makes QLICO ownable — lean on these, not generic "flipbook" language:

- **Editions, not exports.** The category word. Frame publications as living
  editions (Vol. 01, issue framing, spine motif), never "flipbooks."
- **The riffle.** The fore-edge — the book's stacked page edges — is the
  navigation: hover fans the pages, click/drag flies anywhere. It's the
  signature interaction behind the name: the click that flips.
- **Living editions.** `data` blocks bind to a JSON source and update after
  publish — prices, stock, dates. (`components/blocks/DataBlock.tsx`,
  `DataBlockSchema`.)
- **Shoppable hotspots.** A hotspot can carry a price + checkout, turning any
  page into a storefront. (`action: 'checkout'`, `price`, `ctaLabel`.)
- **Reader moments.** Cover-reveal on open; ambient chrome tinted from the
  cover color.
