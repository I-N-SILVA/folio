# Learnings

One line per thing that broke, why, and the test that now guards it.

## Saving

- **A URL field the author had not finished typing 400'd the save for the whole
  edition.** `PUT /api/books/[id]/pages` validates every page as one array, so a
  single rejected value takes the entire book down, on every autosave, reported
  as "Could not save these pages". `draftableUrl` / `draftableHref` fixed most
  fields; `HotspotMediaSchema.src`, its `poster` and `AmbientAudioSchema.src`
  were missed and failed the same way. Guarded by `lib/editor-save.test.ts`.
  **Rule: a draft value must always be storable. Publish is where a URL has to
  be real — that check belongs in `lib/publish-checks.ts`, not in the save path.**

- **`z.string().url()` is the wrong tool for a link.** It is built on `new URL()`,
  which accepts `javascript:alert(1)` while rejecting `example.com` and `''` —
  exactly backwards for a field rendered into `<a href>`. Guarded by
  `lib/editor-save.test.ts`.

- **A cleared number input saves as `NaN`, and JSON turns that into `null`.**
  `EmbedBlockSchema.height` rejected both. Any `z.number()` fed by a
  `type="number"` register needs to tolerate them.

- **The service-role key silently fell back to the anon key.** Every server-side
  "admin" client became anonymous on a deployment that had not set it, which
  broke saving two different ways: 403 on a draft (`books` RLS gives anon
  nothing) and a 42501/500 on a published edition (`replace_book_pages` is
  granted only to `service_role`). Neither error mentions configuration.
  Guarded by `lib/supabase-admin.test.ts`. **Rule: never default a
  privileged credential to a weaker one — fail loudly instead.**

- **A save requested while one was in flight was dropped.** The early return
  assumed "the trailing edit will schedule its own", which only holds while the
  author keeps typing. Stop typing during a slow save and the last edit was
  lost, silently. `EditorClient` now queues and drains it.

- **The save payload hand-lists page fields, so `ambientAudio` was dropped on
  every save** — the first autosave after opening a template or an imported PDF
  wiped the page's ambient track. `lib/editor-save.test.ts` now reads the real
  payload out of the component and holds it against `PageSchema`, so the next
  field added to one and not the other fails a test instead of production.

- **A bare domain broke the save, and the fix was not in the schema.**
  `draftableHref` is built on `new URL()`, which throws on `example.com` — the
  single most common thing a person types into a link field. Loosening the
  schema would have been wrong: `<a href="example.com">` navigates to a
  *relative path* of that name, so it is a broken link either way. Normalising
  at the input (`urlField` → `normalizeLink`) gives the author what they meant
  and lets the schema keep its teeth. **Rule: when strict validation rejects
  something a user reasonably typed, fix the input, not the validator.**

- **Three number fields failed the same way a half-typed URL did.** A
  `type="number"` input cleared in order to be retyped yields `NaN` with
  `valueAsNumber`, and JSON turns that into `null`. The embed height, the lead
  gate's page number and a hotspot's step number each refused it, and each took
  a whole save down with it. `draftableNumber` clamps instead — the bounds are
  what the field means, and an author is allowed to pass through an invalid
  value on the way to a valid one.

- **react-pageflip was mounted on a zero-width measurement.** `ResizeObserver`
  reports 0 for a container that has not been laid out yet, `applySize` bailed
  on it, but `setMeasured(true)` fired anyway — so the library locked in
  *landscape at 600px* before any real measurement arrived, which is precisely
  the "two-page spread crammed into a phone width" the comment above it warns
  about. Orientation is fixed at mount, so the guard has to wait for a real one.

- **PGRST202 cannot tell "no such function" from "no such signature".** Probing a
  Supabase RPC with `{}` for arguments answers "could not find the function without
  parameters" — the same error a present function gives when you guess its parameter
  names wrong. That produced a confident, false report that the save function and the
  AppSumo claim function were both missing from production. Read the argument names off
  the real `.rpc('fn', { ... })` call site before concluding anything.

- **A hidden browser tab reproduces "the page is blank" perfectly.** The Browser pane runs
  with `document.hidden === true` and `innerWidth === 0`, and a viewport-dependent
  component then sits on its Suspense fallback forever — at *every* emulated width, which
  is what makes it read as a mobile bug. Check `document.hidden` and `innerWidth` before
  believing any rendering or timing measurement taken there. Assert on
  `document.body.innerText.length`, never on a screenshot, and never quote a load time
  measured in a hidden pane.

- **Minified bundles do not contain their libraries' names.** Grepping built chunks for
  `framer-motion` or `recharts` returns nothing whether or not they are in there, and
  chunk hashes change every build so names from an older network log no longer exist on
  disk. To find out what a route actually ships, read
  `performance.getEntriesByType('resource')` from the live page.

## Duplication

- **Eight inspector forms carried an identical `useForm` + `watch` +
  `updateBlock` effect.** Eight places to forget a dependency, and — worse —
  nowhere to put the URL normalisation every one of them needed.
  `useBlockForm` owns it now, and `components/studio/settings/url-fields.test.ts`
  fails if a new link or media field is registered without `urlField`.

## Reader

- **Analytics must never be able to fail a page view.** `POST /api/events`
  answered 500 on every reader load when it could not reach the database. It
  accepts and drops instead.

- **A read path must not 500 because a write credential is missing.**
  `findCurrentSlug` (renamed-link forwarding) and the OG image route both threw
  once the admin client stopped falling back to anon, turning a missing edition
  into a 500 instead of a 404.

## Brand assets

- **`next/image` will not serve an SVG.** It routes even a local `/public` file
  through `/_next/image`, which answers 400 "image type is not allowed" unless
  `images.dangerouslyAllowSVG` is set. Six logos shipped rendering nothing
  because of this, including the login page, and nothing caught it: a missing
  logo throws no error and fails no test. `dangerouslyAllowSVG` is not the fix
  here, because `*.supabase.co` is an allowed remote pattern and authors upload
  images there, so it would serve user-supplied SVG through the optimiser.
  **Rule: inline a first-party SVG (it costs no request, no layout shift, and
  can inherit `currentColor`), or pass `unoptimized` when the file itself is
  the deliverable.** Guarded by `components/landing/logo-rendering.test.ts`.

- **A grep for `<Image ... src=` on one line misses the multi-line ones.**
  That is how the dashboard header's broken logo survived a sweep that found
  the other five. Scan for the element and read to its closing `>`, and strip
  block comments first or the prose explaining the bug gets reported as the bug.

## Half-built features

- **`ambientAudio` is declared, played, and stored nowhere.** `PageSchema` has
  the field and `ViewerChrome` plays it, but `pages` has no column for it and
  `replace_book_pages` does not write one, so the database discards it on every
  save. No editor control sets it either. It only reaches a reader through a
  bundled demo book's JSON. Verified end to end: a save carrying it returns 204
  and the field comes back absent. **Rule: a field in the schema is not a
  feature. Trace it to a column and to a control before believing it works.**

- **Free-tier quota enforcement is genuinely server-side.** Confirmed against
  the live database with a disposable account: the fourth edition is refused
  with 403 `plan_limit`, `used: 3, limit: 3`, and `/api/entitlements` flips to
  `allowed: false`. This is not UI-only gating.

## QA

- **A hidden tab never reveals a Suspense boundary.** Proven, not guessed: a
  same-origin fetch of `/dashboard` from inside the signed-in page returned 63KB
  of real server HTML while the tab still showed `loading.tsx`'s skeleton and
  `body.innerText.length` was 0. `document.hidden` was true. So in the Browser
  pane, **every route with a `loading.tsx` appears permanently blank** — reader,
  dashboard, editor, analytics — at every viewport, desktop included. That is
  the environment, not the app. Check `document.hidden` before believing it.

- **Screenshots of the reader are not evidence.** Its transforms make the pane
  capture a blank frame while the DOM is fully populated. Check
  `document.body.innerText.length`, not the pixels — in both directions.
