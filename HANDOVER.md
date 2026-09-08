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
npm run verify:mvp:e2e          # the product itself: publish → read → gated → reported
npm run verify:author:e2e       # the buyer: sign in → import → publish → redeem → refund

# Against a deployment
CRON_SECRET=…      npm run preflight      -- https://<domain>   # config + live schema
APPSUMO_API_KEY=…  npm run verify:appsumo -- https://<domain>   # webhook + redeem gate
                   npm run audit:browser  -- https://<domain>   # what it renders
                   npm run audit:theme    -- https://<domain>   # light vs dark, same DOM
```

The local ones need `service postgresql start` and the PostgREST binary;
`scripts/verify-appsumo-e2e.sh` prints how to get it. They are the only checks
that have ever caught a PostgREST-semantics bug, and they caught two — and
`verify:mvp:e2e`, which had never been run because it did not exist, caught a
third failure of the same kind the first time it ran.

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

### Draft comments (§9.3) — shipped, and optional for launch

The last outstanding item of the editor redesign, and worth saying plainly: this
is a collaboration feature, past the MVP sentence in `docs/mvp-scope.md`. It is
not needed to launch on AppSumo; it is needed by the LTD buyer doing client work
who wants to send a draft and get notes back.

019 adds `book_review_links` and `book_comments`. **A reviewer is nobody** —
that is the decision the spec said had to be made. A client looking at a
lookbook will not make an account, so access is a capability rather than an
identity: 32 bytes of CSPRNG in the link, one row per link, revocable, and
expiring at 30 days by default so a link handed to a contractor in March does
not still open in December.

What a token buys: reading one edition and commenting on it. Not listing
editions, not editing, not another edition's comments, not analytics — and not
resolving, because resolving is a judgement about the work and that belongs to
the author. There is deliberately **no anon policy** on either table; a reviewer
never touches PostgREST, only routes that run as `service_role` after
`review_link_book()` has resolved the token. That function checks revocation and
expiry in the same statement that finds the book, so a caller cannot check one
and forget the other. Revoked, expired and never-existed all answer identically,
because distinguishing them tells somebody holding a guessed token that it was
once real.

The old drawer's actual failure — dropping what a reviewer typed on refresh — is
fixed twice: the comment is written to the server before it is acknowledged, and
the in-progress draft is kept in `localStorage` while it is being typed.
`/review/[token]` is `noindex` (the URL *is* the credential) and renders through
`PageRenderer` with a deliberately non-UUID book id, so `trackEvent` ignores it
and a client clicking through a draft is not counted as a reader — the same
lever the gallery and the bundled demo already use.

`verify:author:e2e` walks it with no cookie at all: an anonymous visitor opens
the draft, leaves a comment, is refused an empty one, the author sees and
resolves it, an anonymous caller cannot list the author's comments, another
author cannot see the links, and revoking closes both reading and commenting at
once. 70 assertions in that harness now.

One test worth remembering: the first version of "revoked and expired answer the
same" searched the route's whole source for those words and tripped on the
comment explaining the rule. Regexes over prose are the trap
`supabase/master-migration.test.ts` already documents; it now matches the
strings the route actually answers with.

### Version history (§9.2) — shipped

Undo was a session: `lib/editor-store.ts` keeps a capped in-memory stack and
closing the tab was the end of it. The stand-in was "duplicate the edition",
which spends a slot against the plan's quota and leaves a second thing in the
library to be confused by.

`018_book_versions.sql` adds the table and two functions; `lib/versions.ts`
holds the two numbers both routes pass; `VersionHistoryModal` is the editor's
`History` button. Three decisions worth knowing:

- **When a version is taken.** Not on every save — `PUT /api/books/[id]/pages`
  is the autosave and fires every couple of seconds — and not only on publish,
  because the edits worth recovering are the ones made *before* deciding to
  publish. Automatic and time-bucketed: a save opens a new version only if the
  newest is older than 30 minutes. Publishing is a named checkpoint and skips
  the throttle.
- **Where the throttle lives.** In one statement, in the database. Reading the
  newest version and then deciding whether to insert is the same read-then-write
  that made `redeemLicense` and the weekly digest fail silently (015, 016), and
  two autosaves landing together would write two versions a second apart.
- **What a version is.** Pages *and* metadata — a theme change or a retitle is
  exactly the kind of thing somebody wants back. `pages.blocks`/`hotspots` are
  `jsonb[]` rather than `jsonb`, so they are stored as real JSON arrays and
  handed straight back to `replace_book_pages` on restore, which is
  transactional.

The slug is deliberately **not** restored. It is the public address, and rolling
it back would break the links a rename filed in `book_slug_history` and left
working — `lib/versions.test.ts` asserts the migration never sets it.

Restoring snapshots the current state first, labelled `Before restoring …`,
because a restore is itself a destructive edit and somebody who picks the wrong
version needs the same way back out that brought them there. The modal says so
rather than leaving it as a pleasant surprise: the reason people hesitate over a
restore button is not knowing whether it is a one-way door.

`verify:author:e2e` walks it end to end — publish leaves a named version, the
edition is wrecked (retitled, pages replaced), the published version is
restored, title and pages come back, the slug does not move, a "Before
restoring" version now exists, and a second author gets 403 both listing and
restoring. 55 assertions in that harness now, all green.

One accepted lint warning: `VersionHistoryModal` trips
`react-hooks/set-state-in-effect`, which is conservative about any state-setting
call reached from an effect. The fetch sets nothing before its first await and
carries a liveness flag so a slow response cannot set state on a closed modal;
the rule flags it regardless, as it does 37 other places in this repo.

### §9.1, the last item of the editor redesign — closed by measuring it

The spec asked for a sweep of ~540 hardcoded `neutral-*` classes across the
studio and said to do it "with a screenshot diff, not by hand". The instrument
is `npm run audit:theme` (`scripts/audit-theme.mjs`): render a route twice,
under `prefers-color-scheme: light` and `dark`, walk the DOM in the same order
both times, and report every element whose colour is byte-identical across the
two — plus anything under AA against what is actually behind it, composited up
through its ancestors.

Two things it had to get right, and got wrong first:

- **Colours are resolved through a 1×1 canvas.** Tailwind v4 emits `oklch(...)`,
  and scraping digits out of `oklch(0.556 0 0)` reads 0.556 as a red channel.
  The first run reported the entire editor at a flat 1:1.
  `scripts/audit-browser.mjs` already carried this scar; I walked into it anyway.
- **The ground is the ancestor chain, not the preceding element.** Walking the
  flat collected array looks like ancestry and is not — the element before this
  one in document order is usually a sibling's descendant.

With it working, the premise turned out to be wrong. **The studio is a
deliberate dark room** — `bg-neutral-950 text-neutral-100` at its root — so
those 540 classes are the design, and rendering identically in both schemes is
the requirement rather than the bug. A blind sweep would have been ~540 edits of
pure regression risk for nothing. Of all of them exactly one was illegible:
`text-neutral-500`, 4.18:1 on the studio's own grounds, in 59 places. That one
class is now `text-neutral-400` and a test forbids its return.

**What the sweep would have missed entirely:** `--qlico-muted` and
`--invert-muted` were `#888888` in the light block, the `[data-theme='dark']`
block *and* the `prefers-color-scheme` block. Written into each, so the palette
read as theme-aware; identical in each, so it was not. A mid grey only clears AA
on the dark side of a pairing — `#888888` is 3.11:1 on `--qlico-subtle` — so
every muted caption in the app's **default** theme was under AA, with
`--invert-muted` failing the same way mirrored onto white. Both are now
differentiated, at the darkest/lightest greys that clear 4.5:1 against every
surface they actually land on.

`lib/contrast-tokens.test.ts` grew the general form: it parses all three theme
blocks and pairs each text token with the surfaces it is painted on. Reverting
either token's value fails five of those, which was checked.

The score across the editor, dashboard, account and insights went from 30
elements frozen against the theme and 4 unreadable, to **0 and 0**.
`audit:browser` still reports nothing on the public pages afterwards.

One subtlety worth keeping: an edition preview renders the *book's* theme, not
the app's, so it is correctly identical in both schemes. Rather than train
anyone to ignore a permanent finding, `PageRenderer`'s root carries
`data-own-theme` and the audit skips that subtree. The dashboard's brand glow
was the last hardcoded `rgba(…)` in the studio chrome and is now
`--glow-brand` / `--glow-brand-strong`, a violet wash on white and a lighter one
on black.

### The last of the uncovered routes, and a filename that chose a storage key

`verify:author:e2e` now also covers `/api/upload`, `/api/account/preferences`
and the analytics retention window — 47 assertions, all green.

The window is the one worth naming: it is sold on every plan and was once "a
label on a range picker and nothing else". The harness plants two readers, one
of them sixty days old, and asks for a year. A free author is answered with
thirty days and one reader, `window.clamped` true; the same edition on tier 2
opens to a hundred and eighty and counts both. Enforced, and now proven so
against a running build rather than a unit test of the clamp.

`/api/upload` built its storage key as
`` `…/${crypto.randomUUID()}.${file.name.split('.').pop()}` ``, which hands part
of the key to the client. `File.name` out of a multipart body is an arbitrary
string: `photo` (no dot) made the extension `photo`, `a../../../x` made it `/x`
— two extra path segments — and `weird.$(id)` went in verbatim. Nothing escapes
the book's own asset prefix, because the last `.` swallows any `..` before it,
so this is hygiene rather than a way into somebody else's edition. It is still
the client choosing part of a path. `safeAssetExtension` takes the extension
from the MIME type the route already validated, falls back to a
`[a-z0-9]{1,8}` filename extension, and `bin` after that — so a key never ends
in a bare dot either.

### `audit:browser` found a 2.7:1 pill on /gallery

Run against the current build, at all four widths and in both colour schemes.
Every gallery card paints its own colours — the template picks a background and
an accent, and the category pill is that accent as text over a 13% wash of
itself. An accent is chosen to sit *beside* text, not to be text, so `#d97706`
on `#fcfbf9` came out at 2.7:1 at 9px.

Hand-correcting the one template that failed was rejected: the next accent
somebody adds has the same coin flip, and nothing would catch it.
`lib/contrast-tokens.test.ts` scans class names and cannot see a hex sitting in
`data/templates.ts`. So the pill now asks `readableOn` (in the new
`lib/contrast.ts`) for a version of the accent that clears AA against the wash
it actually sits on — walking toward black or white in small steps, so the hue
survives; `#d97706` becomes `#985304` at 4.9:1, still visibly the same amber.

`lib/contrast.test.ts` checks the maths, then walks **every** template and
asserts both the corrected pill and the raw headline colour clear 4.5:1, and
that both cards (the gallery and `CreateBookModal`) actually ask for the
correction. Removing it from either makes the suite fail, which was checked.
The audit re-run afterwards reports nothing.

### The PDF import and the paid entitlements now run in a harness too

`scripts/supabase-gateway.mjs` grew a `/storage/v1`: buckets are directories,
objects are files, and signed upload tokens are a `Map`. The endpoints and
payload shapes were read out of
`node_modules/@supabase/storage-js/src/packages/StorageFileApi.ts` rather than
remembered — `createSignedUploadUrl` answers with a *relative* `url` that the
client re-parses for its token, which is not a thing to guess at.

That made the product's first sentence testable. The importer hands the browser
one signed target per page, the browser writes the PNGs straight to storage, and
`/api/import/pdf/finalize` turns whatever landed into page rows — none of it
expressible against PostgREST, so none of it had ever been run. The harness
drives both server halves and the PUTs between them, and deliberately uploads
two of the three pages it claimed: storage is the authority on which pages
exist, and the honest failure — a dropped upload — must produce a shorter
edition rather than page rows pointing at objects that are not there. It does.
Finalising twice is idempotent, and the imported edition's images reach the
reader's HTML, which is the difference between a 200 and a book you can see.

The same run now checks the feature matrix the tiers are sold on, from both
sides: a free author can switch the lead gate on and it does not run, and their
CSV export is a 403; the same settings on the same edition gate for real once a
code is redeemed, with the text behind the gate absent from the HTML rather than
merely hidden, and the export returns 200. Both correct, and neither had ever
been executed against a running build.

### Nothing had ever run as a signed-in user, and RLS was untested

`scripts/supabase-shim.sql` defined `auth.uid()` as
`current_setting('request.jwt.claim.sub')`. PostgREST stopped setting that in
v9; against the v12 binary these harnesses run it is always NULL. Every RLS
policy in this schema is written as `USING (auth.uid() = owner_id)`, so under
the shim they all denied — and nothing noticed, because every harness so far
reached the database as `service_role`, which bypasses RLS entirely, or as
`anon` against the public-read policy. **The policies themselves had never been
executed.** They are the only thing standing between one author's editions and
another's.

The shim now uses Supabase's own definitions, reading `request.jwt.claims` and
falling back to the legacy setting so `SET LOCAL request.jwt.claim.sub` still
works in a psql test. With that fixed, `verify:author:e2e` confirms a second
author gets 403 on PATCH and DELETE of an edition that is not theirs.

### The author's half of the product had no harness either

`scripts/harness-session.mjs` is what made one possible. The studio is
cookie-authenticated — `createServerSupabase` and `proxy.ts` both read the
session out of `@supabase/ssr`'s cookies — so a script holding a bearer token
could reach the database and none of the product. Rather than hand-rolling the
cookie name and encoding (both have changed across @supabase/ssr releases, and a
wrong guess fails as "signed out" rather than as an error), it drives the
library over an in-memory jar and prints the `Cookie` header a signed-in browser
would send.

`npm run verify:author:e2e` then walks the buyer's first hour against a
production build: the studio is shut to a stranger and open to a session; an
author creates, edits, saves and publishes an edition and it appears at its
public address; the free plan's limit is the number the pricing page sells and
hitting it is a 403 the client can render; a second author cannot touch the
first one's edition; an AppSumo code lifts the plan, cannot be redeemed twice by
different people, stays idempotent for its rightful holder, and a refund takes
it back.

### The free plan sold three editions and allowed one

Found by that harness on its first run, and it is the top of the AppSumo funnel:
the people who arrive from the deal page, try free first, and decide from that
whether the lifetime deal is worth buying.

`lib/plans.ts` says `maxBooks: 3` for free. `book_limit_for_plan` in 006 said
`ELSE 1 -- free`. Everything in the app reads the first: `/account` draws its
quota bar from it, `checkBookQuota` admits the request from it, and
`components/landing/Pricing.tsx` sells "3 Active Editions" in those words. So
the API's quota check passed, the request went all the way to the insert, and
the trigger raised:

```
HTTP 500  {"error":"BOOK_LIMIT_REACHED: plan free allows 1 book(s)"}
```

The route's designed answer — 403, `code: 'plan_limit'`, used/limit, an upgrade
prompt the UI already renders — was unreachable. A free author's *second*
edition was a 500 carrying a raw Postgres exception.

Only the free row had drifted; pro, tier1, tier2 and tier3 already agreed. 017
realigns it, and `lib/plan-limits.test.ts` parses both the SQL ladder and
`lib/plans.ts` — and the number on the pricing card — and fails if any of the
three stop matching. Reverting 017 makes it fail, which was checked.

Separately, the three routes that create an edition (`POST /api/books`,
`POST /api/import/pdf`, `POST /api/books/[id]/duplicate`) now recognise
`BOOK_LIMIT_REACHED` and answer with the same 403 payload. Reaching the trigger
is not always a bug — two creates racing each other both pass the quota check
and one loses at the insert — so the backstop needed a client-readable answer
either way. Matched on the message, not the `check_violation` SQLSTATE, because
`books` and `pages` raise that for real CHECK constraints too and answering one
of those with "upgrade your plan" would be worse than the 500 it replaces.

### The reader answered 200 for pages that were not there

`npm run verify:mvp:e2e` is new. It runs the sentence `docs/mvp-scope.md` opens
with — "Send a PDF. See who actually read it." — end to end against a real
PostgreSQL, a real PostgREST and a production `next build`: an author publishes
a gated two-page edition, a reader opens it, the events land, the gate takes an
address, Insights reports that reader back, and a renamed edition's old link
still arrives. Every one of those paths was covered by unit tests. The last one
was broken anyway.

`/book/<old-slug>` returned **HTTP 200 with a page reading "Not Found"** instead
of a 308 to the new address. So did every slug that never existed. The cause is
the reader skeleton added earlier in the same session: `loading.tsx` wraps
`page.tsx` in a Suspense boundary, and Next's `loading.js` reference is blunt
about what that costs —

> When streaming, a `200` status code will be returned … Because the response
> headers have already been sent to the client, the status code of the response
> cannot be updated.

`permanentRedirect` degrades to a `<meta http-equiv="refresh">` in the body and
`notFound` to a `noindex` 200. A browser follows the meta tag, which is why
clicking a renamed link by hand looked fine. Nothing else follows it: the Slack
unfurl, the LinkedIn card, the crawler revisiting the old address and the link
checker all saw 200 and the words "Not Found". `book_slug_history` exists for
exactly one purpose — keeping a link that is already in someone's inbox alive
across a rename — and that was the part that did not work.

The fix is where the docs put it, "ensure the resource exists before the
response body is streamed": `app/(reader)/book/[slug]/layout.tsx`. A layout is
not wrapped by `loading.js` in its own segment, so it runs ahead of the
boundary. It resolves the slug through `lib/reader-slug.ts` — one indexed
single-column read — and redirects or 404s there. The edition itself still
streams in behind the skeleton. `lib/reader-slug.test.ts` fails the build if the
page and the resolver stop agreeing on what "published" means, or if the miss
path drifts back into the page.

### Nothing in the codebase had ever called `revalidatePath`

Found while fixing the above, and worse in daily use than the redirect was. The
reader page is ISR (`export const revalidate = 60`), which is right for a page
strangers reach from a link. Nothing invalidated it. An author who fixed a typo,
published an edition, renamed it or deleted it watched their own public address
serve the previous version for up to a minute, with no way to tell whether the
save had worked.

`lib/revalidate-reader.ts` clears `/book/<slug>` and `/embed/<slug>`, and is
called from the three routes that can change what a stranger sees: the PATCH
(both addresses on a rename, so the old one starts forwarding at once rather
than serving a stale copy of the edition it is supposed to forward to), the
page-save PUT — the slug comes back from the ownership check it already ran, so
autosave costs no extra query — and the DELETE, which is the one case where
staleness means showing something the author has explicitly taken down.

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

### A security review of the review surface, and it found something

Worth running because the review feature is the first **unauthenticated write
path** in this app — anyone holding a link can read a draft and post to it. Two
findings; the first was mine and it was real.

**The anonymous route returned `books.settings` verbatim.** `settings` is not a
display blob. It carries `gating.passcode` — the plaintext value
`/api/books/unlock` compares against, so `if (!passcode || passcode !==
gating.passcode)` — and `webhookUrl`, the author's lead-delivery endpoint, which
is an unauthenticated capability URL into their CRM. Both went to an anonymous
holder of a review link, for a **draft**, and revoking the link afterwards would
not have taken the passcode back: the contractor keeps reading the gated edition
through the front door once it publishes. `ReviewClient` never read either
field; it was pure over-fetch. The route now selects
`id, title, description, theme, pages(*)`.

**Comments were scoped to the edition, not to the link.** `review_link_id`
exists so a revoked link can be traced to what it produced, and the read ignored
it — so every live link was a window onto every other reviewer's notes,
including ones left through links since revoked. An agency circulating one draft
to two competing clients, a link each, would have shown each of them the other's
candid feedback. Silently, with revocation no help. It would also have published
the author's own notes (`review_link_id IS NULL`, already in the schema) to
every reviewer the moment that write path existed. Now `.eq('review_link_id',
link.link_id)`; the author still sees all of them in the editor, where that is
the point.

Both are locked by `lib/review.test.ts` (reverting either fails it, which was
checked) and proved end to end: `verify:author:e2e` plants a real passcode and a
real webhook in the edition's settings, asserts neither appears in the anonymous
response, and opens a second link to confirm it cannot see the first reviewer's
comments while the author still can.

The review also confirmed clean: no IDOR on the four authenticated routes (every
one pins `book_id` to an owner-verified book), the token cannot reach another
edition or any management action, `randomBytes(32).toString('base64url')` is
256 bits of CSPRNG, no `anon` grant on either table, both `SECURITY DEFINER`
functions set `search_path` and are `service_role`-only, and the reviewer UI
renders comment text as JSX text nodes with no `dangerouslySetInnerHTML`.

### The health check verified tables and constraints, and no functions at all

`/api/health` — the thing `preflight` reads before you decide a deployment is
ready — checked env vars, tables, columns and live CHECK constraints. It did not
check a single database function, and eight of them carry load. Two carry the
launch:

- **`claim_appsumo_license` (015).** Absent, `redeemLicense` has nothing to call
  and every AppSumo redemption answers "We could not find that license code" —
  the bug this branch opened with, to every buyer, on day one.
- **`replace_book_pages` (009).** Absent, the page save falls back to a
  non-atomic delete-then-insert, which is the data-loss shape that function
  exists to prevent. The route logs it; nothing surfaced it.

A deployment running an older `master_migration.sql` has every table, every
column, every constraint — and neither function. **Before this change it
reported the same two blockers as a perfectly healthy one.**

020 adds `installed_functions()`, a read-only inventory from `pg_proc`, the same
shape as `constraint_allowed_values` (014) and for the same reason: calling each
function with harmless arguments would mean a health endpoint that runs an
UPDATE and a DELETE every time somebody polls it. `lib/required-functions.ts`
lists what the app calls, which migration adds it, whether its absence is
launch-blocking, and what a user experiences without it — so the output reads
"apply migration 015. Without it, every AppSumo redemption answers …" rather
than naming a symbol.

Verified by dropping `claim_appsumo_license` and `replace_book_pages` from a
complete schema: `launchBlocking` went 2 → 4 and `preflight` named both, the
migration for each, and the consequence. Re-applying the master migration put it
back to 2.

`lib/required-functions.test.ts` greps shipped code for `.rpc('…')` and fails if
anything called is not listed, if anything listed is not called, or if a listed
function is not in `master_migration.sql`. That last one fired on its first run
— I had added 020 without regenerating the master — which is the test doing its
job before a human could. The same run also picked up the tables 018 and 019
add, so a deployment missing version history or review links says so instead of
failing silently in the editor.

## 2c. Where the editor-redesign spec stands

`docs/editor-redesign-spec.md` §9 was the outstanding list. All four code items
are now closed:

| | |
|---|---|
| §9.1 `neutral-*` sweep | Closed by measuring it — the studio is dark by design; one illegible class fixed, and two palette tokens that were never theme-aware |
| §9.2 Version history | Shipped — 018, throttled in the database, restore leaves its own way back |
| §9.3 Draft comments | Shipped — 019, a reviewer is a capability rather than an identity. **Beyond the MVP sentence; optional for launch** |
| §9.4 Commerce | Cut, deliberately |

What remains in §9 needs a deployment (send the digest and read the email) or a
CI decision (wiring the two Chromium audits into every push), not code.

Every harness, run together at the end of this pass:

```
verify:migration    applies, re-applies, accepts every value
verify:appsumo:e2e  12 tests
verify:routes:e2e   11 assertions
verify:mvp:e2e      12 assertions
verify:author:e2e   70 assertions
audit:browser       nothing found
audit:theme         0 frozen, 0 unreadable
```

Plus `tsc`, 458 unit tests, `lint` (0 errors), and `next build`.

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
- **The studio is dark-only on purpose.** `bg-neutral-950 text-neutral-100` at
  its root, so `neutral-*` inside it is the design and not a missing token. Do
  not "fix" it to follow the system theme. What does matter there is contrast
  against those grounds: `text-neutral-500` is 4.18:1 on them and is banned.
- **Resolve a computed colour through a canvas, never by parsing it.** Tailwind
  v4 emits `oklch(...)` and `color-mix()` yields `oklab(...)`; a digit-scraping
  contrast check reports black-on-white at 1.0:1. Both audit scripts do this,
  and both learned it the same way.
- **`books.settings` is not safe to return to anyone but its owner.** It carries
  `gating.passcode` (the plaintext the unlock route compares against) and
  `webhookUrl` (a capability URL into the author's CRM). Any route reachable
  without the owner's session must project columns explicitly, never `settings`.
- **A new `.rpc()` needs an entry in `lib/required-functions.ts`.** Otherwise
  `/api/health` reports a deployment green while the function it depends on is
  absent — which is how the redemption path stayed broken. The test greps for
  the call, so forgetting fails the build rather than the launch.
- **A colour that lives in data escapes the contrast tests.** `lib/contrast-tokens.test.ts`
  reads class names, so a hex in `data/templates.ts` is invisible to it. Anything
  painting itself from data has to run through `readableOn` in `lib/contrast.ts`
  and be covered the way `lib/contrast.test.ts` covers the template cards.
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
- **A `loading.tsx` in a segment forfeits that route's HTTP status codes.** It
  wraps `page.tsx` in a Suspense boundary; the body starts streaming when the
  fallback renders, so `notFound()` becomes a `noindex` 200 and `redirect()` a
  `<meta http-equiv="refresh">` with no `Location`. Browsers follow the meta
  tag, so this is invisible to a human clicking the link and total to a crawler
  or an unfurl. Resolve existence in a `layout.tsx` in the same segment —
  `loading.js` does not wrap it — as `app/(reader)/book/[slug]/layout.tsx` does.
- **A route that changes a public page must call `revalidateReader`.** The reader
  is ISR at 60s. `lib/revalidate-reader.ts` clears both `/book/<slug>` and
  `/embed/<slug>`; a rename has to clear the address it is leaving as well as the
  one it is taking.
- **Two copies of the same numbers drift, and a comment does not stop it.** 006
  said "Keep the limits in sync with lib/plans.ts" and the free row drifted
  anyway. If a constant has to exist in both SQL and TypeScript, add a test that
  parses both — `lib/plan-limits.test.ts`, `supabase/master-migration.test.ts`.
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
