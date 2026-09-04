# QLICO — Product Proof

CPO review of the product as shipped on `main` @ `1addbb4`, 4 September 2026.
Marks: **1 stop · 11 revise · 3 keep**. Every mark points at a line of shipped
code. Companion to `docs/product-strategy-audit.md`, which covers positioning,
pricing and GTM in more depth and is not repeated here.

Read `HANDOVER.md` first — several items below are the audit's fixes having
drifted back.

---

## §1 — Stop the ship

### The public reader ships a checkout that takes a card number and does nothing

`CheckoutModal` is mounted by the reader every published edition uses. It
collects name, email, postal address, **card number, expiry and CVV** in plain
inputs. `handlePlaceOrder` makes no network call of any kind: it waits 1.8s,
invents an order number, clears the cart and shows a printable receipt reading
"Order placed successfully!"

| Evidence | |
|---|---|
| `components/viewer/ViewerChrome.tsx:683` | `<CheckoutModal … />` in the public reader |
| `components/viewer/CheckoutModal.tsx:59` | `handlePlaceOrder` — no fetch, no API |
| `components/viewer/CheckoutModal.tsx:63` | `setTimeout(… , 1800)` → `` `FL-${Math.floor(…)}` `` |
| `components/viewer/CheckoutModal.tsx:266-290` | `cardNumber` / `expDate` / `cvv` inputs |

Three problems, any one of which is enough on its own:

- **The reader is deceived.** They believe they bought a $480 coat. Nobody is
  ever going to send it.
- **Card data is being collected outside any processor.** There is no PCI scope
  here because there is no payment path at all — but the fields exist, so people
  will type into them.
- **The author carries it.** The edition is published under their name and their
  brand, from a link they sent to their own customers.

**Today.** Delete the card fields and the fake confirmation. Make the cart's
Checkout button do the one honest thing available now: hand off to a URL the
author supplies. That is a single new field on `ProductGridBlockForm` —
"Checkout link" — pointing at their Shopify, Stripe Payment Link or Gumroad.

**Then decide.** If commerce is a real bet, it is Stripe Connect against the
*author's* account, orders in the database, and a Sales tab in Insights. If it
isn't, cut the cart and keep Product Grid as a linkable catalogue block.

### Commerce has no entitlement

Commerce is the largest thing built since the last audit and appears nowhere in
`lib/plans.ts`. That file opens with a rule the team wrote for itself — every
entitlement in it is enforced on the server, and an entitlement nothing enforces
reads as a broken promise. Commerce is the inverse failure: a capability with no
entitlement at all. Free forever, on every plan, unmetered and unowned. Decide
whether it is a Pro feature before customers decide it is a free one.

---

## §2 — Where the flows break

### 2.1 Import stops one step short of the promise · REVISE

The create modal offers three doors and marks *Import a PDF* as primary. Import
works and drops the author straight into the editor
(`ImportPDFModal.tsx:281`) — right so far. But what they are looking at is a
page of *pictures of their PDF*. Nothing has changed yet, nothing tells them
what to do, and the one action that makes this not-a-PDF is a toolbar toggle
competing with nine other controls. Beside it sits *Auto-detect pins*
(`EditorCanvas.tsx:795`), which does exactly the right thing and is styled as
the lesser of the two buttons.

**Fix.** Don't land on a bare canvas. Land on one screen: *"Your 24 pages are
in. Want QLICO to find the products, links and callouts?"* One button, running
the detector you already built across *every* page rather than the current one,
then showing what it found. That turns "I uploaded a PDF" into "I have something
a PDF can't do" in a single click — the activation event the whole funnel is
waiting on.

### 2.2 Six ways to add content, none of them agreeing · REVISE

| Surface | Where | Offers |
|---|---|---|
| "Add Block" | canvas footer | 8 types in 4 groups (`BLOCK_TYPES`) |
| "Blocks" tab | left sidebar | 6 presets (`BLOCK_LIBRARY`) |
| "Layouts" tab | left sidebar | 6 page templates, **replaces** the page (`PAGE_TEMPLATES`) |
| Starter layouts | empty canvas | 3 hardcoded scaffolds (`handleScaffold*`) |
| Asset Library | top toolbar | images |
| Templates | create modal only | 6 whole publications (`data/templates.ts`) |

Four of those insert blocks. Two insert the *same* block with different defaults
— Image is `lightbox: false` in the picker and `true` in the sidebar. The three
canvas scaffolds duplicate what the Layouts tab does, under different names,
with luxury-fashion copy baked in.

And the Data block — the "living data blocks" the README leads with — **cannot
be added at all**:

- `EditorCanvas.tsx:322` — `{ title: 'Interactive', types: ['button', 'data', 'embed'] }`
- `EditorCanvas.tsx:226-311` — `BLOCK_TYPES` has no `'data'` member
- the picker's `if (!choice) return null` therefore renders nothing
- `components/blocks/index.tsx:31` — the renderer, the settings form and the
  schema all exist and work

One missing array entry has quietly deleted a headline feature.

**Fix.** One insert surface: a `/` command inside text and a `+` between blocks,
both opening the same panel with two tabs — **Blocks** and **Layouts**. Delete
`BLOCK_LIBRARY` and the three scaffolds. Make Layouts insert a *new* page by
default instead of overwriting the current one. Add the missing `data` entry.

### 2.3 The editor draws a canvas and runs a list · DECIDE

The deepest problem in the product, and the reason the editor feels hard.

The canvas draws an A4 page at a real 1:1.41 ratio, in pixels, with a paper
shadow, zoom steps, alignment guides, a mobile device bezel and a live crosshair
reading out `X: 42.1% · Y: 63.8%`. Every signal says *free canvas*.

It is not one:

- `components/viewer/PageRenderer.tsx:158-163` — flex column; a grid only for
  `split` / `grid`
- `lib/book-schema.ts:6-18` — `TextBlockSchema` has no `x` / `y` / `w` / `h`
  (only images carry `width`)
- reordering is a vertical drag list; the only thing on the page with real
  coordinates is a hotspot

So an author drags a photo where they want it and it snaps back into the stack.
No amount of polish fixes this, because the UI itself creates the expectation.

Two honest ways out:

- **Commit to the flow model and stop drawing a canvas.** A column of blocks
  with a live page preview beside it. Ships in a week, and it keeps output
  consistent across devices — the real reason a flow model suits a product whose
  readers are half on phones. Cost: no free composition, ever.
- **Commit to the canvas.** Add `x/y/w/h` to the block schema, a free-position
  mode beside the existing layouts, and snapping to the guides you already draw.
  This is what "editorial" implies and what the templates already look like.
  Cost: a real project — mobile reflow rules, a migration, and a reader that
  honours both models.

**Recommendation:** the canvas, scoped. Add `layout: 'canvas'` as a per-page mode
with free positioning only inside it, and a defined phone fallback (stack in
z-order). Flow stays the default, so nothing breaks and phones stay correct. But
make the call — today's state is the worst of both, because it promises the
canvas and delivers the list.

### 2.4 The publish → read → return loop is the best-built thing here · KEEP

Publishing forces a save and hands over the link rather than ending in a toast.
The onboarding checklist finishes at *"someone read it"* instead of at a feature.
Insights is a first-class nav item. The weekly digest claims its slot before
sending, so a failure costs one missed week rather than a double send. Real
product thinking; don't touch it.

One caveat: per `HANDOVER.md` §3, that digest has still never actually been sent.
Until somebody curls the route and reads a real email, the retention half of this
loop is theoretical.

### 2.5 The homepage has drifted off the only claim you own · REVISE

`BRAND.md` records the headline as "Turn PDFs into interactive experiences."
`HANDOVER.md` records a deliberate change to **"Send a PDF. See who actually
read it."** — a claim only QLICO can make, and the reason the analytics exist.

The hero now reads:

- `components/landing/Hero.tsx:346` — "Publishing, *Perfected.*"
- `components/landing/Hero.tsx:356` — "Transform static PDFs into immersive,
  interactive editions. No code required. Unmatched elegance."

Three unfalsifiable claims and no differentiator. Issuu, Flipsnack and
FlippingBook all say a version of it. The measurement promise — the thing they
*don't* lead with, and the thing this product genuinely does — has been traded
for adjectives. Put it back; let "Publishing, perfected" be the eyebrow if it
must live.

---

## §3 — Making the editor easier to use

The top toolbar carries thirteen controls. The canvas toolbar carries seven
more. Twenty persistent controls arranged around a page that offers eight block
types — in a product whose brand document asks for "massive whitespace" and
"uncluttered".

### Cut, in this order · REVISE

- **Save state is displayed three times** — the header pill, the `SavedAgo`
  timestamp inside it, and a whole status bar reading "ALL CHANGES SAVED"
  (`EditorClient.tsx:551-559`). Keep the pill. Delete the bar; it also spends
  32px of canvas restating shortcuts the `?` modal already lists.
- **Two hotspot buttons sit side by side** and the more valuable one
  (auto-detect) is styled as the lesser. Make detection primary, manual
  placement secondary.
- **Two command-palette entries do nothing** — `onToggleGuides` and
  `onAutoDetectPins` are both passed as `() => {}` (`EditorClient.tsx:578-579`).
  A palette that silently no-ops teaches people not to open it.
- **Move Asset Library and Shortcuts into the palette** and off the toolbar.
  Target: six persistent controls — title, save state, Preview, Share, Publish,
  ⌘K.

### Placeholder content is shipping into real documents · REVISE

- A new Video block defaults to `w3schools.com/html/mov_bbb.mp4`
  (`EditorCanvas.tsx:247`, and again at `PageListSidebar.tsx:57`).
- A new Audio block defaults to a w3schools horse sample
  (`EditorCanvas.tsx:256`).
- A new Product Grid arrives holding a *Mulberry Silk Trench, $480* and a
  *Cashmere Ribbed Beanie, $120*, both marked in stock with working Add to Bag
  buttons (`EditorCanvas.tsx:280-311`).

On a 40-page import an author will not notice, and that publishes: a quarterly
report goes out with a silk trench in it and a third-party video host in the
page.

**Fix.** Empty blocks with a real empty state. A video block with no source shows
a dashed frame reading "Choose a video" and refuses to publish until it has one.
Better product *and* less code than curating fake content.

The same applies one level up: every default in the editor is luxury fashion —
the scaffolds, the block library, the asset presets, the sample hotspot. Someone
importing a benefits handbook meets Milan. Make defaults neutral and let the six
templates carry the verticals, which is what templates are for.

### Small frictions, each worth an hour · REVISE

- **Hotspots can't be dragged.** You arm a mode, click a coordinate, and
  afterwards can only nudge with arrow keys — the inspector shows X/Y read-only.
  The marker is an absolutely-positioned div; make it draggable.
- **Inline text editing needs a double-click** and is discoverable only through a
  `title` tooltip (`TextBlock.tsx:226`). Use the standard: click selects, second
  click edits, and show an "Edit text" affordance on selection.
- **"Append New Page" only appends.** Adding a page after page 3 means adding at
  the end and dragging it back. Add "Insert page after" to the page hover menu.
- **Applying a Layout silently replaces the page** and explains itself in a toast
  after the fact. Ask first, or insert instead.
- **The mobile bezel simulates the canvas, not the reader.** Preview should have
  the same toggle.

---

## §4 — How it feels

### The studio is two design systems wearing one logo · REVISE

The dashboard, Insights, Account and the create modal are built on the
`--qlico-*` tokens: theme-aware, light-first, generous radii, a display face, a
warm paper ground. The editor is hardcoded `bg-neutral-950` with Tailwind
`neutral-*` throughout, ignores the user's theme choice entirely, and uses
exactly one of those tokens (`--accent-vivid`).

The flow is: a soft light sheet asks you to name your edition, you press *Create
edition*, and you land in a black IDE. Both halves are well made. They do not
look like the same company.

**Fix.** Dark tools and light chrome is a legitimate decision — Figma makes it.
Then commit: give the editor the same type ramp, radii and accent tokens under a
dark palette, so it reads as QLICO in dark rather than as a different
application. Roughly a day of token work, and the single largest
perceived-quality change available.

### The reader meets fourteen controls · REVISE

Previous, next, zoom out, zoom level, zoom in, search, cart, review, contents,
sound, narrate, narration speed, language, print, fullscreen
(`ViewerChrome.tsx:387-613`). Someone who clicked a link to look at a lookbook
is handed a cockpit.

**Fix.** Four by default — contents, search, share, fullscreen — everything else
behind a *More* menu. Then let the author switch features on per edition.
Narration and translation stop being clutter and start being things an author
chose, which is also how you find out whether anyone wants them.

Two smaller notes in the same spirit:

- **Emoji are being used as interface** — `🎯 Click anywhere to drop beacon`, and
  📸 💬 🛍️ on the starter layouts — inside a product whose brand document
  specifies monochrome marks and a stark palette. Lucide is already loaded.
- **The editor sets labels at 10px uppercase with tight tracking**, below where
  that treatment stays legible.

---

## §5 — What QLICO should be showing people

There are six complete publication templates in `data/templates.ts` — a
lookbook, an architecture monograph, a menu, an annual report, a portfolio and a
whitepaper — with real typography, hotspots and product grids already built.
They are reachable from exactly one door of one modal, appear nowhere on the
landing page, and have no gallery.

The cheapest conversion asset in the repository, going unused. "Unmatched
elegance" is a claim; a live twelve-page lookbook a stranger can flip through
without an account is proof.

1. **Build `/gallery`** — all six published as real editions, readable without an
   account.
2. **"Start from this" on every gallery edition** — one click into the editor
   with that template applied.
3. **Build these four properly**, as the gallery, the landing page, and the
   templates themselves.

### A — The seasonal lookbook · retail

What the product already does best. Full-bleed look on the verso, shoppable pins
carrying price and a real checkout link, product index on the recto as the
conversion surface.

- Blocks: `image` · `product-grid` · `button`
- Gate: email, page 3
- The number that matters: dwell per look

### B — The architecture monograph · studio

No commerce anywhere. Silence, full-bleed plates, ambient audio per project, and
a lightbox that lets a prospective client actually look.

- Blocks: `image` · `text`/quote · `audio`
- Gate: none — it is a portfolio
- The number that matters: reached the project index

### C — The quarterly investor letter · the one you aren't selling

The strategic argument. A letter whose figures are *still correct in November* —
that is what the Data block is for, and it is a thing a PDF structurally cannot
be. Domain-gated, so only the fund's people get in, and the author learns which
partners read to the end. This moves QLICO from "prettier PDFs", where Issuu and
Flipsnack compete on price, to "documents that report back", where they can't
follow.

- Blocks: `text` · **`data`** (currently unreachable — §2.2)
- Gate: domain, page 2
- The number that matters: completion by reader

### D — The tasting menu · hospitality

Six pages, opened from a QR code on the table, no email gate, no account. Audio
pins for pronunciation. Proof that a QLICO edition does not have to be long to be
worth making.

- Blocks: `text` · `audio` · `image`
- Gate: none — it is a menu
- The number that matters: which dishes get opened

---

## §6 — In this order

### Before anything else — this week

1. Card fields and the fake confirmation out of the checkout; swap to an
   author-supplied checkout link.
2. Add the missing `data` entry to `BLOCK_TYPES` — one line restores a headline
   feature.
3. Wire the two dead command-palette actions, or remove them.
4. Replace the w3schools and silk-trench defaults with empty states.
5. Put the measurement headline back on the homepage.
6. Send the weekly digest once, by hand, and read the email.

### Make it feel like one product — this month

7. One insert surface (`/` and `+`). Delete `BLOCK_LIBRARY` and the three canvas
   scaffolds.
8. Post-import step: auto-detect across every page, then show what it found.
9. Delete the editor status bar; thin the top toolbar to six controls.
10. Reader chrome down to four defaults, the rest behind *More* and
    author-configurable.
11. Build `/gallery` from the six templates, with *Start from this*.
12. Move the editor onto the QLICO tokens under a dark palette.

### The two real decisions — this quarter

13. **Canvas or flow.** Recommendation: a per-page `canvas` layout mode with free
    positioning and a defined phone fallback, flow remaining the default.
    Whichever you choose, stop shipping the contradiction.
14. **Commerce: own it or cut it.** Stripe Connect, orders in the database and a
    Sales tab in Insights — and an entry in `lib/plans.ts` — or the cart goes and
    Product Grid stays as a catalogue.
