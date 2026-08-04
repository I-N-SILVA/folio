# Handover

State of QLICO as of the `claude/app-ui-ux-improvements-swrrrt` work (21 commits,
merged to `main`). Written for whoever picks this up next — human or agent.

Verification baseline at merge: **89 tests across 11 files passing, 0 lint
errors, 31 lint warnings, `tsc --noEmit` clean, production build clean.**

```bash
npm run typecheck && npm test -- --run && npm run lint && npm run build
```

---

## 1. Do these before launch — nothing else on this list matters more

### Apply the pending migrations

Two migrations were written but **never applied**, because the Supabase account
reachable from the session that wrote them contained only unrelated projects
(`Plyaz-Oraculum`, no `books` table). Check what's actually applied before
assuming:

| Migration | Consequence if missing |
|---|---|
| `009_add_gate_view_event.sql` | Postgres rejects every `gate_view` insert, so the lead-capture funnel silently reads zero. |
| `010_replace_book_pages.sql` | Autosave falls back to a non-atomic delete-then-insert. |

`010` matters most. `PUT /api/books/[id]/pages` prefers the
`replace_book_pages()` function; if it's absent it detects `PGRST202`/`42883`,
logs a loud error, and falls back to the old two-statement path — but snapshots
the pages first and restores them if the insert fails. So saving still works
un-migrated, it just isn't atomic. Grep the logs for `replace_book_pages() is
missing` to find out whether this is live.

### Authorize the Sentry and Stripe MCP servers

Both need OAuth via claude.ai connector settings. Without them there is no error
reporting and no way to exercise the billing paths listed in §3.

---

## 2. What changed, and the reasoning you'd otherwise have to rediscover

Nine themes, in rough order of how badly they were broken.

**Data loss in autosave.** `PUT /api/books/[id]/pages` replaced pages with a
bare `DELETE` then `INSERT` — two round-trips, no transaction — every ~2 seconds
while editing. Anything that stopped the insert made the book permanently empty.
Note *why* an upsert isn't the fix: `UNIQUE (book_id, page_number)` is checked
per row, so a reorder (page 3→5 while 5→3) collides mid-statement. That's why
the original deleted first, and why the fix is a transaction rather than a
different write shape. Verified against a local Postgres 16: identical failing
payload leaves **0** pages through the old path and **2** through the new one.

**Four check-then-write claim sites.** Book slug (already correct, and carries a
comment saying why), AppSumo licence redemption (one code granted two paid
plans), Stripe customer creation (a completed payment granted nothing), and the
licence webhook upsert (returned a claimed licence to the pool). All now let the
database arbitrate. `lib/appsumo.ts` has the fullest write-up.

**`/editor/[id]` loaded books it didn't own.** `books` carries *two* SELECT
policies, and `public_read_published` matches any published book for any caller,
so an unqualified select rendered the full editor over a stranger's book. **This
is a trap worth remembering: an unqualified select against a table with a public
read policy is not scoped by RLS the way it looks.** Now filters on `owner_id`.

**Service worker cached private data.** It ended in a catch-all
stale-while-revalidate, which swallowed RSC payloads (`?_rsc=` is not
`mode:'navigate'`) — persisting authenticated dashboard payloads to disk past
sign-out and serving them stale — and broke media seeking (Cache API ignores
Range). Now an allowlist. **Never put a denylist in a service worker: it
outlives the deploy that installed it.** `VERSION` is at `v2` so `activate()`
purges v1 caches on returning visitors.

**PDF import couldn't import real PDFs.** All rendered pages went up in one
multipart body against a serverless body cap an order of magnitude smaller; the
client "handled" this by refusing to start above 40 MB and telling the author to
split the file. Pages now go browser→storage directly via signed upload URLs;
`/api/import/pdf/finalize` reads back what landed. Storage — not the request
body — is the authority on which pages exist.

**Three of three "Access Control" settings were no-ops.** `password` and
`burn_after_reading` were removed as false security promises; `unlisted` was
implemented as real `noindex`. See §4 — this needs a product decision.

**Server-side lead gating.** Was client-side only, so the withheld pages shipped
in the HTML. `lib/gating.ts` now truncates server-side; `/api/books/unlock`
records the lead *before* releasing pages and fails the request if that insert
fails.

**AI is optional and the UI now says so.** `lib/ai.ts` built its client with
`|| ''` and never checked, so a keyless install made 50 doomed Gemini calls per
import while the checkbox promised hotspots and SEO. `isAiEnabled()` gates both
call sites; `/api/entitlements` exposes `ai.enabled`; the modal reflects it.

**UI/UX.** Dark mode across app chrome, one home for page geometry
(`lib/page-geometry.ts` — four surfaces had drifted between 280px and 460px
design width, which is why rail previews overflowed), a shared `Modal` primitive
replacing eight hand-rolled overlays, and the two creation flows collapsed into
one.

---

## 3. Known-remaining risks

Ordered by how much they'd hurt.

1. **`past_due` grants Pro indefinitely.** No dunning limit, and subscription
   events are trusted as delivered though Stripe can reorder them. Needs a real
   Stripe account to exercise.
2. **Autosave rewrites every page every 2s** even for a one-word change. Atomic
   now, so wasteful rather than dangerous. Diffing is the fix; the in-flight
   race handling in the editor store is load-bearing, so read it first.
3. **An abandoned import strands an empty book.** The client deletes it on the
   error path, but closing the tab mid-upload leaves an orphan holding a slug
   and a quota slot. Visible in the dashboard and deletable — not silent.
4. **Never audited, still reachable:** `HotspotModal` / `HotspotIcon`, and
   per-card empty states in analytics.

---

## 4. Decisions that are the owner's, not the implementer's

- **Password protection / view-once:** build them properly or leave them out?
  Both were removed rather than left as fake security.
- **Slug editing for existing books:** 301 from the old slug, or accept the
  break?

---

## 5. Conventions and traps specific to this codebase

Read `AGENTS.md` first — this Next.js (16.2.6) differs from training data, and
`node_modules/next/dist/docs/` is the authority.

- **Tailwind v4 `@theme inline`: an unregistered colour utility generates
  nothing and fails silently.** `bg-primary` produced
  `background: rgba(0,0,0,0)` behind white text — an invisible button that no
  test or typecheck catches. Arbitrary data-URI values also failed quote
  escaping; the select chevron lives in `.studio-select` in `globals.css` for
  that reason. **Verify colour changes with a computed style or a screenshot.**
- **Portals and hydration:** portal content must report "not mounted" for the
  hydration pass. `Modal` uses `useSyncExternalStore` for this. Returning `null`
  on the server and content on first client render left React's recovery with a
  *second* live dialog in the DOM.
- **`PageRenderer` output can never be wrapped in an interactive element** — it
  contains `<a>`, `<button>`, `<audio>`, `<iframe>`. Click targets must be
  sibling overlays. This caused two separate hydration failures.
- **react-pageflip** fixes page count at mount and throws on a `false` child.
  Build children as an **array**, never with JSX `&&` — `{isLocked && …}` broke
  the ungated reader, and only the embed check caught it.
- **`.upsert({ onConflict })` only SETs the columns you list.** Omitting a
  column preserves it, which is load-bearing in `applyAppSumoEvent`.
- **Grep for unimported components as a habit.** Two complete features
  (`PageManagerModal`, `ShareModal`) were dead code nothing imported. No test or
  typecheck catches it.
- **Postgres 16 is available in the container** (`/usr/lib/postgresql/16/bin`,
  run as the `postgres` user, not root). Build the schema locally and test SQL
  against it rather than reasoning about it — that's how the atomicity claim in
  §2 was verified.
- **When you fix a bug, revert the fix and confirm the new test fails.** Done
  for every fix in this branch. A test that passes against broken code is worse
  than no test.
