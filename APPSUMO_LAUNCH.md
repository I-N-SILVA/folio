# QLICO — AppSumo Launch & Go-To-Market Plan

A complete plan to launch QLICO as a premium SaaS on **AppSumo** (lifetime-deal
marketplace), covering the deal structure, the technical integration already
wired into this repo, the listing assets, pricing math, and the week-by-week
go-to-market motion.

> TL;DR: the licensing backbone is built (webhook, redemption, tiered
> entitlements, plan enforcement). What remains is configuration + content:
> Supabase migrations applied, AppSumo partner approval, listing assets, and the
> launch motion below.

---

## 1. Why AppSumo

- A built-in audience of ~1M+ buyers actively looking for tools.
- A burst of revenue + reviews + backlinks in a short window.
- Lifetime deals (LTDs) are a one-time payment, so we don't need Stripe live to
  launch — we need a **license + entitlements** system, which QLICO now has.

Trade-off: LTD buyers are demanding and churn-proof (they paid once, forever).
Tier the deal so support cost stays sane and there's an upsell path.

---

## 2. The deal structure (LTD tiers)

These map 1:1 to `lib/plans.ts` (`ltd_tier1..3`) and to AppSumo purchase tiers
via `APPSUMO_TIER_TO_PLAN`.

| Tier | Price (typical) | Books | Analytics | Custom domain | White-label | Target buyer |
| ---- | --------------- | ----- | --------- | ------------- | ----------- | ------------ |
| **1** | ~$59 | 10 | 90 days | — | — | Solo creators, freelancers |
| **2** | ~$119 | 50 | 180 days | ✓ | ✓ | Studios, small agencies |
| **3** | ~$239 | Unlimited | 365 days | ✓ | ✓ | Agencies, power users |

All tiers include: interactive reader, hotspots, PDF import, lead gating, CSV
export, no QLICO watermark. Stack-friendly (AppSumo buyers can stack codes to
move up tiers — handled by the `enhance`/`reduce` webhook actions).

**Pricing math:** AppSumo takes ~70% of LTD revenue and another cut on the
platform. Price so that even after the split each sale covers ~18–24 months of
that user's marginal infra cost. QLICO's per-user cost is low (Supabase rows +
storage + edge), which makes LTD viable.

---

## 3. Technical integration (already in this repo)

| Piece | Location | Notes |
| ----- | -------- | ----- |
| Plan catalog & entitlements | `lib/plans.ts` | Single source of truth; `Infinity` = unlimited |
| Server entitlement helpers | `lib/entitlements.ts` | `getUserPlan`, `checkBookQuota`, profile auto-provision |
| AppSumo license logic | `lib/appsumo.ts` | Signature verify, event apply, redeem, profile sync |
| Webhook endpoint | `app/api/appsumo/webhook/route.ts` | `POST` events, `GET` health check |
| Redemption API | `app/api/appsumo/redeem/route.ts` | Links a code to the signed-in user |
| Redemption UI | `app/(studio)/redeem/page.tsx` | Paste code → unlock tier |
| Account page | `app/(studio)/account/page.tsx` | Plan, usage meter, entitlements |
| Quota enforcement | `app/api/books/route.ts` | 403 `plan_limit` when over book cap |
| DB schema | `supabase/migrations/004,005,013_*.sql` | `profiles`, `appsumo_licenses`; 013 backfills every column on a table that predates them |
| Quota endpoint | `app/api/entitlements/route.ts` | Powers the create-modal quota meter + upgrade wall |
| DB-level limit | `supabase/migrations/006_*.sql` | Trigger backstops the book cap on any insert path |
| Stripe billing (Pro) | `lib/stripe.ts`, `app/api/billing/*` | Checkout, portal, webhook; coexists with LTD plans |
| Offline / PWA | `public/sw.js`, `components/ServiceWorkerRegistrar.tsx`, `app/offline/page.tsx` | Installable + offline fallback |
| Config | `.env.example` | `APPSUMO_API_KEY`, Supabase keys, optional Stripe |

### Webhook actions handled
- `activate` — new purchase → create active license.
- `enhance` — tier up (stacked code) → new `license_key`, carry redemption link.
- `reduce` — tier down → lower plan.
- `refund` — deactivate license → profile reverts to Free.
- `test` — AppSumo verification ping → 200.

Signature: HMAC-SHA256 of the raw body using `APPSUMO_API_KEY`, compared in
constant time. **Fails closed in production** if no key is set.

### Go-live checklist (technical)

Three of these are scripts rather than boxes, deliberately. Every serious
failure this codebase has had looked ticked — a CHECK constraint two values
behind the app, a consolidated migration three migrations behind, four buttons
that were white on white in dark mode. Tick the boxes; run the scripts.

**Configure**

- [ ] Apply **`supabase/master_migration.sql`** to the production Supabase
      project. It is generated from every numbered migration (`npm run
      db:master`), idempotent, and safe to re-run — so it is also how you bring
      an existing project up to date. Do not apply migrations by hand and do not
      edit that file: it said `001`–`007` here for months while three later
      migrations existed, and a database built from the stale copy silently
      dropped every lead-capture event and refused two of the six page layouts.
- [ ] Set `APPSUMO_API_KEY`, the Supabase keys, `NEXT_PUBLIC_SITE_URL` and
      `CRON_SECRET` in prod. `APPSUMO_API_KEY` must be the value from the
      AppSumo partner dashboard — a mismatch rejects every real purchase and
      looks exactly like "no sales yet".
- [ ] Set AppSumo "Notification URL" → `https://<domain>/api/appsumo/webhook`.
- [x] Reconcile field/header names in `lib/appsumo.ts` against AppSumo's
      developer docs. **They did not match.** This file was written against the
      Licensing API **v1** — `action`, with `activate` / `enhance` / `reduce` /
      `refund`. The current **v2** sends **`event`**, with `purchase` /
      `activate` / `upgrade` / `downgrade` / `deactivate` / `migrate`. On a v2
      deal every webhook would have been rejected `400 missing action` and no
      licence would ever have been created.

      Both shapes are accepted now (`normalizeAction`), and both are exercised
      over HTTP by `npm run verify:routes:e2e`. Sourced from AppSumo's published
      documentation via search — `docs.licensing.appsumo.com` is not reachable
      from the build network — so **still send a real test event and confirm a
      row lands**, which is the dry-run below.

      The **signature** differed too, and it was the same severity. v1 signs
      the raw body; v2 signs `X-Appsumo-Timestamp` concatenated directly in
      front of the body, no separator —
      `hash_hmac('sha256', $timestamp . $body, $secret)`. This verified the
      body alone, so every v2 webhook got a 401, AppSumo retried a non-2xx
      forever, and no licence was ever created. Both constructions verify now,
      which is not a weakening: each still requires the shared key.

      One thing deliberately not handled: `parent_license_key` on v2 add-on
      webhooks. This product sells no add-ons, and `migrate` is ignored with a
      200 rather than retried forever.

      One hazard worth knowing rather than fixing speculatively: nothing orders
      events by `event_timestamp`, so a retried `activate` arriving after a
      `refund` would re-activate a refunded licence. `lib/stripe` already
      solves the equivalent with `stripe_event_at`; if AppSumo's retries ever
      show up out of order, that is the pattern to copy.
- [ ] (Optional, for the ongoing Pro channel) set `STRIPE_SECRET_KEY`,
      `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PRICE_PRO`, and point a Stripe
      webhook at `https://<domain>/api/billing/webhook`. Not needed for an
      LTD-only launch — `npm run preflight` reports its absence as a warning,
      not a blocker.
- [ ] Own the three mailboxes the app prints: `support@`, `legal@`, `privacy@`
      (see `app/help`, `app/terms`, `app/privacy`).

**Verify — these have to pass, not be believed**

```bash
CRON_SECRET=…      npm run preflight     -- https://<domain>   # config + live schema
APPSUMO_API_KEY=…  npm run verify:appsumo -- https://<domain>  # the whole licence path
                   npm run audit:browser  -- https://<domain>  # what it renders
```

- [ ] `preflight` clean. It reads the deployment's own environment (presence,
      never values) and probes the live database: the tables, the columns, the
      **functions**, and whether the CHECK constraints accept everything this
      code can produce. Those last two are the gap the unit tests cannot close —
      they compare the app to the `.sql` files, which catches a migration nobody
      wrote, not one nobody applied.

      Read the `function …()` lines specifically. `claim_appsumo_license` absent
      means **every redemption on launch day answers "We could not find that
      license code"**, and until this check existed a deployment in exactly that
      state reported the same clean bill as a working one. Each failing line
      names the migration to apply and what a buyer experiences without it.
- [ ] `verify:appsumo` clean. Sends the `test` event AppSumo's checklist asks
      for — and confirms the webhook refuses unsigned and wrongly-signed
      requests, that the redemption API refuses anonymous callers, and that a
      signed-out buyer arriving with `?code=` is sent to sign in with the code
      carried across rather than shown the word "Unauthorized". Safe against
      production: `test` touches no rows.
- [ ] `audit:browser` clean. Both colour schemes at four widths.
- [ ] `audit:theme` clean. The same DOM under light and dark: anything rendering
      identically in both has stopped following the theme, and contrast is
      measured against what is actually behind the text.
- [ ] Confirm `Sign in with magic link` works on the deployed domain.

**Dry-run with a real code** — the one thing no script can do

- [ ] Have AppSumo issue a test license → confirm a row lands in
      `appsumo_licenses` → redeem it in-app at `/redeem` → confirm the plan on
      `/account` → refund it → confirm the account reverts to Free.

---

## 4. Pre-launch (product polish)

- [x] Empty/limit states: all four paths that can create an edition — blank,
      from a starter template, from one of the author's own templates, and PDF
      import — return `code: 'plan_limit'` and raise the same wall, which names
      the plan and its limit and offers both "See plans" and "Redeem a code".
      `BookCard`'s Duplicate and Save-as-template surface the server's message,
      which already names the limit.
- [x] Seed demo editions — four bundled editions (product tour, shoppable
      lookbook, living report, portfolio) served without Supabase from
      `data/books/` and featured on the landing page.
- [x] Onboarding: first-run checklist (create → add a hotspot → publish) on
      the dashboard (`components/studio/OnboardingChecklist.tsx`).
- [ ] Support: help docs + a shared inbox; AppSumo reviewers reward fast replies.
- [ ] Legal: Privacy Policy + Terms live (required).
- [x] PWA: manifest linked and served, all four icons present, the service
      worker registers and activates, and the theme colours now match what the
      page actually paints (the manifest said violet and the dark viewport said
      navy, neither of which the app has been for a long time). `colorScheme`
      declared only `light`, so the browser's own controls and scrollbars
      stayed light on a dark page; it is `light dark` now. Verified in Chromium
      via `npm run audit:browser`.
- [ ] Performance pass (see `LAUNCH.md`): Lighthouse ≥ 90.

---

## 5. AppSumo listing assets

- [ ] **Title + one-liner:** "Turn any PDF into an interactive flipbook readers
      actually finish."
- [ ] **Hero GIF/video (≤ 60s):** PDF in → interactive edition → hotspot click →
      analytics dashboard.
- [ ] 5–7 screenshots: reader, editor, hotspots, analytics, embed, account.
- [ ] Feature list mapped to tiers (use the table above).
- [ ] "Best for" + use-cases (commerce, creative, business, publishing).
- [ ] Roadmap section (signals momentum; LTD buyers love this).
- [ ] FAQ: redemption steps, stacking, refund window, data ownership.
- [ ] Founder intro video (authentic > polished).

---

## 6. Launch-week motion

| Day | Move |
| --- | --- |
| T-21 | Submit to AppSumo; begin partner review. Recruit 10 beta users for real reviews. |
| T-14 | Finalize tiers + assets. Warm up email list + socials ("LTD coming"). |
| T-7  | Private preview to beta users; collect testimonials + fix top issues. |
| T-1  | Final technical go-live checklist (section 3). Staff the support inbox. |
| **T-0** | **Deal goes live.** Email list, X/LinkedIn, founder communities, relevant subreddits. |
| T-0..3 | Reply to **every** AppSumo Q&A within hours. This drives the Taco rating. |
| T-3..14 | Ship 1–2 visible improvements from feedback; post them in the Q&A. |
| T+30 | Post-deal: convert engaged LTD users into advocates; gather case studies. |

**Targets to watch:** sales by tier, refund rate (keep < 10%), Taco rating
(aim ≥ 4.6), Q&A response time, activation rate (redeemed → first publish),
and review count.

---

## 7. Risk management

- **Refund abuse:** AppSumo has a 60-day refund window. The `refund` webhook
  auto-reverts entitlements, so refunded users can't keep premium access.
- **Support overload:** tiered limits + good docs keep volume down; templatize
  the top 10 answers.
- **Over-promising:** only list what's shipped. Mark roadmap items clearly.
- **Infra cost creep:** monitor heavy users; unlimited (Tier 3) is capped by
  fair-use in Terms.

---

## 8. After AppSumo

- Keep `pro` (subscription) as the ongoing channel for non-LTD customers.
- Use LTD reviews/testimonials as social proof on the landing page.
- Build the roadmap items that LTD buyers asked for → upsell Tier 3 + add-ons.
- Layer Stripe subscription billing (scaffolding noted in `.env.example`) for
  the post-AppSumo growth motion.

---

### Related docs
- `LAUNCH.md` — PWA hardening + App Store / Play Store packaging + PH launch.
