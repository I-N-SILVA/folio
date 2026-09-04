# QLICO — Editor & flow redesign spec

> **Status, 4 September 2026.** Most of this is now built and on
> `claude/product-analysis-ux-m6irp4`. Each section below is marked
> **[SHIPPED]**, **[PARTIAL]** or **[NOT STARTED]**. What remains is listed in
> §9 at the bottom.

Follow-on to `docs/product-proof-2026-09.md`. That document marks what is wrong;
this one says what to build. Written to be picked up and implemented without
re-deriving the reasoning.

A working prototype of §2, §3 and §5 exists as an interactive page — one insert
surface, the canvas layout mode, the contextual inspector, the reader preview
and the post-import moment, all clickable. Ask whoever committed this for the
link if it isn't to hand.

---

## §1 — Fix the tokens first — **[SHIPPED]**

*Six* controls were invisible, not three: the two reader-facing ones below were found after this was written. `--studio-*` and `--studio-select` are in `app/globals.css`; all 48 `--accent-vivid` usages in studio code moved to `--studio-select`, and the two reader ones took explicit colours. The remaining work is cosmetic: the editor still hardcodes `neutral-*` rather than reading `--studio-*` for its surfaces — see §9.

`app/globals.css` sets `--accent`, `--accent-vivid`, `--qlico-teal` and
`--qlico-oxblood` to `#000000` in light and **`#ffffff` in dark**. The names
describe a palette that no longer exists — nothing is teal, nothing is vivid,
nothing is oxblood. The editor then uses `--accent-vivid` for interface state
while drawing author content on a white page, and three things become invisible:

| Where | Code | What happens |
|---|---|---|
| Block selection ring | `EditorCanvas.tsx:100` — `ring-2 ring-[var(--accent-vivid)]` | Dark theme → **white ring on a white page**. Selecting a block shows nothing. |
| Same, while dragging | `EditorCanvas.tsx:101` | Dark theme → no drag indicator at all. |
| Block-type label | `EditorCanvas.tsx:187` — `text-[var(--accent-vivid)]` inside a `bg-neutral-900` bar | Light theme → **black text on near-black**. |
| Insert-after button hover | `EditorCanvas.tsx:205` — `hover:bg-[var(--accent-vivid)] hover:text-white` | Dark theme → white on white. |

This is precisely the failure mode `HANDOVER.md` §5 documents ("verify colour
changes with a computed style or a screenshot") — it just happened again, and no
test or typecheck can catch it.

**The fix is a structural one, not four patches.** Two rules:

1. **The editor gets its own token set.** `globals.css` already records the
   decision that editor chrome is dark in both themes; it just never gave that
   decision tokens, which is why the editor hardcodes `neutral-*` and the brand
   tokens leak in. Define a `--studio-*` scale (ground, panel, raised, line,
   ink, ink-soft, ink-faint) and move the editor onto it. The editor then reads
   as QLICO in dark rather than as a different application, and it stops
   inheriting a palette meant for author-facing surfaces.
2. **Interaction colour is not brand colour.** Add one functional colour —
   `--studio-select`, a blue around `#5590FF` — used for selection, drag
   targets, insert affordances and focus rings, and used nowhere in author
   content. A monochrome brand accent *cannot* mark a selection on a white page;
   that is not a bug to fix, it is a job the brand accent can never do.

Then rename or delete the lying tokens. `--qlico-teal` resolving to black is a
trap for every future call site.

---

## §2 — One insert surface — **[SHIPPED]**

`components/studio/InsertPanel.tsx`. `BLOCK_LIBRARY`, the three canvas scaffolds and the sidebar's Blocks and Layouts tabs are deleted. Media blocks start empty (`draftableUrl` in the schema, `EmptyBlock` in the renderer), with `lib/publish-checks.ts` catching them at publish.

Today there are six ways to add content (`product-proof` §2.2), four of which
insert blocks, two of which insert the same block with different defaults.
Replace all of it with one panel reachable two ways.

### Entry points

- **`/` in any text block**, or with nothing focused — opens the panel with the
  search field focused. Inserting from `/` inside a text block replaces the
  slash.
- **`+` between blocks** — appears on hover in the gap, inserts at that index.
  The affordance already exists in the code (`onInsertAfter` in `SortableBlock`)
  but is only reachable from the selection toolbar.
- Keep `⌘K` as an alias so nobody has to relearn it.

### The panel

Two tabs, one search field that filters both:

- **Blocks** — a flat, grouped list: Text (heading, body, quote, caption,
  divider), Media (image, video, audio), Interactive (**live data**, button,
  embed, product grid). Arrow keys move a cursor, `↵` inserts, `esc` closes.
- **Layouts** — the six `PAGE_TEMPLATES` as visual cards.

### Three behaviour changes that come with it

1. **Add the missing `data` entry to `BLOCK_TYPES`.** `BLOCK_GROUPS` already
   lists `'data'` (`EditorCanvas.tsx:322`) but there is no `BlockChoice` for it,
   so `if (!choice) return null` silently drops the block the README leads with.
2. **Layouts insert a new page, not overwrite the current one.** Today applying
   a layout calls `setPageBlocks` and then apologises in a toast. Default to
   inserting after the current page; offer "replace this page" as a secondary
   action on the card.
3. **Delete the competing surfaces:** `BLOCK_LIBRARY` in `PageListSidebar.tsx`,
   the three `handleScaffold*` functions in `EditorCanvas.tsx`, and the sidebar's
   "Blocks" tab. The Asset Library stays, but as an image *picker* invoked from
   an image block — not a top-level toolbar button.

### While you're in there: empty blocks, not junk blocks

- `EditorCanvas.tsx:247` and `PageListSidebar.tsx:57` — Video defaults to
  `w3schools.com/html/mov_bbb.mp4`.
- `EditorCanvas.tsx:256` — Audio defaults to a w3schools horse sample.
- `EditorCanvas.tsx:280-311` — Product Grid defaults to a $480 silk trench with
  a working Add to Bag button.

All three publish if unnoticed, which on a 40-page import they will be. A new
media block should hold nothing and render a dashed frame reading "Choose a
video" — better product *and* less code than curating fake content. Make
defaults neutral generally and let templates carry the verticals.

---

## §3 — Decide what the canvas is — **[SHIPPED]**

The canvas, scoped, as recommended. One change from the plan below: frames are seeded by **measuring the live flow layout**, not from the block index — an index guess overlaps blocks of different heights, and a page that rearranges itself on switch is a page nobody switches twice. The phone fallback is a CSS *container* query so the reader, embed, thumbnails and the editor's mobile simulator all obey one rule.

The canvas draws an A4 page with a paper shadow, zoom steps, alignment guides, a
device bezel and a live `X: 42.1% · Y: 63.8%` readout. Blocks render into a flex
column with no `x`, `y` or size (`PageRenderer.tsx:158-163`,
`book-schema.ts:6-18`). Every signal promises free composition; the model
delivers a list. That mismatch is the main reason the editor feels hard.

**Recommendation: add a third layout mode rather than converting the product.**

```ts
// lib/book-schema.ts
layout: z.enum(['hero', 'split', 'text', 'grid', 'blank', 'canvas'])

// on every block schema, optional — absent means "flow"
frame: z.object({
  x: z.number().min(0).max(100),      // % of page width
  y: z.number().min(0).max(100),      // % of page height
  w: z.number().min(5).max(100),
  z: z.number().int().default(0),
}).optional()
```

Rules that make this safe:

- **`frame` is only honoured when `page.layout === 'canvas'`.** Every existing
  page keeps flowing; no migration, no risk to published editions.
- **Switching a page to canvas seeds frames from current order** — `x: 8`,
  `y: 8 + i * 15`, `w: 84` — so the page never scatters when you switch, and
  switching back is lossless because `frame` is preserved, not destroyed.
- **Phones stack.** `usePortrait` is already true on mobile in the reader; under
  that breakpoint a canvas page renders as flow ordered by `z`, then `y`, then
  `x`. Write that rule in `PageRenderer` once so the editor, the thumbnails, the
  embed and the reader all agree.
- **Snapping** to the page margin, the centre line and the edges of sibling
  blocks, at a 2% tolerance. The guides are already drawn
  (`EditorCanvas.tsx:832-843`); they just don't attract anything.
- **Arrow keys nudge** 1%, `shift` 10% — the keyboard path that hotspots
  already have and blocks don't.

If you would rather not take this on, the honest alternative is to **stop
drawing a canvas**: a block column with a live page preview beside it, Ghost- or
Notion-style. That ships in a week and keeps output consistent everywhere. What
is not defensible is today's state, which promises one and delivers the other.

---

## §4 — Edit the spread, not the page — **[SHIPPED]**

A Page | Spread switch; the pairing lives in `lib/page-geometry` as `pageSideFor` / `spreadFor` and the reader now calls it too, so the two cannot drift. The facing page is read-only and one click makes it live.

`ViewerEngine.tsx:280` passes `usePortrait={isMobile}`, so **on desktop the
reader shows two facing pages** with `pageSide: 'left' | 'right'`
(`ViewerEngine.tsx:296`). The editor shows one page, always.

So an author composing page 12 never sees page 13, never sees the gutter, and
cannot design an image that crosses it — which is the most basic thing anyone
laying out a publication does. Every one of the six templates in
`data/templates.ts` is called a "spread" in its own copy, and none of them can
be edited as one.

**Build a spread view.** A toggle in the canvas bar — `Page | Spread` — that
renders the current page and its facing page side by side at
`PAGE_DESIGN_WIDTH` each, with the gutter drawn and both pages live-editable.
Reuse `pageSide` so the shadow and fore-edge match the reader. Default to spread
on screens wide enough for it, since that is what the reader shows.

This is the single largest "feels like a real editorial tool" change available,
and it needs no schema change.

---

## §5 — The post-import moment — **[SHIPPED]**

`components/studio/PostImportModal.tsx`, reached via `?imported=1`. `POST /api/ai/detect-hotspots` takes `pages` as well as `page`. `addHotspotsBatch` makes accepting one undo step, which is what lets the modal honestly offer "add all".

`ImportPDFModal.tsx:281` pushes straight to `/editor/:id`, where the author is
looking at pictures of their PDF with nothing changed and no next step. The
action that makes it not-a-PDF is a toolbar toggle among nine others, and the
better action — *Auto-detect pins* (`EditorCanvas.tsx:795`) — is styled as the
lesser of two buttons and runs on the current page only.

**Build one screen that fires after an import lands:**

1. **"Reading your 24 pages…"** with a determinate progress bar. Run the
   existing Gemini detector across *every* page, not the current one — this
   needs `POST /api/ai/detect-hotspots` to accept a page array, or a job that
   walks pages server-side. Rate-limit per plan.
2. **"Here is what QLICO found"** — grouped counts, not a raw list:
   *12 products with prices · 6 links in your copy · 3 charts.* Say what each
   becomes: a pin a reader can tap, a button that reports its clicks, a
   candidate for live data.
3. **Three actions:** *Add all 21 as interactive* (primary), *Review them one by
   one*, *Not now*. Nothing is written until the author chooses.
4. **One undo step for the whole batch.** The editor store's `past` stack
   already supports this if the batch is pushed as a single entry — do that, or
   the promise in step 3 isn't true.

Fire `edition_enriched` once here with the count. This is the activation event
the funnel is actually waiting on; right now nothing measures whether an
imported edition ever became interactive at all.

---

## §6 — What makes the editor feel rich rather than busy — **[PARTIAL]**

Everything under *Cheap, and people notice immediately* is shipped, except copy/paste and multi-select. Of the sprint-sized items only the publish checklist is built. The bigger bets are untouched — see §9.

Ordered by ratio of felt quality to effort. None of these are new surfaces —
several *remove* one.

### Cheap, and people notice immediately

- **Drag a hotspot.** It is an absolutely-positioned div; today it can only be
  placed by arming a mode and clicking, then nudged with arrow keys, and the
  inspector shows X/Y read-only. Make the marker draggable.
- **Single-click selects, second click edits.** `TextBlock.tsx:226` requires a
  double-click and advertises it only through a `title` attribute. Use the
  convention everyone already knows, and show an "Edit text" affordance on the
  selection bar for the people who don't.
- **Insert a page where you are.** `addPage` only appends
  (`PageListSidebar.tsx:571`); adding a page after page 3 of 20 means appending
  and dragging it back seventeen places. Add "Insert page after" to the page
  hover menu.
- **Copy and paste blocks, including between pages.** `⌘C`/`⌘V` on a selected
  block. There is no way to reuse a block you have already styled.
- **Multi-select** with shift-click, then align / distribute / delete together.
  In canvas mode this is what turns positioning from fiddly into fast.
- **Kill the duplicate save UI.** Save state appears three times — the header
  pill, its `SavedAgo` timestamp, and a status bar reading "ALL CHANGES SAVED"
  (`EditorClient.tsx:551-559`). Keep the pill. The bar also spends 32px of
  canvas restating shortcuts the `?` modal lists.
- **Wire or remove the two dead palette commands** — `onToggleGuides` and
  `onAutoDetectPins` are both `() => {}` (`EditorClient.tsx:578-579`).

### Worth a sprint each

- **Edition styles.** Today every block carries its own `textColor`,
  `fontSize`, `padding`, `letterSpacing`. That is a set of one-off overrides,
  not a design system, and it is why author-made editions drift while the
  templates look composed. Give each edition a small named style set — Title,
  Heading, Body, Caption, Quote, Stat — editable in one place and applied by
  name. Per-block overrides stay, but as exceptions with a "reset to style"
  action. This is the difference between a page builder and a publishing tool.
- **Image crop and focal point.** An image block has `width`, `aspectRatio` and
  `borderRadius` but no way to choose which part of the photo survives the crop.
  A draggable focal point stored as `{x, y}` and applied as
  `object-position` is a day's work and removes the most common reason a page
  looks wrong.
- **Save as template.** Six templates ship; an author can make none. "Save this
  edition as a template" and "save this page as a layout" turn a studio's second
  client project into a ten-minute job — the strongest retention mechanic
  available to this product, and the templates infrastructure already exists.
- **A publish checklist, not a publish button.** Before the flag flips: images
  without alt text, blocks still holding placeholder content, a lead gate set
  past the last page, an empty page, a button with `href: 'https://example.com'`.
  Show it as a short list with jump links. This is where the alt-text
  requirement belongs — a blocker at publish, not a nag while writing.
- **Version history.** Autosave every two seconds with a two-entry undo stack
  and no named versions means "I preferred it yesterday" has no answer. Snapshot
  on publish at minimum; ideally hourly, kept for the plan's retention window
  (the entitlement already exists as `analyticsDays` — mirror it).

### Bigger bets, in order of strategic value

- **Live data that is actually live.** The `data` block is the thing no PDF can
  do and the only feature that moves QLICO from "prettier PDFs" — where Issuu
  and Flipsnack compete on price — to "documents that report back", where they
  cannot follow. Make it real: a source (Google Sheet, CSV URL, or a webhook
  push), a refresh interval, a last-synced stamp visible to the reader, and a
  cached last-good value so a dead source degrades to a number rather than an
  error. Then sell it. See §5 of `product-proof` for the investor-letter case.
- **Author-configurable reader chrome.** `ViewerChrome` shows fourteen controls
  to someone who clicked a link to look at a lookbook. Default to four —
  contents, search, share, fullscreen — with the rest behind *More*, and let the
  author switch features on per edition. Narration and translation stop being
  clutter and start being choices, which is also how you learn whether anyone
  wants them.
- **Comments for the author's own reviewers.** `ReviewDrawer` collects reader
  feedback on a published edition. What a studio needs first is a colleague or
  client marking up a *draft* — a comment pinned to a block, resolvable, with an
  invite link that doesn't require a QLICO account. This is the feature that
  makes an edition a team's working document rather than one person's file.

---

## §7 — The flow, end to end — **[PARTIAL]**

Shipped: the headline, the post-import moment, the publish checklist, `/gallery`. Not done: sending the weekly digest by hand, which needs a deployed environment and `CRON_SECRET`.

Where each stage leaks and the smallest change that closes it.

| Stage | The leak | The change |
|---|---|---|
| Land | Hero claims "Publishing, Perfected" and "Unmatched elegance" (`Hero.tsx:346,356`) — unfalsifiable, and every competitor says it | Restore the measurement claim recorded in `HANDOVER.md`: *"Send a PDF. See who actually read it."* |
| Try | The drop-a-PDF-and-flip-it path exists and works | Keep. Put a real edition beside it — see `/gallery` below |
| Create | Three doors; two of the three lead somewhere good | Keep the three; fix where Import lands (§5) |
| Activate | Import ends on a bare canvas; nothing measures whether an edition became interactive | The post-import moment (§5), plus `edition_enriched` with a count |
| Compose | Six insert surfaces, a canvas that lies, single-page editing against a two-page reader | §2, §3, §4 |
| Publish | Good — forces a save, then hands over the link | Add the checklist (§6) |
| Share | Good — share modal, QR, social teaser | Keep |
| Return | Insights is a nav item; the weekly digest exists | **Send the digest once by hand and read the email.** Per `HANDOVER.md` §3 it has never run |
| Prove | Six finished templates reachable from one door of one modal, invisible on the landing page | Build `/gallery`: all six published as real readable editions with *Start from this* |

`/gallery` is the cheapest item on this list and probably the highest-converting.
The editions already exist in `data/templates.ts`. They need a route, a card grid
and a button.

---

## §8 — Sequencing *(original plan, kept for the reasoning)*

**Week 1 — nothing here is bigger than a day**

1. The `--studio-*` token set and `--studio-select`; move the editor onto them
   and kill the four invisible-UI bugs (§1).
2. Add the `data` entry to `BLOCK_TYPES` (§2).
3. Empty media blocks; neutral defaults (§2).
4. Wire or remove the two dead palette commands.
5. Delete the status bar; thin the toolbar to six controls.
6. Draggable hotspots; single-click-then-edit text; insert-page-after.
7. Restore the measurement headline.
8. Send the digest by hand.

**Weeks 2–4**

9. One insert surface; delete `BLOCK_LIBRARY`, the scaffolds and the sidebar
   Blocks tab (§2).
10. The post-import moment, with batch undo (§5).
11. Spread view (§4) — the biggest perceived-quality win in the list.
12. `/gallery` with *Start from this* (§7).
13. Reader chrome: four defaults, rest behind *More*, author-configurable.
14. Publish checklist.

**Quarter**

15. Canvas layout mode with snapping and the mobile stack rule (§3).
16. Edition styles (§6).
17. Live data with a real source (§6) — and the pricing decision that goes with
    it.
18. Commerce: own it or cut it, per `product-proof` §1.


---

## §9 — What is still outstanding

Written after the implementation pass, so it is the accurate list.

**Not done, and each is a real piece of work**

1. **The editor's surfaces still hardcode `neutral-*`.** The tokens exist and the
   bugs are fixed, but a wholesale class sweep across ~2,000 lines of editor JSX
   is a cosmetic change with real regression risk and no test to catch a
   mistake. New components (`InsertPanel`, `PublishChecklistModal`,
   `PostImportModal`) use the tokens. Do the sweep with a screenshot diff, not
   by hand.
2. **Edition styles** (§6) — a named type set per edition rather than per-block
   overrides. The single largest remaining quality item, and the difference
   between a page builder and a publishing tool.
3. **Image crop and focal point** (§6).
4. **Save as template** (§6) — the strongest retention mechanic available.
5. **Version history** (§6).
6. **Copy/paste and multi-select blocks** (§6).
7. **Live data with a real source** (§6) — the block can now be *inserted*, and
   the publish check stops one going live without a source, but binding it to a
   Google Sheet or a webhook and refreshing it is not built.
8. **Draft comments for the author's reviewers** (§6).
9. **Commerce: Stripe Connect, orders, a Sales tab, and an entry in
   `lib/plans.ts`.** The fake checkout is gone and a cart hands off to the
   author's own checkout link, which is the honest interim. The strategic
   decision — own it or cut it — is still the owner's.
10. **Send the weekly digest by hand and read the email.** Needs a deployed
    environment with `CRON_SECRET`; it cannot be done from a sandbox.

**Worth knowing before the next change**

- `page.layout` now has a sixth value, `'canvas'`. Anything that switches on
  layout needs a branch for it — `PageRenderer` and the editor have one.
- Media and link targets may legitimately be empty strings now
  (`draftableUrl`). Anything that assumes a `src` or `href` is present must
  handle the draft state; `lib/publish-checks.ts` is where "not empty" is
  enforced, and it runs at publish, not on save.
- `--studio-select` is the interaction colour. Do not reach for `--accent`,
  `--accent-vivid` or `--qlico-teal` for selection, focus or drag state: they
  are `#000` in light and `#fff` in dark, and that is how six controls became
  invisible.
