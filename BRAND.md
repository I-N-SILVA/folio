# Folio — Brand Guidelines

The brand should feel like a beautifully made object: editorial, warm, and
considered. Print sensibility meets modern software. Never loud, never generic.

---

## 1. Essence

- **One-liner:** Digital publishing with soul.
- **Promise:** Make every page feel collected.
- **Personality:** Editorial · tactile · premium · calm · confident.
- **We are:** a craftsperson's tool. **We are not:** a flashy SaaS gimmick.

## 2. Logo

- **Wordmark:** "Folio" set in the display serif, tight tracking (`-0.04em`).
- **Monogram:** a single **F** in the display serif on the ink gradient,
  rounded-square or circle lockup. Generated at `/icon` and `/apple-icon`.
- **Clear space:** keep at least the height of the "F" around the mark.
- **Don'ts:** don't recolor the mark arbitrarily, stretch it, add drop shadows
  beyond the defined elevation, or place it on busy photography without a scrim.

## 3. Color

Source of truth: `app/globals.css` (`:root` custom properties).

| Token | Hex | Use |
| ----- | --- | --- |
| `--background` | `#f6efe2` | Page background (warm paper) |
| `--folio-ink` | `#1b1712` | Primary text, dark surfaces, monogram |
| `--folio-muted` | `#6f675d` | Secondary text |
| `--folio-paper` | `#fbf7ee` | Cards / raised surfaces |
| `--folio-vellum` | `#f2e6d2` | Subtle fills |
| `--folio-brass` | `#b98235` | Accent / eyebrow labels |
| `--folio-teal` | `#0d6661` | Primary action / CTAs |
| `--folio-oxblood` | `#6f302d` | Rare editorial accent |
| Gold highlight | `#d6aa66` | On-dark accent (badges, on ink) |

Rules: **teal** is the primary action color; **brass/gold** is for accents and
eyebrows only; keep large fields on the warm paper background. Aim for AA
contrast on text.

## 4. Typography

- **Display (headings):** `--font-display` — "Iowan Old Style", Palatino,
  Georgia serif. Tight tracking, large sizes, `font-semibold`.
- **Body / UI:** `--font-body` — "Avenir Next", Helvetica Neue, system sans.
- **Eyebrows / labels:** uppercase, `tracking-[0.18em–0.24em]`, `font-extrabold`,
  small, often in brass or teal.

## 5. Surfaces & motion

- **Radii:** generous — cards `~2rem`, pills/buttons fully rounded.
- **Elevation:** soft, warm shadows (e.g. `0 24px 70px rgba(32,25,16,0.16)`).
- **Texture:** the subtle `folio-grain` overlay on hero / feature surfaces.
- **Motion:** restrained — `folio-rise` on load, `Reveal` on scroll, gentle
  `-translate-y` on hover. Always honor `prefers-reduced-motion`.

## 6. Voice & tone

- Confident and warm; short, editorial sentences.
- Concrete nouns over hype. "Tactile page turns," not "next-gen experiences."
- Speak to craft and outcomes (readers finishing what you publish).
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
