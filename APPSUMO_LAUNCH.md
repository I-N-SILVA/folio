# Riffle — AppSumo Launch & Go-To-Market Plan

A complete plan to launch Riffle as a premium SaaS on **AppSumo** (lifetime-deal
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
  launch — we need a **license + entitlements** system, which Riffle now has.

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
export, no Riffle watermark. Stack-friendly (AppSumo buyers can stack codes to
move up tiers — handled by the `enhance`/`reduce` webhook actions).

**Pricing math:** AppSumo takes ~70% of LTD revenue and another cut on the
platform. Price so that even after the split each sale covers ~18–24 months of
that user's marginal infra cost. Riffle's per-user cost is low (Supabase rows +
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
| DB schema | `supabase/migrations/004,005_*.sql` | `profiles`, `appsumo_licenses` |
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
- [ ] Apply migrations `001`–`007` to the production Supabase project.
- [ ] Set `APPSUMO_API_KEY`, Supabase keys, and `NEXT_PUBLIC_SITE_URL` in prod.
- [ ] (Optional, for the ongoing Pro channel) set `STRIPE_SECRET_KEY`,
      `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PRICE_PRO`, and point a Stripe
      webhook at `https://<domain>/api/billing/webhook`.
- [ ] Set AppSumo "Notification URL" → `https://<domain>/api/appsumo/webhook`.
- [ ] Reconcile field/header names in `lib/appsumo.ts` against AppSumo's current
      developer docs (payload keys can change between API versions).
- [ ] Send AppSumo's test event; confirm 200 + a row in `appsumo_licenses`.
- [ ] Dry-run: activate → redeem in-app → confirm plan on `/account` → refund →
      confirm revert to Free.
- [ ] Confirm `Sign in with magic link` works on the deployed domain.

---

## 4. Pre-launch (product polish)

- [ ] Empty/limit states: when a Free or LTD user hits their book cap, the
      create flow shows the upgrade message from the `plan_limit` response.
- [ ] Seed 3–5 stunning demo folios (catalog, lookbook, report, portfolio) so
      reviewers see the "wow" in 30 seconds.
- [ ] Onboarding: first-run checklist (import a PDF → add a hotspot → publish).
- [ ] Support: help docs + a shared inbox; AppSumo reviewers reward fast replies.
- [ ] Legal: Privacy Policy + Terms live (required).
- [ ] Performance/PWA pass (see `LAUNCH.md`): Lighthouse ≥ 90, installable.

---

## 5. AppSumo listing assets

- [ ] **Title + one-liner:** "Turn any PDF into an interactive flipbook readers
      actually finish."
- [ ] **Hero GIF/video (≤ 60s):** PDF in → interactive folio → hotspot click →
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
