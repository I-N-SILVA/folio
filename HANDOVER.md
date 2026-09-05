# Handover

State of QLICO after the `claude/product-analysis-ux-m6irp4` work, which follows
the earlier `claude/product-strategy-audit-xt5fdi` branch. Written for whoever
picks this up next — human or agent.

Four documents carry the reasoning, and they are worth the twenty minutes:

| Document | What it is for |
|---|---|
| `docs/product-proof-2026-09.md` | What was wrong, with a file:line behind every claim |
| `docs/editor-redesign-spec.md` | What to build, marked SHIPPED / PARTIAL / NOT STARTED, with a §9 of what is left |
| `docs/mvp-scope.md` | **Read this first.** What the product *is*, what was cut and why, and what to do instead of building |
| `docs/product-strategy-audit.md` | The earlier audit; positioning, pricing and GTM |

Verification baseline: **180 tests across 26 files passing, 0 lint errors, 39
lint warnings, `tsc --noEmit` clean, production build clean.**

```bash
npm run typecheck && npm test -- --run && npm run lint && npm run build
```

`npm run format:check` still fails on files that predate this work — the repo has
never been Prettier-clean. New and touched files are formatted; the rest is left
alone rather than buried under a whole-repo reformat.

---

## 1. Do these before launch — nothing else on this list matters more

### Apply the pending migration

One consolidated migration may not be applied. Check what's actually live before assuming.

Every one of these degrades rather than breaks, and each logs which file to
apply. Grep for `is missing` and `apply supabase/migrations` in production logs.

| Migration | Consequence if missing |
|---|---|
| `009_post_audit_features.sql` | The database will miss several key features including: Gate view events, atomic page saving, dunning grace periods, edition engagement insights, weekly digests, and slug history. |
| `011_fix_pages_layout_check.sql` | **Two page layouts cannot be saved at all.** The `pages.layout` CHECK has allowed four values since 002, while the editor's dropdown has always offered five — an author choosing "Grid" got "Could not save these pages" and no clue why. `canvas` is the sixth and does not work without this. |

### Configure what's optional

Five settings are optional at deploy time and each degrades by design. Know which
are on:

| Env | Without it |
|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | The import's "find products and write descriptions" option is hidden. |
| `RESEND_API_KEY` + `EMAIL_FROM` | No lead notifications. A captured email is only visible in Insights. |
| `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PRICE_PRO` | No self-serve upgrade. `/account` falls back to a link to the pricing section. |
| `CRON_SECRET` | The weekly digest route refuses every request. It **fails closed deliberately** — without it the endpoint would be an unauthenticated way to make the app email its own users. Vercel Cron sends it as `Authorization: Bearer`; the schedule is in `vercel.json`. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | `/help` shows `support@qlico.app`. |

### Authorize the Sentry and Stripe MCP servers

Both need OAuth via claude.ai connector settings. Without them there is no error
reporting and no way to exercise the billing paths.

---

## 2. What changed most recently, and the reasoning you'd otherwise rediscover

### Six features did nothing, and four of them had passing tests

The single most useful thing to know about this codebase. Removed this branch:

| Removed | What it actually did |
|---|---|
| `CheckoutModal` | Took a card number, waited 1.8s, invented an order number, confirmed a sale that never happened |
| The cart | Four paths fed a bag whose only destination was that checkout |
| `ButtonBlock` magic hrefs | `#cart` / `#buy` silently added an item at an invented $120 |
| Language picker | `getTranslation` was imported and never called — picking a language moved a checkmark |
| `ReviewDrawer` | Took a client's typed feedback into React state and dropped it on refresh |
| `SocialTeaserModal` | Built a download link, never clicked it, then toasted "Downloaded!" |

Four had tests. **Every one of those test files reimplemented the logic locally
and asserted against its own copy** — `lib/cart.test.ts` defined
`addToCartHelper`, `lib/review.test.ts` defined `addCommentHelper`. Green suites,
dead code. Two of the six shipped in a single commit (49dc294) that added five
features at once; two of that five did nothing.

**If you take one habit from this branch: a test that does not import the
shipped path is not a test.** And keep grepping for unimported files — that is
how four of these were found.

### Commerce is cut, deliberately

QLICO handles no payments. A product is a listing that links to the author's own
shop. No cart, no checkout, no payouts, no PCI scope, no Stripe Connect, and
nothing to meter in `lib/plans.ts`. If it is ever revisited, it is Connect
against the *author's* account, orders in the database and a Sales tab — and it
needs a plan entry on the way in. See `docs/mvp-scope.md` §2.

### One token turned six controls invisible

`--accent`, `--accent-vivid`, `--qlico-teal` and `--qlico-oxblood` are all
`#000` in light and `#fff` in dark. The editor used `--accent-vivid` for
interface state while drawing author content on a white page, so with dark theme
on the selection ring was white on white, and the reader's buy-pin icon was
white on a white beacon.

`globals.css` now defines a `--studio-*` palette plus **`--studio-select`, a
functional interaction colour used for selection, drag targets and focus rings
and used nowhere in author content.** A monochrome brand accent cannot mark a
selection on a white page; that is a job it can never do. **Do not reach for
`--accent*` or `--qlico-teal` for UI state.**

### The editor stopped promising what it could not do

The canvas drew a free-composition page and ran a vertical block list. There is
now a per-page `layout: 'canvas'` mode with an optional `frame` on every block,
honoured only in that mode, so no existing page changes and there is no
migration. Switching seeds frames by **measuring the live flow layout**, so a
page never scatters, and switching back is lossless.

Phones stack via **one CSS container query** (`.qlico-canvas-block`, in
`globals.css`) rather than a viewport breakpoint — so the reader, the embed, the
thumbnails and the editor's mobile simulator all obey the same rule.

Also: a spread view (the reader shows facing pages; the editor only ever showed
one), one insert surface reachable by `/` and `+`, empty media blocks backed by
`lib/publish-checks.ts`, the post-import detection step, and `/gallery` — six
readable editions rendered from `data/templates.ts` with no database rows.

### The detector was open to the internet

`/api/ai/detect-hotspots` had no authentication, only a per-IP request count,
and it fetches an author-supplied URL server-side and calls Gemini. It is now
signed-in only, budgeted per user and charged per page, and the fetch refuses
loopback, link-local, RFC1918, `.internal` and cloud metadata addresses.

---

## 2b. What changed on the previous branch

### The plans were decorative

`lib/plans.ts` declared eight entitlements and the server checked exactly one
(`maxBooks`). Lead gating, CSV export, analytics retention and the watermark were
sold on the pricing page and handed to every free account; `customDomain` was sold
in three places and had no implementation at all.

The catalog was **re-drawn as well as enforced**, because enforcing it as written
would have paywalled PDF import — the promise in the hero. Import is unmetered
now; Free carries three editions and 30 days of analytics; paid plans sell what
happens *after* the first read (email capture, exports, longer history, badge
removal). **The rule is written at the top of `lib/plans.ts`: every key in that
file is checked somewhere on the server. If you add one, add its check in the same
change.**

Enforcement lives in `readerPolicy()` (`lib/entitlements.ts`), called by the
reader, the embed and `/api/books/unlock`. **The important trap: `settings.whitelabel`
and `settings.gating.enabled` are author-controlled booleans the editor writes
straight to the database.** Reading either as authority is what let a free account
switch off the badge. Decide from the plan, always.

### The editor was saving pages wrong

Autosave upserted page rows from the browser on `id`. That never deletes, so a
deleted page came back on reload; and a reorder writes swapped `page_number`
values into `UNIQUE (book_id, page_number)`, which is checked per row, so the save
failed and blamed the network. Both the transactional route and its migration
already existed and nothing called them. A second non-atomic page-replacement
handler (`PUT /api/books/[id]`) was deleted outright.

### Nothing measured the author funnel

Four events fired in the whole studio. `lib/product-analytics.ts` now covers one
funnel end to end. Two needed something built: `signup_completed` rides a marker
across the auth callback (a server redirect can't emit a client event), and
`share_link_copied` exists because a publish nobody shares produces nothing.

### Value came after the commitment

The landing page asked for an email before showing anything. A visitor can now
drop a PDF and flip it in the real reader with no account; the file crosses the
magic-link round trip in IndexedDB (`lib/pending-import.ts`) and the import
resumes at `/dashboard?resume=1`. **Every part of that path fails soft** — a
browser that won't store the file costs a re-upload, not a dead end.

### Nothing brought an author back

Reader numbers change while the author is away — that is the entire point of the
analytics — and nothing ever told them. There is now a weekly digest
(`/api/cron/digest`, scheduled in `vercel.json`), which is idempotent through
`digest_last_sent_at` rather than by trusting the scheduler to fire once, and
which claims its slot *before* sending so a failed send costs one missed week
rather than a double send.

### The retention assets were invisible

Per-edition analytics sat behind an unlabelled icon on one card. `/insights` is a
nav item covering every edition, cards show readers rather than page counts, and
the dashboard's stat cards count readers and captured emails instead of the
author's own output. A captured lead now emails the author, where before it sat
in the events table until someone exported a CSV.

---

## 3. Known-remaining risks

Ordered by how much they'd hurt.

1. **The migrations above.** Everything else assumes they land.
2. **The digest has never been sent.** The route, the schedule, the template and
   the opt-out all exist and are typechecked, but nothing has exercised them
   against a live scheduler or a real mailbox. Trigger it by hand once
   (`curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/digest`) and read
   the JSON it returns before trusting the cron.
3. **`totalReaders` means something slightly different on each Insights path.**
   The database aggregate counts each edition's sessions independently, so one
   person reading two editions counts twice; the JS fallback deduplicates across
   editions. Documented in `fromRpc`. Worth unifying if the number is ever
   quoted anywhere that matters.
4. **Client-side PDF rendering on phones is still unmeasured.** The scale now
   adapts (`renderScale()` in `ImportPDFModal`) and the landing preview caps at
   six pages, but no low-memory device has actually been tested.
5. **Nothing prunes `book_slug_history`.** It grows by one row per rename, which
   is fine, but a released slug is never reusable by anyone — deliberately, since
   reuse would hijack old links.
6. **`profiles` now has an UPDATE policy** (migration 013), where 004
   deliberately had none so nobody could promote themselves. It pins `plan` and
   `status` to their current values, which is what makes it safe — read it before
   adding another user-writable column.
7. **Canvas layout and spread view were verified by hand, not by a browser
   test.** The geometry, seeding and round-tripping are unit-tested, and both
   were driven in a running app and screenshotted during development — but there
   is no automated test that would catch a visual regression in either. The same
   is true of the container-query phone fallback.
8. **The editor still hardcodes `neutral-*` for its surfaces.** The
   `--studio-*` tokens exist and the bugs are fixed, but the sweep across ~2,000
   lines of editor JSX was not done: it is cosmetic, carries real regression
   risk, and no test would catch a mistake. Do it with a screenshot diff.
9. **`z.custom<Page>()` in the detect route validates nothing.** It is a type
   assertion, not a schema, so the page objects that route receives are whatever
   JSON the client sent. It is signed-in only now and the image fetch is
   guarded, so the blast radius is the caller's own quota — but do not add a new
   sink that trusts those objects without validating them first.

---

## 4. Decisions that are the owner's, not the implementer's

- **Was 301-from-the-old-slug the right call?** It is built (migration 014, the
  editor's Link field, `lib/slug-history.ts`). The consequence to be comfortable
  with: a slug that has ever been used can never be claimed by another edition,
  because that would silently redirect someone else's circulated links.
- **Password protection / view-once:** the schema fields are gone now, not just
  the controls. Build them properly or leave them out.
- **Commerce: decided — cut.** Not an open question any more. See §2 and
  `docs/mvp-scope.md`.
- **What else to cut.** `docs/mvp-scope.md` §3 marks webhooks, the embed route
  and the filmstrip scrubber as *on probation*: they work, nobody has asked for
  them, and the next time one needs maintenance is the moment to remove it
  instead.
- **Custom domain:** removed from all copy. It needs domain routing, certificate
  provisioning and verification — a project, not a fix.
- **Pricing:** $19 Pro is unvalidated and undercuts Issuu, Flipsnack and
  FlippingBook. See the audit §7.5 and §10.
- **Social proof:** the unsourced claims are gone and nothing replaced them.
  That gap closes with real design partners, not copywriting.
- **The hero headline changed.** It is now "Send a PDF. See who actually read
  it."; "Flip through anything." moved to the eyebrow and `BRAND.md` records
  both. The audit wanted the H1 to name one audience — it still names four,
  because narrowing the page to one is a GTM commitment the ICP hypothesis
  hasn't earned yet (audit §9.1, H1).

---

## 5. Conventions and traps specific to this codebase

Read `AGENTS.md` first — this Next.js (16.2.6) differs from training data, and
`node_modules/next/dist/docs/` is the authority.

- **pdf.js cannot be imported at module scope in anything that prerenders.** It
  configures its worker on import and reaches for `DOMMatrix`. A static import in
  a landing-page component fails `npm run build` with a prerender error, and
  `'use client'` does not save you — client components are still prerendered.
  Load it with `await import(...)`, or the component with `next/dynamic`
  (`ssr: false`).
- **Tailwind v4 `@theme inline`: an unregistered colour utility generates nothing
  and fails silently.** `bg-primary` produced `background: rgba(0,0,0,0)` behind
  white text — an invisible button that no test or typecheck catches. **Verify
  colour changes with a computed style or a screenshot.**
- **Portals and hydration:** portal content must report "not mounted" for the
  hydration pass. `Modal` uses `useSyncExternalStore` for this.
- **`Modal` renders its own `sr-only` `<h2>` as the accessible name.** Panels
  supply their own visible heading. Don't add a second one with the same id.
- **`PageRenderer` output can never be wrapped in an interactive element** — it
  contains `<a>`, `<button>`, `<audio>`, `<iframe>`. Click targets must be
  sibling overlays.
- **react-pageflip** fixes page count at mount and throws on a `false` child.
  Build children as an **array**, never with JSX `&&`.
- **`.upsert({ onConflict })` only SETs the columns you list.** Omitting a column
  preserves it, which is load-bearing in `applyAppSumoEvent`.
- **An unqualified select against a table with a public read policy is not scoped
  by RLS the way it looks.** `books` carries two SELECT policies and
  `public_read_published` matches any published book for any caller. Filter on
  `owner_id` explicitly.
- **Read profile rows with `select('*')`.** A named column list breaks outright on
  an install that hasn't applied the newest migration.
- **Grep for unimported components as a habit.** Two complete features
  (`PageManagerModal`, `ShareModal`) were once dead code nothing imported, and
  this branch found two more dead paths the same way. No test or typecheck
  catches it.
- **Postgres 16 is available in the container** (`/usr/lib/postgresql/16/bin`, run
  as the `postgres` user, not root). Build the schema locally and test SQL
  against it rather than reasoning about it.
- **When you fix a bug, revert the fix and confirm the new test fails.** A test
  that passes against broken code is worse than no test.
- **A test that does not import the shipped path is not a test.** Four dead
  features survived behind test files that reimplemented the logic locally. If
  the test defines the function it is testing, it is testing itself.
- **`--studio-select` is the interaction colour.** Never use `--accent`,
  `--accent-vivid` or `--qlico-teal` for selection, focus or drag state — they
  are `#000` in light and `#fff` in dark, which is how six controls became
  invisible.
- **`page.layout` has a sixth value, `'canvas'`.** Anything switching on layout
  needs a branch for it. A block's `frame` is honoured *only* in that mode.
- **Media and link targets may be empty strings.** `draftableUrl` /
  `draftableHref` allow `''` so a block can exist before it has a source.
  Anything assuming a `src` or `href` is present must handle it — an empty
  `href` in an `<a>` resolves to the current page and silently reloads.
  "Not empty" is enforced at publish, in `lib/publish-checks.ts`, not on save.
- **`draftableHref` is deliberately narrower than `draftableUrl`.** Media may be
  a `data:` URI; a link may not — an href is a navigation target. Links take
  http, https, mailto, tel or a same-origin path.
- **`trackEvent` ignores non-UUID book ids.** The gallery and the bundled demo
  render from files with no database row, so their events could only ever be
  rejected by the foreign key.
- **The canvas phone fallback is a CSS *container* query**, not a viewport one,
  so it works inside the editor's narrow mobile simulator too. Keep it that way;
  a viewport breakpoint would make the simulator lie.
