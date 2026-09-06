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

Verification baseline: **282 tests across 32 files passing, 0 lint errors, 37
lint warnings, `tsc --noEmit` clean, production build clean.**

```bash
npm run typecheck && npm test -- --run && npm run lint && npm run build
```

Those four prove the code is consistent with itself. They do not prove the app
works — every serious failure in this repo's history passed all four, including
two that would have broken the AppSumo launch outright. These ask the running
thing instead, and they are the ones to trust:

```bash
# No deployment needed — these stand up their own PostgreSQL and PostgREST
npm run verify:migration        # applies master_migration.sql for real, twice
npm run verify:appsumo:e2e      # the licence lifecycle against real PostgREST
npm run verify:routes:e2e       # the webhook and the digest, over HTTP

# Against a deployment
CRON_SECRET=…      npm run preflight      -- https://<domain>   # config + live schema
APPSUMO_API_KEY=…  npm run verify:appsumo -- https://<domain>   # webhook + redeem gate
                   npm run audit:browser  -- https://<domain>   # what it renders
```

The two local ones need `service postgresql start` and the PostgREST binary;
`scripts/verify-appsumo-e2e.sh` prints how to get it. They are the only checks
that have ever caught a PostgREST-semantics bug, and they caught two.

`npm run format:check` still fails on files that predate this work — the repo has
never been Prettier-clean. New and touched files are formatted; the rest is left
alone rather than buried under a whole-repo reformat.

---

## 1. Launch runbook

Everything here that could be done from a sandbox has been. What is left needs a
real deployment, real credentials, or a person — it is listed as such, not as
work someone forgot.

### Done, and verified rather than asserted

- The whole AppSumo licence path: webhook signature (accepts correct, refuses
  unsigned and wrong), the `test` event, `activate` / `enhance` / `reduce` /
  `refund` including the profile revert, the redemption race, and the
  signed-out `/redeem?code=` → sign-in → back-with-the-code round trip.
- Tier → plan mapping matches the deal table, and an unrecognised tier no
  longer grants the top plan.
- The pricing page's claims match `lib/plans.ts`, and live data is now actually
  gated rather than merely advertised.
- The database: one generated, idempotent consolidated migration; a test that
  fails if it drifts from the numbered ones.
- What it renders: no sideways scroll from 320px up, no unreadable text on the
  public surfaces, every named font actually loaded, in both colour schemes.

### Needs the deployment — nobody can do these from here

1. **Apply `supabase/master_migration.sql`** to the production Supabase
   project. Generated (`npm run db:master`), idempotent, safe to re-run, and
   therefore also how you bring an existing project up to date. Do not apply
   migrations by hand and do not edit that file.

   It has been **executed** — `npm run verify:migration` applies it to a real
   PostgreSQL 16, applies it a second time to prove it re-runs, saves pages
   through `replace_book_pages`, writes one of every event type, and checks
   that nonsense is still refused and RLS is on everywhere. CI runs it on
   every push. So step 1 is a paste, not a gamble: the file is known to work
   before it touches your project.
2. **Set the environment.** `preflight` below tells you what is missing and
   what each absence costs. `APPSUMO_API_KEY` must be the value from the
   AppSumo partner dashboard: a mismatch rejects every real purchase and looks
   exactly like "no sales yet".
3. **Point AppSumo's Notification URL** at
   `https://<domain>/api/appsumo/webhook`.
4. **Run the three checks and get them clean.**

   ```bash
   CRON_SECRET=…      npm run preflight      -- https://<domain>
   APPSUMO_API_KEY=…  npm run verify:appsumo -- https://<domain>
                      npm run audit:browser  -- https://<domain>
   ```

5. **Dry-run one real licence.** AppSumo issues a test code → a row lands in
   `appsumo_licenses` → redeem at `/redeem` → the plan shows on `/account` →
   refund → the account reverts to Free.

   Everything except AppSumo's own HTTP call is already proven:
   `verify:appsumo:e2e` runs activate → redeem → a second account refused →
   the holder's retry → stacking → reduce → refund → the dead code against a
   real PostgREST, and `verify:routes:e2e` posts a signed webhook to the real
   route and checks the row. Two launch-stopping bugs came out of writing
   those. What a real code adds is confidence that AppSumo's payload shape
   matches `lib/appsumo.ts` — which is the one thing no local harness can
   check, and the reason item 8 below exists.
6. **Send the weekly digest by hand** and read the email in a real inbox.
   `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/digest`.

   **This is now worth doing, and before today it would have done nothing.**
   The slot claim was broken (migration 016) so the route skipped every profile
   on every run — "no human has ever received one" was not for want of running
   it. `verify:routes:e2e` now drives the route against a capture server and
   gets `{considered:1, sent:1}` with the email in hand, so what is left is the
   SMTP hop and your own inbox.

   `npx vitest run lib/email-digest.test.ts --reporter=verbose` prints the body
   for a zero week, a good week and the singular case. The route bails before
   claiming anyone's slot when email is unconfigured, so running it early
   cannot burn a week of digests.
7. **Own three mailboxes**: `support@`, `legal@`, `privacy@`. The app prints
   them (`app/help`, `app/terms`, `app/privacy`).
8. ~~**Reconcile `lib/appsumo.ts` field names**~~ — done, and they did not
   match. This file was on the Licensing API **v1** (`action`, with
   `activate`/`enhance`/`reduce`/`refund`); the current **v2** sends `event`,
   with `purchase`/`activate`/`upgrade`/`downgrade`/`deactivate`/`migrate`. On
   a v2 deal every webhook was rejected `400 missing action` and no licence
   would ever have been created. Both shapes are accepted now and both are
   exercised over HTTP.

   The **signature** was wrong the same way and just as fatally: v1 signs the
   raw body, v2 signs `X-Appsumo-Timestamp` concatenated directly in front of
   it. Verifying the body alone meant every v2 webhook got a 401 and AppSumo
   retried it forever. Both constructions verify now.

   Read from AppSumo's docs via search plus a reference implementation
   (`mdhedayet/appsumolicensing`, `$timestamp . $request->getContent()`) —
   `docs.licensing.appsumo.com` is blocked from this network — so the dry-run
   in step 5 is still what confirms it.

   Left deliberately: `parent_license_key` on v2 add-on webhooks (no add-ons
   here). And a known hazard, not a bug — nothing orders events by
   `event_timestamp`, so a retried `activate` landing after a `refund` would
   re-activate a refunded licence. `lib/stripe` already solves the equivalent
   with `stripe_event_at`; copy that if AppSumo's retries ever arrive out of
   order.

### Not code, and not optional

The listing itself — title, hero video, screenshots, tier table, FAQ, founder
intro — is section 5 of `APPSUMO_LAUNCH.md`. And `docs/mvp-scope.md` §4 still
stands: nobody has watched five people import a PDF, and the price is a guess.
A deal that opens on an untested price is a decision, not an oversight; make it
deliberately.

### Optional settings, and what each absence costs

| Env | Without it |
|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | The import's "find products and write descriptions" option is hidden; detection falls back to the heuristic. |
| `RESEND_API_KEY` + `EMAIL_FROM` | No digest and no lead notification. A captured email is only visible in Insights. **Both** are needed — a key without a From address sends nothing. |
| `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PRICE_PRO` | No self-serve upgrade. `/account` falls back to a link to the pricing section. Correct for an LTD-only launch. |
| `CRON_SECRET` | The digest route and `/api/health` refuse every request. Both **fail closed deliberately**. Vercel Cron sends it as `Authorization: Bearer`; the schedule is in `vercel.json`. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | `/help` shows `support@qlico.app`. |

### Authorize the Sentry and Stripe MCP servers

Both need OAuth via claude.ai connector settings. Without them there is no error
reporting and no way to exercise the billing paths.

---

## 2. What changed most recently, and the reasoning you'd otherwise rediscover

### `.or()` on an UPDATE does not work, and it broke two things silently

**Read this before writing another Supabase query.** It is the most expensive
thing in this file.

PostgREST compiles an UPDATE carrying a `select=` into a CTE, then applies the
*logical* filters (`or=`, `and=`) a second time to that CTE's output:

```sql
WITH pgrst_source AS (UPDATE … RETURNING id)
SELECT … FROM pgrst_source AS profiles
WHERE (profiles.digest_last_sent_at IS NULL OR …)   -- not a column of the CTE
```

The CTE only has what `RETURNING` produced, so the second copy names a column
that is not there and Postgres answers `42703: column … does not exist`. Plain
`eq`/`neq` filters are *not* duplicated, which is why the failure looks
column-specific and is not: an `or=` on any column fails the same way.

This codebase used that shape in both places it claims a slot before acting,
and both were completely broken:

- **Every AppSumo redemption failed.** `redeemLicense` read the error as
  `not_found`, so a buyer with a valid code was told "We could not find that
  license code." Every buyer, day one, with the Q&A open.
- **The weekly digest has never sent an email to anybody.** The claim failed,
  the route read no rows as "someone else claimed it", and every profile fell
  into `skipped`. This file used to say the digest was "written, scheduled,
  idempotent and typechecked, and no human has ever received one" — and read
  that as nobody having run the cron. Running it was never going to work.

Both now run as one statement in the database (migrations 015 and 016) rather
than as a URL filter. Adding the column to the `select=` also works and was
rejected: it leaves a money path depending on an undocumented quirk of how a
filter is compiled, one careless edit of a select list away from breaking again.

**Neither was catchable by the unit tests**, which assert against a hand-rolled
mock of the Supabase client — the mock accepts `.or()` happily. `npm run
verify:appsumo:e2e` stands up PostgreSQL + PostgREST + a Supabase-shaped
gateway and runs the real code against it. That is what found both.

`npm run verify:routes:e2e` goes one further and drives the built app over
HTTP. It found two more:

- **the webhook answered 200 when the licence write failed.** `applyAppSumoEvent`
  discarded the upsert's error, and AppSumo retries on a non-2xx — so a failed
  write meant the event never came again and the buyer's code simply did not
  exist;
- **`NEXT_PUBLIC_*` is inlined at build time.** Changing
  `NEXT_PUBLIC_SUPABASE_URL` in a hosting dashboard does nothing until the next
  build. Worth knowing before step 2 of the runbook.

It also sends a digest to a local capture server and prints it, so the route is
demonstrably able to send — which, before migration 016, it was not.

### The typography controls had never done anything

Read this alongside the six-features section below — it is the same failure,
found nine months later, in the part of the product this app is *sold* on.

Every theme preset named a Google font pairing (Playfair Display, Sora, Lora,
DM Serif, Space Grotesk, IBM Plex) and the studio offered four "Curated
Editorial Font Pairings" on top. **The app loaded exactly two families, neither
of them any of those.** `font-family: "Playfair Display", sans-serif` with no
Playfair Display loaded is `sans-serif`, so all four pairing buttons produced
identical output, and every preset rendered in the browser's default sans.

The two font dropdowns were broken a second, independent way: their values are
stacks (`Georgia, serif`) and `PageRenderer` wrapped whatever it was given in
quotes, so the browser looked for one family literally named `Georgia, serif`.

And `globals.css` had `--font-display: var(--font-display), …` — a custom
property defined in terms of itself, which CSS treats as a cycle and discards.
So the app's own two loaded families were unreachable as well, and the whole
product had been running on system fonts.

What replaced it:

- `lib/fonts.ts` is the only place a font is loaded, and `lib/typesets.ts` is
  the only place one is named. `lib/typesets.test.ts` fails if a type set names
  a family `lib/fonts.ts` does not load. **Do not add a font family name
  anywhere else** — it will render as the browser default and look like a
  working control.
- Five edition styles, each defining the whole scale for all six text variants.
  `TextBlock` reads CSS variables instead of fixed Tailwind classes, so a
  heading is no longer 30px in every edition ever made.
- Legacy names stored on existing editions map to the nearest loaded family.

**How it was found, which is the transferable part.** Not by reading the CSS —
the CSS looked right, and had looked right to everyone who read it. Chromium is
installed in this environment (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`,
with `playwright-core` from npm). Build, `npx next start`, open a gallery
edition, read `document.fonts` and `getComputedStyle`. Two minutes. Do this
before believing any claim about what the app renders.

### Three scripts that answer launch questions with evidence

```bash
CRON_SECRET=…      npm run preflight      -- https://<domain>
APPSUMO_API_KEY=…  npm run verify:appsumo -- https://<domain>
                   npm run audit:browser  -- https://<domain>
npm run db:master   # regenerate supabase/master_migration.sql after adding one
```

- **`preflight`** asks the deployment which env vars are set (presence, never
  values), whether the tables and columns exist, and whether the live CHECK
  constraints accept everything this code can produce. Behind `CRON_SECRET`;
  404s otherwise. Warnings do not fail it — no Stripe key is correct for an
  LTD-only launch.
- **`verify:appsumo`** sends AppSumo's `test` event and, around it, checks the
  webhook refuses unsigned and wrongly-signed requests, that the redemption API
  refuses anonymous callers, and that a signed-out buyer with `?code=` is sent
  to sign in with the code carried across. Safe against production.
- **`audit:browser`** is below.

### `npm run audit:browser` — run it before believing the app looks right

`scripts/audit-browser.mjs`. Build, `npx next start`, point it at the port. It
opens each route at 320 / 390 / 768 / 1440 and reports sideways scroll, text set
in its own background colour, a font that is named but not loaded, uncaught
errors, non-200s and broken images.

It exists because reading the CSS was not enough twice in one session, and
both failures were invisible to typecheck, lint and 265 unit tests:

- eight font families named across the presets and the studio's pairings, none
  of them loaded;
- the reader's control bar 450px wide against a 390px phone, scrolling the
  primary surface sideways on every phone width.

Chromium lives at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` in the
cloud dev environment; set `CHROME_PATH` anywhere else. It is not wired into
CI — that needs a built app and a running server on every push, which is a
separate decision.

### Also new this session

- **Live data now works.** The Data block fetched from the reader's browser, so
  CORS decided whether the feature existed — it read "Offline" for every reader
  while the author's own Test button passed, because the Test button had the
  same defect and so got tried against same-origin paths. Server-side now:
  `lib/live-data.ts`, `/api/live-data` (takes a block id, never a URL, so it is
  not an open proxy), `/api/live-data/test` for the studio.
- **`safeFetch` in `lib/safe-fetch.ts`** follows redirects while checking every
  hop. `redirect: 'manual'` alone was safe but wrong: a shortened link, an
  http→https upgrade and a Sheets publish URL are all redirects.
- **Multi-select and a clipboard that crosses editions** (`lib/block-clipboard.ts`,
  localStorage-backed, everything read back parsed through `BlockSchema`).
- **Save as template** — `settings.isTemplate` on a normal edition; "start from
  this" is the duplicate route. Templates count against the plan's edition
  limit, deliberately.
- **Draggable focal point** for image blocks and page backgrounds.

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
6. **`profiles` now has an UPDATE policy** (in 009), where 004
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

- **Was 301-from-the-old-slug the right call?** It is built (009's slug history, the
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
