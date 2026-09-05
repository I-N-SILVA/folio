# QLICO — Product, UX & Go-To-Market Audit

Written from the repository at `5a041c9`, August 2026. No product code was changed
to produce it.

> **Status: P0–P2 of the roadmap in §Prioritised roadmap have since been
> implemented** (commits `b5149e2`…`01fdde2`). The findings below are preserved as
> written — they are the reasoning behind those changes, and a description of the
> product as it was. Where a finding has been addressed, the roadmap table at the
> end marks it **done** and names what shipped. The strategy sections (positioning,
> GTM, research plan, experiment backlog) are unchanged and still to be executed;
> those are decisions and motions, not code.
>
> **What was deliberately not done, and why:**
>
> - **Real social proof (E10).** Testimonials and customer logos cannot be
>   invented. The unsourced claims came out; nothing was put in their place.
> - **Custom domain.** Removed from all copy rather than built — it needs domain
>   routing, certificate provisioning and a verification flow, which is a P3
>   project, not a copy fix.
> - **`/press` and `/create`.** The simplification plan listed both for deletion.
>   `/press` hosts the brand assets `BRAND.md` §7 documents and a launch needs;
>   `/create` is a six-line redirect protecting existing bookmarks, which the
>   audit itself said to remove only "once links have decayed". Both kept.
> - **Applying the migrations.** `009`, `010` and the new `011` still need to be
>   run against production Supabase. Nothing in this environment can verify which
>   migrations a given project has.

**How to read the evidence markers.** Every claim is tagged:

- **[O]** *Observed* — read directly out of the code, with a file reference.
- **[I]** *Inferred* — a reasonable reading of the evidence, but not proven by it.
- **[V]** *Needs validation* — a belief the business currently rests on that
  nothing in the repo supports. These are the dangerous ones.

The marketing docs in the root (`LAUNCH.md`, `MARKETING.md`, `APPSUMO_LAUNCH.md`,
`docs/promotion-strategy.md`) describe a product that is ahead of the code in
several specific places. Where they disagree with the implementation, this
document follows the implementation and says so.

---

## 0. The five things that matter

If nothing else in this document gets read, read these.

1. **The Free plan is functionally identical to Pro.** `lib/plans.ts` declares
   eight entitlements. Exactly one — `maxBooks` — is enforced anywhere in the
   codebase. PDF import, lead gating, CSV export, analytics retention, and the
   watermark are all sold on the pricing page and all available to every signed-up
   user for free. **[O]** (§1.3, §7.4) Pro's only real benefit today is "more than
   one book."

2. **The watermark — the one free-tier constraint that also drives growth — is a
   checkbox any free user can switch off.** `ViewerChrome.tsx:288` hides the
   "Powered by QLICO" badge when `book.settings.whitelabel` is true, and
   `BookSettingsForm.tsx` offers that toggle to everyone. **[O]** That simultaneously
   removes the paid upgrade reason *and* the product-led growth loop.

3. **The plan matrix paywalls the core promise.** The hero says QLICO "turns static
   PDFs into interactive editions"; `PLANS.free.pdfImport` is `false`. **[O]** If
   entitlements were enforced as written, a new free user could not do the one thing
   the landing page promised. The fix is not to enforce it — it is to change the
   matrix (§7.5).

4. **Editing an edition's page structure does not fully persist.** The editor
   autosaves by upserting pages directly from the browser on `id`
   (`EditorClient.tsx:88–104`); nothing calls the atomic
   `PUT /api/books/[id]/pages`. So deleting a page leaves the row in the database,
   and reordering pages rewrites `page_number` into a `UNIQUE (book_id,
   page_number)` constraint. **[O]** This is in the core recurring workflow.

5. **The Lifetime tier on the pricing page cannot be bought.** "Lifetime · $199 ·
   See the deal" links to `/redeem`, which only accepts an AppSumo licence code.
   **[O]** Every visitor who picks the third pricing column hits a dead end.

Items 1, 2, 3 and 5 are all pricing-page-to-product mismatches. That is the theme of
this audit: **the product is better built than it is packaged.**

---

# Phase 1 — What this product is

## 1.1 The product

**[O]** QLICO is a **web SaaS for interactive digital publishing**. An author brings
a PDF (or starts blank), gets a page-per-spread interactive "edition" with a tactile
page-turn reader, layers interactive hotspots and blocks onto the pages, publishes it
to a hosted URL (`/book/<slug>`) or an iframe embed (`/embed/<slug>`), and gets
per-edition reader analytics.

- **Category:** workflow SaaS with a consumer-grade output artifact. It is *not* a
  marketplace, not a dev tool, and only incidentally an AI product (Gemini is an
  optional enhancement at import — `lib/ai.ts`, `isAiEnabled()`).
- **Core job:** *"I have a document I need people to actually read and respond to,
  and I need to know whether they did."*
- **Primary user action:** publish an edition and share its link.
- **Real outcome the user wants:** **[I]** not "a flipbook" — a response. A reply, an
  order, a lead, a booked call, a client who saw slide 14.

## 1.2 What is actually built (and it is a lot)

**[O]** The reader is the strongest asset in the repo, and it is genuinely
differentiated:

| Capability | Where | Note |
| --- | --- | --- |
| 3D page-turn reader | `ViewerEngine.tsx` (react-pageflip) | Portrait/landscape aware, zoom, fullscreen |
| Fore-edge "riffle" navigation | `ForeEdge.tsx` | Hover fans the stacked page edges; the signature interaction |
| Cover-open reveal | `ViewerChrome.tsx` `CoverOpen` | Once per session, honours reduced-motion |
| Hotspots incl. **checkout** | `HotspotSchema`, `HotspotLayer` | `action: 'checkout'` + `price` + `stripeUrl` — a page becomes a storefront |
| **Living data blocks** | `DataBlock.tsx`, `DataBlockSchema` | Binds a value to a JSON endpoint; updates *after* publish |
| Server-enforced lead gate | `lib/gating.ts`, `/api/books/unlock` | Withheld pages are never serialised into the HTML |
| Reader analytics | `/api/events`, `/api/analytics/[slug]` | Opens, dwell, completion funnel, click heatmap, gate funnel, CTA clicks |
| One-line embeds | `/embed/[slug]`, `next.config.ts` headers | `frame-ancestors *` on embeds only |
| PWA + offline | `public/sw.js`, `app/manifest.ts`, `/offline` | Allowlist-based SW cache |
| 4 bundled demo editions | `data/books/` | Served without Supabase — the demo works on a cold deploy |

**[I]** Two of these — **checkout hotspots** and **living data blocks** — are not
standard in this category and are the honest basis for positioning (§9). The
fore-edge riffle is craft, not a buying reason.

## 1.3 Business model — as coded

**[O]**

- **Free** — 1 book, 7-day analytics, watermark on.
- **Pro** — $19/mo via Stripe (`lib/stripe.ts`, `/api/billing/*`). Activates only if
  `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PRICE_PRO` are set; otherwise the
  account page falls back to a "See plans" link that points back at the pricing
  section it came from — a loop.
- **AppSumo LTD tiers 1–3** — full licensing backbone: HMAC-verified webhook,
  `activate`/`enhance`/`reduce`/`refund`, atomic redemption (`lib/appsumo.ts`, 273
  lines of tests).

**[O] The enforcement gap.** Grepping every entitlement name across `app/`,
`components/` and `lib/` returns hits only in `lib/plans.ts` (the definition),
`app/(studio)/account/page.tsx` (display), and landing copy. No enforcement:

| Entitlement | Sold as | Actually enforced? |
| --- | --- | --- |
| `maxBooks` | ✅ | **Yes** — `/api/books`, `/api/import/pdf`, plus a DB trigger (migration 006) |
| `pdfImport` | Pro/LTD only | **No** — `/api/import/pdf` checks quota only |
| `leadGating` | Pro/LTD only | **No** — the editor toggle is unguarded; `/api/books/unlock` never checks the owner's plan |
| `csvExport` | Pro/LTD only | **No** — client-side `Blob` download in `AnalyticsDashboard.tsx` |
| `analyticsDays` | 7 / 90 / 365 | **No** — `/api/analytics/[slug]` accepts `range=all` from anyone |
| `watermark` | Free only | **No** — driven by a per-book toggle, not the plan |
| `whiteLabel` | Tier 2+ | **No** — same toggle |
| `customDomain` | Pro/LTD | **Not built at all** — zero domain-routing code exists |

**[O] `customDomain` is sold in three places** (`Pricing.tsx:34`, `Faq.tsx:13`,
`account/page.tsx:131`) and implemented in none. `proxy.ts` does auth redirects only.

## 1.4 Users

**[O] What the code tells us about who this is for:**

- The four bundled demos are a **shoppable lookbook**, a **living annual report**, a
  **design portfolio**, and a product tour.
- The hotspot schema has `price`, `stripeUrl`, `ctaLabel` — someone expected selling.
- The data block's own doc comment names "prices, stock, dates."
- The lead gate defaults to gating at page 3 with "Unlock the full version."
- LTD tiers are pitched at "solo creators," "studios," "agencies."

**[I] Primary persona — the marketer/owner at a small brand or studio who sends
documents to win business.** Moderate technical sophistication (can drag a PDF, can
paste an embed code into Squarespace/Shopify, cannot configure a CMS). Triggered by a
seasonal moment: a new collection, a quarterly report, a proposal round, a portfolio
refresh. Their pain is *silence after sending*.

**[I] Secondary persona — the agency/freelancer** who produces the document for a
client and wants to hand back something that looks like a product and reports on
itself. This persona is the LTD buyer and the reason `whiteLabel` exists.

**[I] The reader** is a real third user with no account, on mobile more often than
not, with a very low tolerance for a slow first paint or an early gate.

**[V] None of this is validated.** No user research, no interview notes, no
analytics history exists in the repo. The personas above are read off the schema.

## 1.5 Technical shape (only what affects the experience)

**[O]** Next.js 16 App Router + React 19; Supabase (Postgres + auth + storage + RLS);
Tailwind v4; Zustand editor store with undo/redo; Zod schemas end-to-end; Stripe;
optional Gemini.

Three things about the architecture shape the product experience directly:

1. **Magic-link-only auth** (`app/login/page.tsx`, `signInWithOtp`). No password, no
   OAuth. Every signup requires leaving the site for an inbox. **[I]** On a
   cold-traffic landing page this typically costs a large share of signups.
2. **The reader is server-rendered with ISR at 60s** and the gate truncates
   server-side, so gated pages never reach the browser. Good; keep it.
3. **PDF rendering happens in the browser** (`lib/pdf-renderer.ts` + pdf.js), pages
   go straight to storage via signed URLs. **[I]** This is the single most
   under-exploited asset in the codebase: the product can render a PDF into pages
   *without a user account*, which makes a no-signup try-before-you-buy flow cheap
   (§7.3).

---

# Phase 2 — Screen & route inventory

## 2.1 Public surfaces

| Route | Purpose | Primary CTA | Secondary | User state | Likely next | UX concerns |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | Marketing landing | "Start for free" → `/login` | View demo, pricing, FAQ | Anonymous | `/login` or `/book/demo` | Headline is category-ambiguous; three pricing CTAs go three different places, one of them a dead end (§3.A) |
| `/book/demo` + 3 demos | Live proof | (none) | Flip, hotspots | Anonymous | Back button | **No CTA anywhere in the reader.** The best asset the product has converts nobody (§7.4) |
| `/book/[slug]` | Published edition | Read; unlock if gated | Zoom, fullscreen | Reader | Leave | Unpublished slug returns a friendly "still in the bindery" page — good |
| `/embed/[slug]` | Iframe edition | Read | — | Reader | — | `noindex` + canonical set — correct |
| `/login` | Magic-link auth | "Send magic link" | Resend, change email | Anonymous | Inbox | Only auth method; no expectation-setting about the wait |
| `/press`, `/privacy`, `/terms`, `/offline`, `/not-found`, `/error` | Support pages | — | — | Any | — | `/press` exists before there is press |

## 2.2 Authenticated surfaces

| Route | Purpose | Primary CTA | Secondary | User state | Likely next | UX concerns |
| --- | --- | --- | --- | --- | --- | --- |
| `/dashboard` | Library + stats + onboarding | "Create New" | Search/filter/sort (>3 books) | Signed in | `/editor/[id]` | Stat cards count **Books/Published/Pages** — three vanity numbers about *the author's own output*, none about readers |
| `/dashboard?new=1` | Create modal | Blank / PDF / Images | — | Signed in | Editor | Three options where the product has one story ("bring your PDF"); the Images path is a second, weaker write path (§6) |
| `/editor/[id]` | The studio | Publish toggle | Preview, Share, Pages, autosave | Owner | `/book/[slug]` | Dark surface in an otherwise light app; import modal inside it is light-only; page delete/reorder don't persist (§4.6) |
| `/analytics/[slug]` | Per-edition analytics | Range filter | CSV, leads CSV | Owner | Back | **Reachable only from a small icon on a book card.** No nav entry, no cross-book view |
| `/account` | Plan, quota, entitlements | Upgrade to Pro | Redeem a code | Signed in | Stripe | Lists seven entitlements, five of which are not enforced — it is a promise sheet |
| `/redeem` | AppSumo code | "Redeem code" | Back to account | Signed in | `/account` | Also the destination of the public "Lifetime $199" CTA, which it cannot serve |
| `/create` | — | — | — | — | — | Redirect to `/dashboard?new=1`. Correct; can be deleted after link decay |

## 2.3 States

**[O] Well handled:** dashboard empty state (illustrated, with CTA); loading skeletons
on dashboard/editor/analytics; save status that always says something; import progress
split across render/upload phases; a partial-import warning toast; a destructive-delete
confirm dialog; expired/reused magic-link explanations; an `/offline` page; a
"still in the bindery" state for unpublished editions.

**[O] Missing or weak:**

| State | Where | Consequence |
| --- | --- | --- |
| **Paywall / upgrade state** | Only one exists (book-limit wall in `CreateBookModal`) | Because nothing else is gated, there is no other upgrade moment in the product **[O]** |
| **Zero-reader state** | `/analytics/[slug]` shows "No analytics data yet for this period" | The single most common state a new author sees. It offers no next action — no "share your edition" prompt, no share link |
| **First-lead state** | none | A captured lead sits in the events table until the author opens analytics and downloads a CSV. **No notification of any kind exists** — the repo has no email provider **[O]** |
| **Post-publish state** | Toast: "Edition published — it's live!" | The toast is the whole celebration. No share sheet, no "send it to someone", no link surfaced |
| **Import-abandoned state** | Orphan book holds a slug + quota slot | On a 1-book free plan, one abandoned import blocks the account entirely **[O]** (also `HANDOVER.md` §3.3) |

## 2.4 Structural problems

- **Orphan-ish screen:** `/analytics/[slug]` is one icon away from invisible.
- **Dead end:** pricing "Lifetime" → `/redeem` with no code.
- **Loop:** `/account` "See plans" → `/#pricing` → "Get Pro" → `/login?next=/account`
  → `/account`, when Stripe is unconfigured.
- **Terminology drift:** the product calls the same object a **book** (`books` table,
  `/book/`, "Books used", "Book title", `BookCard`), an **edition** (`BRAND.md`, "Create
  your first edition", "Edition published"), a **QLICO** ("Create New QLICO", "Name your
  QLICO"), and a **publication** (pricing: "1 publication"). Four names, one thing, all
  in surfaces a single user crosses in one session. **[O]**
- **Competing actions:** each `BookCard` carries Edit + five icon-only controls
  (view live, share, analytics, rename, delete) — a delete button one 44px target away
  from an edit button.

---

# Phase 3 — Journeys

Format: **Goal → steps → friction → emotional state → failure point → opportunity.**

## Journey A — First-time visitor

**Goal:** work out in seconds whether this solves my problem.

Steps: land on `/` → headline "Flip through anything." → subhead names PDFs, hotspots,
analytics, embeds → product shot (a preview reel, click-through to `/book/demo`) →
features → statement → stats → how it works → examples → pricing → FAQ → CTA.

| Question | Verdict |
| --- | --- |
| Understandable in ~5s? | **Partly.** "Flip through anything." is a brand line, not a value line. The *sub*head does the work. **[I]** A visitor who bounces on the H1 never reaches it |
| Target user obvious? | **No.** "catalogs, lookbooks, portfolios, and reports" is four audiences, which reads as none |
| Benefit obvious? | Yes, once you reach the subhead and `Statement` ("A download link is where good work goes to be forgotten" — the strongest sentence on the page) |
| CTA obvious? | Yes — "Start for free", violet, reserved for primary actions |
| Trust/evidence? | **Almost none.** No customers, no logos, no testimonials, no counts. `LAUNCH.md` and `MARKETING.md` both describe a testimonial section; `app/page.tsx` has no such component **[O]** |

**Unanswered objections:** Who else uses this? What happens to my file? Is my edition
still there in a year (an LTD buyer's first question)? Can readers see it on a phone?
What does the free plan actually let me do?

**Actively harmful copy [O]:**

- `Stats.tsx`: **"10× — More engaging than a static PDF."** No source. A number this
  round with no citation reads as invented and taints the two beside it.
- `Stats.tsx`: **"100% — Your data, your infrastructure"** and `Faq.tsx`: analytics
  are "captured into your own Supabase project, so you own the data." **This is not
  true for a hosted qlico.app customer** — their events land in QLICO's Supabase. It
  is true only for someone self-hosting the repo. Making a data-residency claim you
  can't honour is the kind of thing that ends an enterprise deal or a refund dispute.
- Custom domain is promised three times and does not exist.

**Emotional state:** curious → impressed by craft → *unanchored* ("is this for me?")
→ hesitant at pricing.

**Simplified ideal flow:** headline that names the job → one demo you can touch above
the fold → *proof* → one CTA. Move `Statement`'s line up; make the hero H1 do
work; delete `Stats` until the numbers are real.

## Journey B — Signup / onboarding

**Steps [O]:** click "Start for free" → `/login` → type email → "Send magic link" →
leave the site → find the email → click → `/auth/callback` → `/dashboard`.

**Friction:**

1. **Context switch to an inbox is the entire signup.** No password, no Google. **[I]**
   For a landing page whose visitors arrive from social or a directory, this is likely
   the largest single drop in the funnel — and it is invisible, because nothing
   measures the gap between `signup_magic_link_sent` and the first dashboard load.
2. **Nothing is asked and nothing is used.** The signup collects only an email, which
   is good, but it also means the dashboard cannot personalise the first run at all
   (no "what are you publishing?" → no starting template).
3. **No expectation setting before submit** — "It can take a minute to arrive" appears
   only *after* sending.

**Emotional state:** intent → interruption → (often) never returns.

**Failure point:** the inbox.

**Opportunity:** the highest-leverage change in this document is to **move signup after
first value** (§7.3), not to add an OAuth button.

## Journey C — Activation

**[I] The activation event is not "created a book."**

The dashboard's onboarding checklist (`OnboardingChecklist.tsx`) proposes: create →
add a hotspot → publish. That is a *feature* checklist, and step 2 in particular is
work the user did not come to do. "Add a hotspot" links to the editor, where the
hotspot tool is a small `Crosshair` toggle in the canvas toolbar
(`EditorCanvas.tsx:383`) that must be armed before clicking the page — discoverable
only by hunting.

**Proposed activation event [I]:**

> **A published edition that has been opened by at least one non-owner reader session
> within 7 days of signup.**

Rationale: publishing alone produces nothing. The author's value — and every
retention mechanic the product has (analytics, leads, living data) — begins at the
first real read. It is also directly measurable today: `book_open` events already
carry `session_id` (`/api/events`).

**The real path to it:**

`signup → import a PDF → see it as a flipbook → publish → copy the link → send it to
someone → they open it → author sees the first read`

**Where users abandon [I]:**

| Step | Risk | Why |
| --- | --- | --- |
| Import | Medium | Requires a title *and* a "URL Slug" with the helper "Lowercase letters, numbers, and hyphens only" before anything happens (`ImportPDFModal.tsx`). The user came to see their PDF, and is being asked to name a URL |
| First look at the editor | **High** | A dark three-panel IDE-like studio drops on a person who arrived from a light marketing site. Their PDF is already an edition at this point, but nothing says so |
| Publish | Medium | The Draft/Published toggle is a small button in a crowded toolbar |
| **Share** | **Highest** | Publishing fires a toast and nothing else. The share modal exists and is good — but the user must know to press "Share". **The single step that creates all downstream value is not prompted anywhere** |
| First read | — | Depends entirely on the step above |

**Opportunity:** replace the publish toast with a **share moment** — a modal with the
live link, a copy button, the embed snippet, and "open it yourself" — and fold the
onboarding checklist into `create → publish → share`, dropping the hotspot step.

## Journey D — Core recurring workflow

**[I]** The retained user's loop is: *new document arrives → import → light editing →
republish → send → check numbers.*

**[O] What works:** autosave with an honest status line and a last-saved clock;
undo/redo with coalescing; drag-to-reorder blocks with a visible handle; a mobile dock
that brings both side panels back as bottom sheets; a page manager; preview (⌘P).

**[O] What breaks or grates:**

1. **Page deletion does not persist.** `removePage` filters the store and renumbers;
   autosave only upserts the remaining rows on `id`. The deleted row is never deleted.
   On reload the page returns.
2. **Page reordering can fail the save.** Renumbering swaps `page_number` values into
   a `UNIQUE (book_id, page_number)` constraint (migration `002`), which an
   `upsert(onConflict: 'id')` checks per row. The user sees "Save failed — check your
   connection", which misattributes the cause.
   *Both of these are already solved in the repo* — `PUT /api/books/[id]/pages` +
   `replace_book_pages()` (migration `010`) exist, are transactional, and are
   **called by nothing**. The fix is to route the editor through them.
3. **Slug is immutable.** Set once in the create modal, never editable afterwards
   (`create/page.tsx` comment; no PATCH path for slug). A typo in a public URL is
   permanent. `HANDOVER.md` §4 correctly flags this as an owner's decision — decide it.
4. **Two typography fields are free-text** (`headingFont` / `bodyFont`, "e.g. Inter,
   serif"). A user typing a font they own locally gets a different edition than their
   readers see.
5. **The import modal is a different design system** — hand-rolled portal, light-only
   Tailwind greys (`text-gray-900`, `bg-gray-50`) inside a `bg-neutral-950` editor, no
   focus trap, unlike the shared `components/ui/Modal.tsx` used everywhere else.

## Journey E — Upgrade / monetisation

**[O] Value experienced → limit → decision:**

The *only* limit a user can hit is the book cap. On Free that is **book #2**. The
upgrade wall it triggers is well built (`CreateBookModal`, `limitHit`): it names the
plan, the limit, and offers "See plans" + "Redeem a code".

**The problems:**

1. **The trigger is wrong.** Book #2 arrives before the first edition has been read by
   anyone. The user is asked to pay before they have evidence the product works. **[I]**
2. **There is no other upgrade moment,** because nothing else is enforced. A user who
   only ever publishes one edition sees zero upgrade prompts forever, while enjoying
   lead gating, unlimited analytics history, CSV export and no watermark.
3. **"See plans" leaves the app** for `/#pricing` — a marketing page — instead of a
   focused in-app plan comparison.
4. **The Lifetime column cannot be purchased** (§0.5).
5. **`past_due` grants Pro indefinitely** (`HANDOVER.md` §3.1) — no dunning limit.

**Opportunity:** re-time the ask. Gate on *outcomes the user now cares about* — the
second gated edition, analytics older than 30 days, the CSV of leads, removing the
watermark — each of which only becomes interesting after the first successful read.

## Journey F — Return usage / retention

**Why would someone come back tomorrow? [I]** Today: to check numbers they have no
reason to expect changed, on a screen they can only reach through an unlabelled icon.

**What *should* compound, and mostly does not:**

| Asset | Retention potential | Current state |
| --- | --- | --- |
| Reader analytics | High — numbers change daily without the author doing anything | Buried; no summary anywhere; no digest; no notification |
| Captured leads | **Highest** — a lead is money | Invisible until the author opens analytics and downloads a CSV. No email, no webhook, no integration **[O]** |
| Living data blocks | High — the edition stays current after publish | Built and shipped, but discoverable only as a block type in a picker |
| The library itself | Medium — the archive of past editions | Good: search/filter/sort appear past 3 books |
| PWA install | Low-medium | Install prompt is in the dashboard header |

**The gap in one sentence:** QLICO captures the things worth returning for and never
tells anyone they happened.

---

# Phase 4 — UI/UX audit

## 4.1 Visual hierarchy

**[O] Strong.** The brand system (`BRAND.md` + `globals.css`) is coherent and
disciplined: Fraunces display / DM Sans body, ink-on-white with violet reserved for
primary actions and links only, generous radii, hairline borders, one signature motion
per surface with `prefers-reduced-motion` honoured throughout (`Reveal`,
`HeadlineReveal`, `CoverOpen`, `ProductShot` all check it).

**Issues:**

1. **The dashboard headline competes with the work.** `text-5xl/6xl` "Your digital
   shelf" plus a three-card stat row plus an onboarding card push the actual library
   below the fold. The stats measure output (Books/Published/Pages), not results.
2. **The editor is a different product visually** — `bg-neutral-950` and neutral greys
   with none of the brand tokens. Defensible for a workspace, but the seam is abrupt
   and the import modal straddles it in the wrong direction (light modal on dark).
3. **Card action row is flat.** Seven controls at one visual weight per book card.

## 4.2 Navigation & IA

**[O]** Studio nav is `Library | Account`. Analytics has no nav entry. The editor exits
only to `/dashboard`. There is no help, docs, or support link anywhere in the app —
`APPSUMO_LAUNCH.md` §4 lists it as an open to-do, and AppSumo review scores turn on
support responsiveness.

**Recommended IA:**

```
Library        (the shelf — with per-book read counts on the card)
Insights       (all editions, one screen: reads, completion, leads this week)
Account        (plan, usage, billing, redeem)
Help           (docs + contact)
```

Insights is the return reason. Promoting it from a card icon to a nav item is a
one-file change with outsized effect. **[I]**

## 4.3 Copy

| Location | Current | Problem | Suggested |
| --- | --- | --- | --- |
| `Hero.tsx` H1 | "Flip through anything." | Brand line in the highest-value slot; names no user, job or outcome | **"Send a PDF. See who actually read it."** or **"Turn your catalog into something people finish — and something you can measure."** |
| `Stats.tsx` | "10× more engaging" | Unsourced | Delete, or replace with a real product number once instrumented ("Editions published this month: N") |
| `Stats.tsx` / `Faq.tsx` | "Your data, your infrastructure" / "your own Supabase project" | **Untrue for hosted customers** | "Your reader data stays yours — export every event as CSV, any time." |
| `Pricing.tsx` | "Lifetime · $199 · See the deal" → `/redeem` | Dead end | Either sell it (Stripe one-time price) or relabel: "Lifetime deal — available on AppSumo" with the real link, and keep `/redeem` for code holders |
| `dashboard/page.tsx` | "Your digital shelf" / "Compose, publish, and measure interactive publications from one calm workspace" | Atmosphere where orientation belongs | "Your editions" + "3 published · 412 reads this week" |
| `CreateBookModal` | "Create New QLICO", "Name your QLICO" | Product-name-as-noun; a first-time user does not know what a QLICO is | "Create an edition", "Name your edition" — and use *edition* everywhere (§4.9) |
| `ImportPDFModal` | "URL Slug" + "Lowercase letters, numbers, and hyphens only" | Developer vocabulary in the activation path | "Link" with the prefix shown inline (`qlico.app/book/` `spring-lookbook`) and silent sanitising |
| `ImportPDFModal` | "Magic AI Enhancement" | Feature-branded, benefit-free | "Find products and write page descriptions automatically" |
| `EditorClient` | Toast "Edition published — it's live!" | The end of the most important moment in the product | Replace with the share modal (§3.C) |
| `login/page.tsx` | "compose, publish, and measure your digital shelf" | Sub-brand copy at the moment of highest anxiety | "We'll email you a sign-in link — no password to remember." |
| Analytics empty | "No analytics data yet for this period." | Dead end at the most common state | "Nobody has opened this edition yet. **Copy the link** and send it to one person." + copy button |

## 4.4 Forms

**[O] Good:** the login form recovers from a typo'd address (change email / resend);
create-modal validates image size and type *before* creating anything; slug conflicts
return a specific 409 message; the lead gate shows a real error and stays retryable;
progress bars carry proper `role="progressbar"` and `aria-valuenow`.

**Issues:**

1. **Import asks for title + slug up front.** Both are derivable (the filename already
   seeds them). Ask for nothing; let the user rename after they see the result.
2. **Free-text font fields** (§3.D.4) — should be a curated select.
3. **Gate configuration has no preview.** "Gate at page 3" gives no sense of what a
   reader will see.
4. **`GatingSchema.type` still offers `'password'`** though only email is implemented
   — a live enum value with no behaviour behind it (`lib/book-schema.ts`).

## 4.5 Components

**[O]** `components/ui/Modal.tsx` is a proper shared primitive (focus trap, Escape,
scroll lock, hydration-safe portal via `useSyncExternalStore`). **`ImportPDFModal` does
not use it** — it hand-rolls `createPortal` with no focus trap. That is the
highest-traffic modal in the activation path.

Other: icon-only controls without visible labels across `BookCard` (labelled with
`aria-label`, so screen readers are fine — sighted users must hover); two visually
distinct button systems (rounded-full uppercase-tracked in the studio, rounded-md in
the editor).

## 4.6 Feedback

**[O] Good:** save status that always says something plus an absolute last-saved
clock; two-phase import progress; partial-import warning; skeletons that hold layout;
destructive confirm dialog naming the object; `aria-live` page announcements in the
reader.

**Bad:**

- **The reorder/delete save failure reports the wrong cause** ("check your
  connection") for what is a constraint violation (§3.D).
- **No optimistic or undo affordance on publish** — a mis-click publishes a draft
  live; the only feedback is a toast.

## 4.7 Accessibility — the ones that actually affect use

**[O] Done well:** reduced-motion honoured in every animation primitive; 44px minimum
touch targets in the reader chrome; `aria-live` page announcements; `aria-pressed` on
toggles; `aria-current` on nav; the editor's status-bar contrast was deliberately
raised; keyboard hints surfaced in the reader; `sr-only` labels on the logo.

**Real problems:**

1. **`ImportPDFModal` has no focus trap** — keyboard focus escapes to the page behind
   during a multi-minute import. Fix: use the shared `Modal`.
2. **Block selection sets `pointer-events-none` on unselected block content**
   (`EditorCanvas.tsx`) — reaching a block's own interactive content by keyboard is
   inconsistent.
3. **Hotspot placement is mouse-only.** `hotspotMode` + a click at an x/y coordinate
   on the canvas. There is no keyboard path to create a hotspot at all — and hotspots
   are pitched as the core interactive feature.
4. **The fore-edge riffle is pointer-only** (hover to fan, drag to fly). It has
   keyboard alternatives (arrow keys, hints), so this is acceptable — but the *page
   list* should stay the accessible equivalent, not the riffle.

## 4.8 Responsive / mobile

**[O]** The reader is genuinely responsive (portrait single-page below 768px, measured
before mount so react-pageflip initialises in the right orientation — a good catch).
The editor below `lg` gets both panels back as bottom sheets, and auto-opens the
inspector on selection. The landing page is fully responsive.

**Gap [I]:** the **import** flow on mobile renders a whole PDF client-side at scale 2
via canvas. On a mid-range phone that is slow and memory-hungry, and the modal gives
no warning. Given that a share link is most often opened on a phone, some authors
*will* try to publish from one. Recommend: detect small screens/low memory, and either
lower the render scale or say "this works best on a laptop."

## 4.9 One naming decision, four surfaces

Pick **edition** (it is already `BRAND.md`'s chosen word, and it is the
differentiating frame — "editions, not exports"). Then change: "Create New QLICO" →
"Create an edition"; "Book title" → "Edition title"; dashboard "Books" stat → "Editions";
pricing "1 publication" → "1 edition"; "Books used" → "Editions used". Leave the
database table and the `/book/` URL alone — the URL is public and immutable, and the
table is invisible. **[I]** Cheap, and it makes the product sound like one thing.

---

# Phase 5 — Heuristic review

Only violations with real consequences. **Location → issue → consequence → fix.**

| # | Heuristic | Location | Issue → Consequence → Fix |
| --- | --- | --- | --- |
| 1 | **Value before commitment** | `/` → `/login` | Nothing can be tried without an email round-trip → the largest funnel drop, unmeasured → let visitors drop a PDF and see it rendered *before* signup (§7.3) |
| 2 | **Clear next action** | Post-publish (`EditorClient.handlePublishToggle`) | A toast is the entire moment → the step that creates all value (sharing) is unprompted → open the share modal on first publish |
| 3 | **Clear next action** | Analytics empty state | "No analytics data yet" with no action → the most common first analytics view is a dead end → add "Copy link and send it to one person" |
| 4 | **Error prevention** | Editor page reorder/delete | Client upsert vs. `UNIQUE(book_id, page_number)`; deletes never issued → silent data divergence and a misleading error → route through `PUT /api/books/[id]/pages` and apply migration 009 |
| 5 | **Consistency** | Product naming | book / edition / QLICO / publication for one object → users cannot tell whether these are different things → standardise on *edition* |
| 6 | **Consistency** | `ImportPDFModal` | Light-mode modal, hand-rolled portal, no focus trap, inside a dark editor → looks like a different product at the moment of highest anxiety → move to `components/ui/Modal` |
| 7 | **Recognition over recall** | Hotspot creation | Arm a `Crosshair` toggle, then click the page → the flagship feature is undiscoverable → add an empty-state affordance on the canvas ("Click anywhere to pin a hotspot") when a page has none |
| 8 | **Minimal cognitive load** | `CreateBookModal` | Three creation paths (Blank / PDF / Images), of which Images duplicates PDF with a weaker implementation → decision cost at step one → default to PDF, demote the rest |
| 9 | **User control** | Slug immutability | The public URL is permanent from the create modal → a typo is forever → allow editing with a 301 from the old slug, or say clearly in the field that it is permanent |
| 10 | **Fast time-to-value** | Import fields | Title + slug required before any rendering → delays the "wow" by a form → derive both, allow rename later |
| 11 | **Immediate feedback** | Save failure toast | "check your connection" for a constraint violation → user retries forever → surface the real cause |
| 12 | **Progressive disclosure** | `/account` | Seven entitlement rows, five unenforced → the account page teaches the user that plans are decorative → show only what is real |
| 13 | **Honest system status** | Pricing / FAQ | Custom domain, "your own infrastructure", "10×" → refund risk and lost trust when discovered → remove or build |
| 14 | **Easy recovery** | Publish toggle | One click, no confirm, no undo → an unfinished draft goes public → confirm on first publish only, or add "unpublish" to the toast |

---

# Phase 6 — Simplification plan

> *If we had to remove 30% of this interface, what should go?*

## Remove

| Item | Why | Effort |
| --- | --- | --- |
| **`Stats` section** on the landing page | Three unsourced numbers, one of them factually wrong | Trivial |
| **The "Images" creation path** (`CreateBookModal.handleBulkImageUpload`) | A second write path that inserts straight from the browser, bypassing `/api/books` validation and the friendly quota message. PDF + blank covers the same jobs. Its own code comments record two bugs this path shipped | Small |
| **`password` and `burn_after_reading`** in `BookSettingsSchema`, and `'password'` in `GatingSchema.type` | Controls are already gone; keeping dead fields invites someone to re-expose them | Trivial |
| **Free-text `headingFont` / `bodyFont`** | Produces editions that look different for the author than for readers | Small |
| **`/press`** | A press kit before there is press | Trivial |
| **`/create`** | Redirect stub; delete once links have decayed | Trivial |
| **`customDomain` from all pricing copy** | Until it exists | Trivial |
| **Dashboard stat cards** as-is | Books/Published/Pages measure the author's output, not their results | Small |

## Combine

- **`BookCard`'s seven controls → three**: `Open` (primary), `Share`, and an overflow
  menu holding View live / Insights / Rename / Delete.
- **Onboarding checklist 3 steps → 2**: *Publish your first edition* → *Share it*.
  Drop "Add a hotspot"; it is a feature, not a milestone.
- **`/analytics/[slug]` + a new cross-book view → one "Insights" surface** with a book
  switcher.

## Make defaults instead of options

- Import title and slug — derive from the filename, offer rename later.
- Theme preset — one good default; hide typography until a user asks.
- AI enhancement — on when available, silent when not (already close to this).

**Net effect [I]:** the create modal goes from 3 choices to 1 primary + 1 secondary;
the import modal from 4 inputs to 1 drop zone; the card from 7 controls to 3; the
landing page loses one whole section. Nothing a user needs is lost.

---

# Phase 7 — Activation & conversion

## 7.1 The aha moment

**[I] Not the flipbook.** The page-turn is impressive for about four seconds, and
every competitor has one.

> **The aha is the author opening their edition's Insights and seeing that a real
> person spent 40 seconds on page 6 — or seeing the first captured email address.**

That is the moment the product stops being a nicer PDF and becomes an instrument.
Everything in the roadmap below is arranged to shorten the distance to it.

## 7.2 Metrics

**Primary activation metric [I]:**

> **Activated = published an edition that received ≥1 reader session from a
> non-owner within 7 days of signup.**

**Supporting metrics:**

1. **Time to first published edition** (signup → `edition_published`).
2. **Share rate** — % of published editions whose link or embed was copied.
3. **First-read rate** — % of published editions with ≥1 `book_open` from a session
   that is not the author's.
4. **Enrichment rate** — % of published editions with ≥1 hotspot, gate, or data block
   (this is the leading indicator of a Pro upgrade, not of activation).

## 7.3 Time to value — where it goes, and how to cut it

**[I] Current best case, cold visitor to first read:**

| Step | Cost |
| --- | --- |
| Landing → login → **inbox round-trip** | 1–10 min, and the biggest single drop |
| Dashboard → create modal → pick PDF | ~30s |
| Title + slug form | ~30s + hesitation at "URL Slug" |
| Client render + upload | 30s–3min depending on the PDF |
| Land in the editor, orient | 1–5 min |
| Find and press Publish | ~30s |
| Realise they must press Share, copy, send | unbounded — many never do |

**Three cuts, in order of leverage:**

1. **Let the PDF be dropped on the landing page, before signup.** The renderer is
   already client-side (`lib/pdf-renderer.ts`) and needs no account. Render it, show
   it flipping in the hero frame, *then* ask for an email to save and publish it. The
   value is delivered before the commitment, and the email is now requested at the
   moment the user wants something. **[I] This is the single highest-leverage change
   available.**
2. **Delete the title/slug form from import.** Derive; rename later.
3. **Replace the publish toast with the share modal.** Publishing without sharing
   creates no value for anyone.

**[I] Result: cold visitor → live shared link in under two minutes with one email
entered at the moment of highest intent.**

## 7.4 Conversion leaks

| # | Stage | Evidence | Hypothesis | Fix | Metric to watch |
| --- | --- | --- | --- | --- | --- |
| L1 | Landing → signup | H1 is a brand line; no social proof of any kind; four audiences named **[O]** | Visitors can't tell if it's for them | Job-shaped H1, one audience above the fold, real proof | `landing_viewed` → `signup_started` |
| L2 | Signup → account | Magic link only **[O]** | Inbox round-trip loses a large share | Try-before-signup (§7.3); measure the gap first | `signup_started` → `signup_completed` |
| L3 | Account → first edition | Create modal offers 3 paths; import asks for a slug **[O]** | Decision + jargon friction | Default to PDF; drop the fields | `signup_completed` → `import_completed` |
| L4 | Edition → published | Publish is a small toolbar toggle **[O]** | Users don't realise they're done | Post-import "Publish now?" prompt; make Publish the primary editor action | `import_completed` → `edition_published` |
| L5 | **Published → shared** | Publishing fires only a toast; ShareModal is opt-in **[O]** | **The largest post-signup leak** | Share modal on first publish | `edition_published` → `share_link_copied` |
| L6 | Shared → first read | Reader has no CTA; watermark can be switched off free **[O]** | The growth loop is severed at both ends | Fix the watermark to plan-based; add a subtle reader CTA | `book_open` from non-owner sessions |
| L7 | Activated → retained | Leads and reads are invisible unless the author goes looking **[O]** | No return trigger exists | Weekly digest email + lead notification | 7/30-day return rate |
| L8 | Retained → paid | Only the book cap is enforced; every paid feature is free **[O]** | **There is no reason to pay** | Enforce entitlements against a re-drawn plan matrix (§7.5) | free → paid conversion |
| L9 | Paid intent → paid | "Lifetime $199" → `/redeem`; account "See plans" loops when Stripe is off **[O]** | Users who *want* to pay can't | Sell lifetime or relabel it; make the account page the plan surface | `checkout_started` → `subscription_started` |

## 7.5 The plan matrix, re-drawn

**[I] Recommendation.** Today's matrix paywalls the promise (PDF import) and gives
away the differentiators (gating, analytics depth, watermark). Invert it: **give away
everything needed to publish one great edition; charge for volume, for business
outcomes, and for looking like your own brand.**

| | Free | Pro $19/mo | Studio $49/mo |
| --- | --- | --- | --- |
| Editions | **3** (was 1) | Unlimited | Unlimited |
| **PDF import** | **✅** (was ✗) | ✅ | ✅ |
| Hotspots, data blocks, embeds | ✅ | ✅ | ✅ |
| Analytics retention | 30 days (was 7) | 12 months | 12 months |
| Watermark | **On, and not removable** | Off | Off |
| Lead gating + lead export | ✗ | ✅ | ✅ |
| CSV export | ✗ | ✅ | ✅ |
| Custom domain | ✗ | ✗ *(until built)* | ✅ *(when built)* |
| Seats | 1 | 1 | 3 |

Why each move:

- **PDF import free** — it is the promise on the hero and the fastest route to the
  aha. Charging for it kills activation to protect a feature competitors give away at
  their entry tier (Publuu from ~$7–15/mo, Flipsnack free tier includes flipbook
  creation).
- **3 free editions, not 1** — one abandoned import currently bricks a free account
  **[O]**, and one edition is not enough to form a habit.
- **Watermark enforced by plan** — restores both the upgrade reason and the growth
  loop. This is the *only* entitlement whose enforcement is urgent for growth rather
  than revenue.
- **Lead gating paid** — it is the feature with the clearest business value, and it is
  where the closest competitor charges (Flipsnack puts lead capture on its
  Professional tier at ~$38–52/mo).
- **Analytics 30 days free** — 7 days is too short for the aha to land; 30 is enough
  to hook and short enough to sell against.

**[V] The $19 price point is unvalidated.** It undercuts Issuu ($27–59/mo), Flipsnack
($16–85/mo annual) and FlippingBook (from $26/mo). Cheap is a weak moat against
incumbents with a decade of SEO. Test $29 for Pro once the value is provable.

---

# Phase 8 — Analytics plan

## 8.1 What exists

**[O] Reader-side (excellent, in Supabase):** `book_open`, `page_view`, `page_flip`,
`hotspot_click`, `modal_open`/`close`, `video_play`/`complete`, `audio_play`,
`cta_click`, `book_complete`, `page_click` (heatmap), `gate_view`, `gate_unlock`. Rate
limited, keepalive-flushed on unload, session-scoped.

**[O] Product-side (thin, in Vercel Analytics):** exactly four events —
`cta_click`, `demo_open`, `signup_magic_link_sent`, `edition_published`. **Between
"magic link sent" and "edition published" the funnel is dark.** Every leak in §7.4
from L2 to L5 is currently unmeasurable.

**[O] Two known data risks:**

- Migration `009_add_gate_view_event.sql` may be unapplied in production
  (`HANDOVER.md` §1). If so Postgres rejects every `gate_view` insert and the gate
  conversion rate silently reads 0% — the exact number needed to sell lead gating.
- `/api/analytics/[slug]` returns `raw: events` — **every event row** — to the browser.
  Fine at 500 events, a problem at 500,000. **[I]** Move CSV export server-side before
  a popular edition exists.

## 8.2 Proposed product event taxonomy

Sixteen events. Not "everything" — just enough to see the funnel and the loop.

| Event | Trigger | Why it matters | Properties |
| --- | --- | --- | --- |
| `landing_viewed` | Landing page mount | Funnel denominator | `referrer`, `variant` |
| `demo_opened` | A demo edition opened from `/` | Does proof work? | `edition`, `location` |
| `try_upload_started` | PDF dropped pre-signup (§7.3) | Intent before commitment | `page_count`, `file_mb` |
| `try_preview_shown` | Pre-signup render completes | The pre-signup aha | `render_ms`, `page_count` |
| `signup_started` | Login form submitted | Top of auth funnel | `next`, `source` |
| `signup_completed` | First successful `/auth/callback` | **Measures the inbox gap** | `minutes_since_started` |
| `edition_create_started` | Create modal opened | Intent to build | `path`: blank\|pdf |
| `import_started` | Import submitted | Import funnel top | `page_count`, `file_mb`, `ai` |
| `import_completed` | `/finalize` returns OK | Core action complete | `pages_landed`, `pages_failed`, `duration_ms` |
| `import_failed` | Any import error path | The biggest activation risk | `phase`, `reason` |
| `edition_enriched` | First hotspot / gate / data block saved | Predicts upgrade intent | `kind`, `edition_id` |
| `edition_published` | Draft → published | Milestone (exists today) | `edition_id`, `page_count`, `minutes_since_signup` |
| `share_link_copied` | Copy in ShareModal | **The value-creating step** | `kind`: link\|embed, `edition_id` |
| `first_reader_open` | First non-owner `book_open` per edition | **Activation** | `edition_id`, `hours_since_publish` |
| `lead_captured` | Successful `/api/books/unlock` | Monetisable outcome | `edition_id`, `page_number` |
| `upgrade_viewed` | Plan wall or pricing shown in-app | Monetisation funnel top | `trigger`, `plan` |
| `checkout_started` | Stripe checkout created | Payment intent | `plan`, `trigger` |
| `subscription_started` | Stripe webhook confirms | Revenue | `plan`, `days_since_signup` |

## 8.3 The funnel

```
landing_viewed
  → try_upload_started        (new, pre-signup)
  → signup_started → signup_completed
  → import_completed
  → edition_published
  → share_link_copied
  → first_reader_open         ★ ACTIVATION
  → lead_captured / repeat publish
  → upgrade_viewed → checkout_started → subscription_started
```

## 8.4 The four numbers

- **Activation:** % of signups reaching `first_reader_open` within 7 days.
- **Retention:** % of activated authors who publish or open Insights in week 4.
- **Monetisation:** free → paid conversion within 60 days; ARPA; LTD refund rate
  (< 10% target, per `APPSUMO_LAUNCH.md`).
- **North star [I]: weekly active editions** — editions with ≥1 reader session in the
  last 7 days. It rises only when authors publish *and* readers read, which is the
  entire business in one number.

---

# Phase 9 — Positioning

## 9.1 ICP

**[I] Recommended beachhead — the wholesale/DTC brand or the studio that sells from a
catalog.**

- **Role:** founder, marketing lead, or sales lead at a 2–30 person brand; or the
  freelancer/studio producing their seasonal collateral.
- **Context:** every season they produce a catalog, line sheet, or lookbook as a PDF
  in InDesign or Canva and email it to buyers, stockists, or their list.
- **Pain:** the file leaves and nothing comes back. No idea who opened it, which
  products held attention, or who is close to ordering. Buyers reply by email asking
  for prices and availability that were already in the PDF — and are now stale.
- **Existing workaround:** attach the PDF; put it on Dropbox/Drive; sometimes an Issuu
  or Flipsnack embed; follow up by hand.
- **Urgency:** seasonal and real — a launch date exists.
- **Willingness to change:** high for the *sending* step (zero workflow change: they
  keep InDesign, they change what they send), low for the *design* step.

**Why this ICP and not "creators":** it is the only segment where all three of
QLICO's unusual capabilities compound — checkout hotspots turn a page into an order
form, data blocks keep prices and stock current after publish, and the lead gate turns
a catalog into a list. For a portfolio or a report, only one of the three matters.

**[V] This is a hypothesis derived from the schema, not from customers.** It is
hypothesis H1 in §11 and the first thing to test.

**Secondary ICP [I]:** agencies/consultants sending proposals and reports who want
white-label output and per-page attention data. This is the LTD buyer and probably
where AppSumo revenue actually comes from — but it is a worse *product* wedge because
proposals are one-to-one and produce no growth loop.

## 9.2 Problem statement

> **A small brand's sales lead struggles to turn a seasonal catalog into orders,
> because once the PDF is emailed it goes dark — no signal about who opened it, what
> they lingered on, or what to follow up — which means every follow-up is a guess and
> most of the catalog's pipeline is never worked.**

## 9.3 Value propositions

1. *"Send your catalog as a link, and find out who read it, what they lingered on,
   and who's ready to buy."*
2. *"Your PDF, but it captures emails, takes orders, and tells you which page did the
   work."*
3. *"Stop attaching PDFs. Start sending editions you can measure."*
4. (Short) *"The catalog that reports back."*

## 9.4 Positioning statement

> **For** small brands and studios who send catalogs, lookbooks and proposals as PDFs,
> **QLICO** is an **interactive publishing tool** that **turns the file into a shareable
> edition that captures leads, takes orders in-page, and shows exactly which pages held
> attention**. **Unlike** flipbook tools like Issuu and Flipsnack, which stop at a
> nicer-looking PDF, **QLICO treats the edition as a live surface — prices and stock
> stay current after publish, and every page is a place to sell.**

## 9.5 Messaging hierarchy

1. **Headline:** *"Send a catalog. Get orders and answers back."*
   (Alternative, broader: *"Your PDF, but you can see who read it."*)
2. **Support:** *"QLICO turns a PDF into an interactive edition — shoppable hotspots,
   email capture, live prices — with a link you can send anywhere and analytics on
   every page."*
3. **Primary CTA:** **Drop your PDF** (not "Start for free" — the action, not the
   commitment; see §7.3).
4. **Three benefits:**
   - **See who's reading.** Opens, dwell time, completion, and a click heatmap for
     every page.
   - **Sell from the page.** Pin a product with a price and a checkout link — no
     detour to a store.
   - **Stay current after publishing.** Bind prices, stock and dates to live data;
     the edition updates itself.
5. **Proof concept:** three live demo editions you can flip without signing up
   (already built), plus — once earned — "N editions published this month" and one
   named customer per vertical. **Replace the unsourced "10×" with something true.**
6. **Objection handling:**
   - *"I already have a flipbook tool"* → "Yours makes a nicer PDF. This one takes
     orders and tells you which page sold them."
   - *"Will my link still work in two years?"* → publish an explicit data-and-export
     commitment; CSV export of every event and every lead, any time.
   - *"Do my readers need an app?"* → No. A link, any browser, works on phones.
   - *"Is my document private?"* → Say precisely what unlisted does and does not do.
     **Do not re-introduce password protection until it is real** (`HANDOVER.md` §4).

---

# Phase 10 — Competitive & market landscape

Prices are as reported by public sources in 2026; verify before quoting them in
marketing.

## 10.1 Matrix

| Competitor | Target user | Core promise | Pricing (2026) | Key workflow | Strength | Weakness | Opening for QLICO |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Issuu** | Publishers, marketing teams | Publish and distribute digital publications | ~$27/mo (Essential, annual) to ~$59/mo (Optimum); reported to have risen ~440% since 2019 | Upload PDF → hosted reader + distribution network | Brand, SEO, discovery network, longevity | Repeated price rises are a live grievance; feels like a publishing archive, not a sales tool | Price stability and a sales-outcome frame; target their upgrade-shocked users |
| **Flipsnack** | Designers, marketing teams | Design-first digital catalogs | Free tier; ~$16/mo (Starter, annual) → ~$38 Pro → ~$85 Business → ~$258 Team | Full drag-drop editor + templates | Deepest editor; templates; team features | Lead capture, analytics and white-label sit behind the ~$38+ Professional tier; heavy tool for a simple job | **Lead capture at a lower price point**, plus in-page checkout they don't offer |
| **Publuu** | SMBs, solo marketers | Fastest PDF → clean flipbook | From ~$7–15/mo | Upload PDF → flipbook with hotspots | Simplicity, price, high satisfaction scores | Shallow beyond the flip; limited commerce/data features | Depth for the same simplicity: same 60-second import, but the edition sells and reports |
| **FlippingBook** | Sales teams, B2B | Trackable documents for sales | From ~$26/mo; Publisher desktop ~$699 one-time | Upload → track → share with prospects | Strongest sales-tracking framing in the category | Expensive; renewal complaints; dated feel | Same tracking promise at a third of the price, with commerce built in |
| **Canva / Adobe Express** | Everyone | Make the document | Bundled | Design → export/share | Where the document is already made | The output is still a file or a passive link; no reader analytics or gating | **Be the step after Canva**, never a Canva competitor. Integration, not rivalry |
| **Shopify / catalog apps** | E-commerce | Sell products | Bundled | Store pages | Real commerce | Not a document; no catalog reading experience | Sit beside them: the edition sends buyers into the store |

## 10.2 Status-quo competitors — the real ones

**[I]** The realistic alternatives are, in order of how often they win:

1. **Emailing the PDF.** Free, universal, and the default. Beating it requires the
   benefit to be visible in the first send, not after a workflow change.
2. **A Google Drive or Dropbox link.** Free, and gives a crude "was it opened" signal.
3. **A landing page built in Webflow/Framer.** Better for SEO, far more work, no
   page-by-page reading data.
4. **Doing nothing** — sending fewer, later. Always the biggest competitor.

## 10.3 Market patterns and gaps

**[O/I] Standard expectations** (table stakes; QLICO has all of them): PDF import,
hosted link, embed code, hotspots/links, basic analytics, mobile reader, custom
branding on paid tiers.

**Patterns worth noting:**

- The category monetises on **lead capture, analytics depth, branding removal, and
  seats** — exactly the entitlements QLICO defines and doesn't enforce. The pricing
  instinct in `lib/plans.ts` is right; only the enforcement is missing.
- **Price is being pushed both ways**: Publuu from ~$7, Issuu to ~$59. The middle
  ($19–39) is crowded. Differentiation, not price, has to carry this.
- **Nobody in the flipbook category leads with commerce.** Checkout hotspots + live
  price/stock binding is a genuine gap — and it is already built here.

**Market risk [O, external]:** independent analyses of AppSumo report that roughly a
third to 40% of lifetime deals fade, pivot, or shut down within three years, and that
refunds default to AppSumo credit. LTD buyers know this and price it into their
scepticism. Publishing a roadmap and answering Q&A within hours (as
`APPSUMO_LAUNCH.md` §6 already plans) is the counter.

**Sources:**
[Flipbook software pricing comparison 2026 — ZenFlip](https://zenflip.io/en/flipbook-software-pricing) ·
[Flipsnack pricing 2026 — ZenFlip](https://zenflip.io/en/blog/flipsnack-pricing-2026) ·
[Publuu vs Flipsnack — FlipLink](https://fliplink.me/blog/publuu-vs-flipsnack) ·
[Issuu alternatives — FlipLink](https://fliplink.me/blog/issuu-alternatives) ·
[FlippingBook reviews — G2](https://www.g2.com/products/flippingbook/reviews) ·
[Publuu reviews — Capterra](https://www.capterra.com/p/214310/Publuu/reviews/) ·
[AppSumo review 2026 — Truescho](https://truescho.com/en/blog/appsumo-review-2026)

---

# Phase 11 — Customer research plan

Executable by one founder in two weeks. No research team.

## 11.1 Who to talk to (5 × 5 people)

1. **Brand/wholesale sellers** who emailed a catalog or line sheet in the last 90 days.
   *Find them:* Instagram/faire-style brand accounts, trade-show exhibitor lists,
   wholesale Slack/Discord groups.
2. **Agencies & design studios** who produced a client's catalog or report recently.
   *Find them:* Dribbble/Behance case studies, LinkedIn.
3. **Existing flipbook-tool users** (Issuu/Flipsnack/Publuu). *Find them:* the
   "Powered by" footers on published flipbooks; G2 reviewers.
4. **People who publish reports** — small consultancies, research teams. *Find them:*
   the PDFs themselves, via search.
5. **Anyone who already signed up to QLICO** (highest signal, once there are any).

## 11.2 Script — 10 questions, all about the past

1. Tell me about the last document you sent out to more than ten people. What was it?
2. Walk me through what happened after you hit send. What did you do next?
3. How did you find out whether anyone read it? (*If "I didn't" — how did that feel,
   and what did you do instead?*)
4. What did you *want* to know about how people read it?
5. What happened next with the people who did engage — how did that follow-up work?
6. What tools were involved, start to finish? Which part took the longest?
7. Has anything ever gone wrong with one of these sends? Tell me about that time.
8. How often does this happen — weekly, per season, per launch?
9. What happens to your business if this stays exactly as it is for another year?
10. Have you ever paid for a tool to help with this? What made you buy — or not?

*Closing:* "Can I see the last one you sent?" — the artifact tells you more than the
interview.

**Avoid:** "Would you use a tool that…", "Do you think analytics would help?", any
question containing the word *flipbook* before they say it.

## 11.3 Hypotheses to validate, ranked by damage-if-wrong

| # | Belief | Damage if wrong | How to test |
| --- | --- | --- | --- |
| **H1** | Someone will pay for **knowing who read a document** | **Fatal.** Analytics is the core promise, the retention loop, and the north star | Interviews Q3–Q5; then: does anyone open Insights twice? |
| **H2** | The catalog/wholesale ICP (§9.1) is the right beachhead | Severe — misdirects positioning, GTM and roadmap for months | 15 interviews split across ICP 1 and 2; compare intensity of Q9 answers |
| **H3** | Reading a PDF as a flipbook is *better*, not merely different | Severe — the whole reader premise. Some readers prefer scrolling | Ship a scroll-mode toggle as an experiment; compare completion rates |
| **H4** | Lead gating is worth paying for | High — it is the anchor paid feature in the re-drawn matrix | % of published editions that enable it, once it's paid |
| **H5** | In-page checkout is a real differentiator, not a curiosity | High — it is the sharpest differentiator claimed in §9 | Count `hotspot_click` on `action:'checkout'` hotspots per edition |
| **H6** | Magic-link-only auth is not a serious barrier | High — silently costs signups today | Instrument `signup_started` → `signup_completed`; A/B add Google OAuth |
| **H7** | $19/mo is the right Pro price | Medium — recoverable | Price test at $29 once value is provable |
| **H8** | Authors will share the link if prompted | Medium — assumed by the whole activation plan | `share_link_copied` rate before/after the post-publish share modal |
| **H9** | AppSumo LTD buyers convert into advocates rather than support load | Medium | Refund rate, Q&A volume, Taco rating in the first 30 days |

---

# Phase 12 — Go-to-market

Deliberately small. Two channels, not eight.

## 12.1 Beachhead

**ICP:** small wholesale/DTC brands (2–30 people) who send a seasonal catalog or line
sheet.
**Use case:** *the seasonal catalog send* — one document, a known list, a known date,
and a business outcome (orders) that is easy to attribute.

**Why this use case creates pull:** it recurs on a calendar, the sender already feels
the pain of silence, no workflow changes (they keep designing wherever they design),
and the output is public — every catalog sent is a piece of distribution.

## 12.2 Why they should switch

> "You are already making the catalog. Sending it through QLICO costs you two minutes
> and gets you: the buyers' email addresses, the pages they lingered on, and an order
> button on every product. Your PDF gets you a delivery receipt."

## 12.3 Channels — pick three, ignore the rest

### 1. Founder-led outreach (weeks 1–8) — *the only channel that also does research*

- **Why it fits:** the ICP is enumerable (trade-show exhibitor lists, wholesale
  directories, Instagram brand accounts) and the pitch is visual.
- **What to produce:** for each of 10 target brands, **take their existing public PDF
  catalog and publish it as a QLICO edition, unasked.** Send the link. That is the
  demo, the pitch, and the case study in one message. The repo already supports this
  — import, publish, share.
- **Cadence:** 10 personalised sends per week.
- **Working when:** ≥20% reply rate, ≥3 of 10 open their own edition's analytics.

### 2. Product-led sharing loop (permanent) — *the only compounding channel*

- **Why it fits:** every published edition is a public page carrying "Powered by
  QLICO" (`ViewerChrome.tsx:288`). Readers of a catalog are exactly the profile of the
  next author.
- **Prerequisite [O]:** **fix the free `whitelabel` toggle** (§0.2) or the loop is
  severed at source.
- **What to produce:** make the watermark good — a small "Made with QLICO · make yours"
  that lands on a page pre-loaded to "drop your PDF" (§7.3), not on the generic home.
- **Cadence:** none — it runs on publishing volume.
- **Working when:** ≥3% of unique readers click the badge; ≥1 signup per 10 published
  editions.

### 3. AppSumo LTD (one-off burst) — *cash, reviews, and a stress test*

- **Why it fits:** the backbone is built and tested (`lib/appsumo.ts`, 273 lines of
  tests) and the audience is agencies and solo marketers — ICP 2.
- **Do not launch until** entitlements are actually enforced (§7.5). Selling tiered
  entitlements that the product does not enforce is both a refund magnet and, once
  discovered, a public embarrassment in the Q&A.
- **Working when:** refund rate < 10%, Taco ≥ 4.6, ≥40% of redeemers publish an
  edition within 7 days.

**Explicitly deprioritised for now:** SEO/programmatic (Issuu and Flipsnack own these
terms with a decade of authority — revisit in month 6 with comparison pages), paid
ads (no proven LTV), Product Hunt (worth doing once, but after activation is fixed —
a PH spike into the current funnel wastes the one launch you get).

## 12.4 Launch stages

**Stage 1 — 10 users (weeks 1–4).** Hand-recruited via the "we published your catalog
for you" play. Onboard each personally, watch a real session, keep a shared doc of
every hesitation. Success: 7 of 10 publish; 5 of 10 share a link; 3 of 10 come back to
Insights unprompted.

**Stage 2 — 50 users (weeks 5–10).** Repeatable version of the same play plus the
try-before-signup flow live on the landing page. Success: activation (§7.2) ≥ 35%; ≥5
paying; the funnel from §8.3 fully instrumented and legible.

**Stage 3 — 200 users (weeks 11–20).** AppSumo launch (entitlements enforced) +
double down on whichever of outreach/loop produced better activation. Success: ≥100
weekly active editions; refund rate < 10%; one written case study per vertical.

## 12.5 The GTM loop — and it is real, if you let it be

```
Author publishes an edition
  → sends the link to buyers / clients / their list
  → readers open a public page carrying "Powered by QLICO"
  → some readers are themselves people who send documents
  → they click through to a page that says "drop your PDF"
  → they see their own document as an edition before signing up
  → they publish → repeat
```

**[O] Today the loop is broken in two places:** any free user can switch off the
badge, and the badge links to a generic marketing page rather than a try-it flow. Both
are small fixes. **[I] This is the only channel in the plan that gets cheaper over
time — protect it.**

---

# Phase 13 — Experiment backlog

Each experiment is a hypothesis with a decision attached. Effort: S ≤ 1 day, M ≤ 1
week, L > 1 week.

| # | Experiment | Hypothesis | Change | Primary metric | Guardrail | Effort | Impact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **E1** | Try before signup | Removing the inbox round-trip before first value lifts signups substantially | Landing drop-zone → client render → preview → "save it" → magic link | `landing_viewed` → `signup_completed` | Mobile render time; error rate | **L** | **Very high** |
| **E2** | Share on publish | Publishing without sharing produces nothing; prompting it lifts activation | Replace the publish toast with the ShareModal | `edition_published` → `share_link_copied` | Publish rate unchanged | **S** | **Very high** |
| **E3** | Enforce the re-drawn plan matrix | There is no reason to pay today | Server-side entitlement checks; watermark by plan; free tier → 3 editions, PDF import free | free → paid conversion | Free-tier activation must not drop | **M** | **Very high** |
| **E4** | Job-shaped headline | The H1 doesn't say who it's for | A/B "Flip through anything." vs. "Send a catalog. Get orders and answers back." | Landing → `signup_started` | Bounce rate | **S** | High |
| **E5** | Kill the import form | Title + slug before value costs imports | Derive both from the filename; rename later | `edition_create_started` → `import_completed` | Slug-collision 409 rate | **S** | High |
| **E6** | Promote Insights to nav | The retention asset is invisible | "Insights" nav item + read counts on book cards | 7-day return rate | — | **S** | High |
| **E7** | Lead notification email | Leads are worthless if the author doesn't know | Email the author on `gate_unlock`; weekly digest | 30-day retention of gating authors | Unsubscribe rate | **M** | High |
| **E8** | Fix the growth loop | A free-removable watermark severs PLG | Watermark by plan; badge → try-it page with UTM | Signups attributed to `via=watermark` | Free-tier complaints | **S** | High |
| **E9** | Sell Lifetime | People clicking the third column want to buy | Stripe one-time price, or relabel to the real AppSumo link | `checkout_started` from pricing | Refunds | **S** | Medium |
| **E10** | Real proof on the landing page | No social proof caps conversion at curiosity | 3 named design-partner editions + quotes, replacing `Stats` | Landing → signup | — | **M** | Medium |
| **E11** | Google OAuth | Magic link is a bigger barrier than assumed | Add one OAuth button beside the magic link | `signup_started` → `signup_completed` | Support load | **M** | Medium |
| **E12** | Onboarding = publish + share | The hotspot step is the product's agenda, not the user's | 3 steps → 2 | Time to `edition_published` | Enrichment rate | **S** | Medium |
| **E13** | Scroll mode toggle | Some readers prefer scrolling to flipping (H3) | Reader toggle; measure completion by mode | `book_complete` rate per mode | — | **M** | Medium |
| **E14** | Post-import publish prompt | Users don't know they're finished | "Looks good — publish it?" after import lands | `import_completed` → `edition_published` | Accidental publishes | **S** | Medium |
| **E15** | Price test $29 Pro | $19 undervalues an instrumented outcome | New signups see $29 | Revenue per signup | Conversion rate | **S** | Medium (after E3) |
| **E16** | Reader CTA | Readers are the best acquisition source | Subtle end-of-edition "Make one like this" | Reader → signup | Author complaints; completion rate | **S** | Medium |

---

# Prioritised roadmap

Sequenced by *what unblocks what*, not by size. Effort is one engineer.

## P0 — Truth and integrity (week 1). Nothing else should ship first.

These are the changes without which measurement lies, the paywall is fiction, and the
marketing is unsafe.

| # | Change | Status | Why now | Effort |
| --- | --- | --- | --- | --- |
| 1 | **Remove or correct the unsupportable claims** — "10×", "your own infrastructure"/"your own Supabase project", custom domain in all three places | **Done** — `Stats` section deleted; FAQ answer rewritten as an ownership/export promise; custom domain out of `Pricing`, `Faq`, `FeaturesBento`, `account` and `MARKETING.md` | Refund and trust risk | S |
| 2 | **Fix the Lifetime dead end** | **Done** — the column now says it is an AppSumo lifetime deal and its CTA is "Redeem your code" | Every visitor who picks column 3 hit a wall | S |
| 3 | **Fix page delete + reorder persistence** | **Done** — autosave routes through `PUT /api/books/[id]/pages`; the duplicate non-atomic `PUT /api/books/[id]` was deleted. *Migrations `009`/`010` still need applying* | Silent data divergence in the core loop | M |
| 4 | **Fix the watermark to be plan-driven** | **Done** — `readerPolicy()` decides the badge and the gate from the owner's plan in the reader, the embed and `/api/books/unlock`; the editor toggle locks without the entitlement | Restores both the upgrade reason and the growth loop | S |
| 5 | **Instrument the product funnel** (§8.2) | **Done** — `lib/product-analytics.ts`; `signup_completed` carried across the auth callback by `SignInTracker` | Every decision below needs this data | M |

## P1 — Activation (weeks 2–5). The user has to reach the aha.

| # | Change | Status | Effort |
| --- | --- | --- | --- |
| 6 | **Share modal on first publish** (E2) | **Done** — publish saves, waits for the save to land, then opens the share dialog | S |
| 7 | **Strip the import form; derive title and slug** (E5) | **Done** — both derived from the filename, editable behind a disclosure; a taken slug retries itself with a suffix | S |
| 8 | **Insights in the nav + read counts on cards** (E6) | **Done** — new `/insights` across all editions; cards show readers, completion and emails | S |
| 9 | **Analytics empty state with a share action** | **Done** — hands over the live link with a copy button, or points a draft at the editor | S |
| 10 | **Re-draw and enforce the plan matrix** (§7.5, E3) | **Done** — matrix re-drawn as proposed and enforced server-side; the account page lists only what is checked | M |
| 11 | **Onboarding → publish + share** (E12) | **Done** — create → publish → send it to one person, ending at the activation event | S |
| 12 | **Import modal onto the shared `Modal`; dark-mode it** | **Done** — rebuilt on the primitive (focus trap) with theme tokens | S |
| 13 | **Rename everything to *edition*** (§4.9) | **Done** — table and public `/book/` URL unchanged | S |

## P2 — Retention and revenue (weeks 6–12)

| # | Change | Status | Effort |
| --- | --- | --- | --- |
| 14 | **Try-before-signup on the landing page** (E1) | **Done** — drop a PDF, flip it in the real reader, sign in only to keep it; the file crosses the magic link in IndexedDB | L |
| 15 | **Lead notification** (E7) | **Done** — optional transactional email on gate unlock (`lib/email.ts`), keyless installs unaffected. *Weekly digest not built* | M |
| 16 | **Move CSV export server-side; stop returning `raw` events** | **Done** — `/api/analytics/[slug]/export`, row-capped, and where `csvExport` is enforced | M |
| 17 | **Real social proof; delete `Stats`** (E10) | **Partial** — `Stats` deleted. Social proof needs real customers | M |
| 18 | **Simplification plan** (Phase 6) | **Mostly done** — image path, dead schema fields, free-text fonts and the card's action overload all gone. `/press` and `/create` kept, see the note at the top | M |
| 19 | **Stripe dunning limit on `past_due`** | **Done** — migration `011` records the dunning start; `effectivePlan` expires it; the webhook also drops out-of-order events | S |
| 20 | **Hotspot discoverability + keyboard path** | **Done** — on-canvas prompt, Enter to place, arrows to nudge | M |

## P3 — Only after the above earns it

Custom domain (build it or stop selling it); teams/seats; template gallery; Canva/Drive
import; Shopify product sync for checkout hotspots; app-store packaging
(`LAUNCH.md`) — which is a distribution project, not a product one, and should not
precede activation work.

---

## What this audit could not determine

- **Any real usage data.** No analytics history, no user list, no revenue. Every
  funnel number in this document is a hypothesis with a place to put the real one.
- **Whether the pending migrations (`009`, `010`) are applied in production.**
  `HANDOVER.md` says they were never applied from the session that wrote them. If
  `009` is missing, the gate funnel silently reads zero.
- **Whether Stripe is live.** Billing UI activates only when the keys are set, and the
  account page's fallback is a loop back to the pricing section.
- **Whether the test suite passes.** `node_modules` is not installed in this
  environment, so the "89 tests passing" baseline in `HANDOVER.md` was not re-verified
  here.
- **Real reader behaviour.** Whether page-flipping beats scrolling for completion is
  the product's founding premise and is untested (H3).
