# Handoff

**Written:** 2026-09-11
**Branch:** `main`
**Verify with:** `npm run typecheck && npm run test && npm run lint && npm run build`

## State in one line

The editor save path is fixed and merged (7 commits, `main` = `origin/main` at `30c2aea`,
plus `5203aa1`). Nobody is blocked on code. **The remaining launch blockers are all
database and deployment configuration**, and two of them stop an AppSumo launch dead.

## Next concrete action

1. Apply `supabase/master_migration.sql` to the **live** project `kmjjevssxwzyviofhsal`
   (Supabase dashboard → SQL Editor → paste → Run). It is idempotent: every `DROP` is
   `IF EXISTS` on a trigger or policy that is recreated two lines later, every table is
   `CREATE TABLE IF NOT EXISTS`, every function `CREATE OR REPLACE`. No `DROP TABLE`.
   The live database is roughly at migration 013 and is missing 014-020.

2. Re-verify with the repo's own probe:
   `CRON_SECRET=local-dev-only node scripts/preflight.mjs http://localhost:3000`
   Expect `claim_appsumo_license` and `claim_digest_slot` to flip to present.

3. Set `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SITE_URL` in **Vercel production**,
   then `CRON_SECRET=<prod-secret> npm run preflight https://qlico.app`.

## Why this approach

**Normalising links at the input, not loosening the schema.** `draftableHref` rejected
`example.com`, which 400'd the save for the whole edition. The obvious fix is to relax the
schema. That was rejected: `<a href="example.com">` navigates to a *relative path* of that
name, so it is a broken link either way, and the schema is what keeps `javascript:` out of
a public page. `normalizeLink` on blur gives the author what they meant and leaves the
validator strict. Same reasoning for `draftableNumber`: clamp into range rather than
refuse, because the bounds *are* the field's meaning.

**Failing loudly on a missing service key rather than falling back to anon.** The fallback
was the single highest-cost line in the repo: it silently made every admin client
anonymous, and saving then failed as a 403 on drafts and a 500 on published editions,
neither mentioning configuration. A 503 that says what is wrong is worth more than a
deployment that half-works.

**Read paths degrade, write paths fail loudly.** Removing that fallback made three read
paths throw (analytics, slug forwarding, OG image). They now return 204/404/a fallback
card instead. A missing *write* credential must never turn a reader's page into a 500.

## Already ruled out

- **"The reader is broken on mobile."** Chased five separate times across two sessions.
  It is not established. The Browser pane runs with `document.hidden === true` and an
  `innerWidth` of 0, and **that reproduces the identical symptom at desktop width** —
  a permanent `loading.tsx` skeleton, `body.innerText.length === 0`. Every timing number
  taken in that pane (33s, >50s) is confounded and should not be quoted. Do not re-measure
  reader load time in the Browser pane. Use a real device, or Lighthouse via headless
  Chrome with the tab foregrounded.

- **Bundle archaeology by grepping built chunks for library names.** Minification strips
  them; every probe returned "absent" including for libraries that are definitely present.
  Chunk hashes also change on every rebuild, so names captured from a previous network log
  no longer exist on disk. The measurement that *did* work is
  `performance.getEntriesByType('resource')` in the live page.

- **Probing PostgREST RPCs with `{}` for arguments.** PGRST202 says "no function *without
  parameters*", which is the same error whether the function is absent or merely has a
  different signature. This produced a false report that `replace_book_pages` and
  `claim_appsumo_license` were both missing. `replace_book_pages` is present. Always pass
  the real parameter names — read them from the `.rpc('fn', { ... })` call site.

- **Working against the local checkout without fetching first.** The tree was 63 commits
  behind `origin/main`, and upstream had already fixed most of the save bug with
  `draftableUrl`/`draftableHref`. An entire pass of work was redundant and discarded.

## Load-bearing but untested

- **The editor has never been exercised signed in.** Every save fix is verified at schema,
  route and unit level plus a full route sweep — not by clicking Save as a logged-in
  author. The riskiest single gap. One manual pass: add a hotspot, type `example.com` into
  a button, clear the embed Height box, confirm the badge reaches "Saved".

- **Eight inspector forms were refactored onto `useBlockForm` with no component tests.**
  Typecheck and lint pass and the diffs are additive (no hook-order changes), but nothing
  renders these in CI. `components/studio/settings/url-fields.test.ts` only greps source.

- **`scripts/verify-appsumo-e2e.sh` and `verify-routes-e2e.sh` have never run here** — they
  need a local PostgreSQL and PostgREST, neither installed. They cover the AppSumo webhook
  writing a real row, which is the revenue path.

- **The 600ms measurement fallback in `ViewerEngine`** (`5203aa1`) could not be verified in
  the Browser pane for the reason above. The logic is simple and tests pass, but it is
  unobserved in a real browser.

## Open questions for the user

- **The Supabase CLI is linked to a different project than the app uses.**
  `supabase/.temp/linked-project.json` says `tmofalltchtetvtzaogg`; the app and the service
  key point at `kmjjevssxwzyviofhsal`. Which is live? Anything run through the CLI right
  now targets the wrong database.

- **The service-role key was pasted into a chat transcript.** It is in `.env.local`
  (gitignored, verified) and was never committed, but it now exists outside the password
  manager. Rotate it in Supabase → Settings → API before launch.

- **Is an AppSumo listing dependent on the version-history and review-comment features?**
  They are dead until migrations 018/019 land. If the listing does not mention them, that
  is a warning rather than a blocker.

## Repo state at write time

Generated, do not hand-edit. Re-run the script instead.

### Uncommitted (`git diff --stat`)

```
(working tree clean)
```

### Untracked

```
.claude/launch.json
```

### Recent commits

```
5203aa1 fix(reader): waiting for a real measurement must not mean never mounting
30c2aea merge: the editor save path, end to end
938bd7e docs: what broke in the save path, and what now guards it
182dbee fix(reader): react-pageflip was mounted on a zero-width measurement
30d50a2 fix(editor): a save requested during a save was dropped, and ambient audio wiped
c8c1cc1 fix(config): the service-role key silently fell back to the anon key
ef98768 fix(save): a bare domain is normalised instead of rejected
c430876 fix(save): a value the author is still typing no longer 400s the whole edition
```
