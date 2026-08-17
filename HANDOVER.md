# Handover

State of QLICO after the `claude/product-strategy-audit-xt5fdi` work. Written for
whoever picks this up next — human or agent.

The reasoning behind every product decision below is in
`docs/product-strategy-audit.md`, which audits the product as it was and ends in
the roadmap this branch implements. Read it before undoing anything here.

Verification baseline: **111 tests across 12 files passing, 0 lint errors, 28
lint warnings, `tsc --noEmit` clean, production build clean.**

```bash
npm run typecheck && npm test -- --run && npm run lint && npm run build
```

`npm run format:check` fails on ~89 files and did before this work — the repo has
never been Prettier-clean. New files are formatted; the rest is left alone rather
than buried under a whole-repo reformat.

---

## 1. Do these before launch — nothing else on this list matters more

### Apply the pending migrations

Three migrations exist that may not be applied. Check what's actually live before
assuming:

| Migration | Consequence if missing |
|---|---|
| `009_add_gate_view_event.sql` | Postgres rejects every `gate_view` insert, so the lead-capture funnel silently reads zero — the one number that sells email capture. |
| `010_replace_book_pages.sql` | Autosave falls back to a non-atomic delete-then-insert. **This now matters more than it did**: the editor routes every save through `PUT /api/books/[id]/pages`, so this is the live save path rather than dead code. Grep logs for `replace_book_pages() is missing`. |
| `011_dunning_grace.sql` | The dunning grace period never expires, so a `past_due` subscription keeps Pro indefinitely — the behaviour this branch set out to fix. The webhook detects the missing columns (`42703`), logs loudly, and still applies the rest of the event. |

### Configure what's optional

Three integrations are optional at deploy time and each degrades silently by
design. Know which are on:

| Env | Without it |
|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | The import's "find products and write descriptions" option is hidden. |
| `RESEND_API_KEY` + `EMAIL_FROM` | No lead notifications. A captured email is only visible in Insights. |
| `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PRICE_PRO` | No self-serve upgrade. `/account` falls back to a link to the pricing section. |

### Authorize the Sentry and Stripe MCP servers

Both need OAuth via claude.ai connector settings. Without them there is no error
reporting and no way to exercise the billing paths.

---

## 2. What changed on this branch, and the reasoning you'd otherwise rediscover

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

### The retention assets were invisible

Per-edition analytics sat behind an unlabelled icon on one card. `/insights` is a
nav item covering every edition, cards show readers rather than page counts, and
the dashboard's stat cards count readers and captured emails instead of the
author's own output. A captured lead now emails the author, where before it sat
in the events table until someone exported a CSV.

---

## 3. Known-remaining risks

Ordered by how much they'd hurt.

1. **The three migrations above.** Everything else assumes they land.
2. **`lib/insights.ts` aggregates in JS with a 20,000-row cap.** Right at this
   size, wrong later — the cap is what stops a popular edition turning the
   dashboard into a memory problem. When accounts trip it routinely, this becomes
   a materialised view keyed by (book, day). The cap is silent; it does not tell
   the author their numbers are truncated.
3. **Autosave still rewrites every page on every save.** Atomic now, so wasteful
   rather than dangerous. Diffing is the fix; the in-flight race handling in
   `EditorClient` is load-bearing, so read it first.
4. **An abandoned import still strands an empty edition** holding a slug and a
   quota slot. Less severe now that Free allows three, and visible/deletable in
   the dashboard.
5. **Client-side PDF rendering on phones is untested.** The landing preview
   renders at scale 1 and caps at 6 pages to keep it cheap, but a low-memory
   device has not been measured.
6. **Never audited, still reachable:** `HotspotModal` / `HotspotIcon`.

---

## 4. Decisions that are the owner's, not the implementer's

- **Slug editing for existing editions:** 301 from the old slug, or accept the
  break? The public link is still permanent and the import dialog says so.
- **Password protection / view-once:** the schema fields are gone now, not just
  the controls. Build them properly or leave them out.
- **Custom domain:** removed from all copy. It needs domain routing, certificate
  provisioning and verification — a project, not a fix.
- **Pricing:** $19 Pro is unvalidated and undercuts Issuu, Flipsnack and
  FlippingBook. See the audit §7.5 and §10.
- **Social proof:** the unsourced claims are gone and nothing replaced them.
  That gap closes with real design partners, not copywriting.

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
