# QLICO — Pricing & business-model feasibility

Desk research, 25 October 2026. Companion to `docs/product-strategy-audit.md`
(positioning, GTM) and `HANDOVER.md` §2 (the usage allowances this builds on).

**How to read the numbers.** Competitor prices come from review aggregators
(Capterra, GetApp, PricingSaaS, vendor blogs). The vendors' own pricing pages
could not be fetched from the research environment, and the aggregators
disagree with each other, often because one quotes annual billing and another
monthly. Treat every competitor figure as **±30%** and check the vendor's page
before quoting it anywhere public. Cost figures are list prices with stated
assumptions; the one that matters most (bytes per read) is **an estimate, not a
measurement**.

---

## 1. Verdict

- **Feasible as a lean, founder-run business. Not obviously a venture-scale one.**
  The category is mature and crowded, growing roughly 4–11% a year (estimates
  disagree on size: ~$0.7–1.6B globally, ~$0.4B US). There is room for a
  well-made product at a fair price. There is no sign the category alone
  supports a large outcome.
- **The price is too low for what Pro includes.** Lead capture is the most
  valuable thing in the plan, and competitors put it on tiers costing roughly
  $35–125/mo. **Move Pro to $29/mo ($290/yr).** That is still at or below every
  competitor that bundles lead capture with analytics.
- **Margins are healthy (~85–90%).** The cost to watch at scale is Vercel image
  optimisation: on its legacy per-source-image pricing, every imported page is
  billed, and at ~10,000 editions that alone is ~$1,200/mo. On the opt-in
  transformation pricing the same load is ~$25–50/mo (§3). *An earlier version
  of this line blamed raw-PNG bandwidth; readers get optimised images, so it
  was wrong.*
- **Use AppSumo for cash and reviews, capped, once the image-pricing model is checked.** Net per
  code is about $16–65, which covers years of a typical buyer's use; heavy
  importers are covered only on the right image pricing.

## 2. The market — what competitors charge

| Product | Entry paid | Tier with lead capture / branding | Notes |
|---|---|---|---|
| **Heyzine** | ~$4–5/mo (annual) | Premium ~$17–29/mo | Floor of the market; generous free plan (5 flipbooks, no watermark) |
| **Publuu** | ~$7/mo | Optimum ~$24 → Professional ~$58 | Lead forms advertised; which tier unlocks them is unclear |
| **Issuu** | Starter ~$19–21/mo | Unlimited ~$188/mo | Free plan shows ads; long-running price-rise grievance |
| **Flipsnack** | Starter ~$14–35/mo | Professional ~$35–52/mo; Business ~$85–109 | Lead capture, white-label sit at Professional+ |
| **FlippingBook** | Lite ~$19–26/mo | Optimal (branding + lead gen) ~$119–124/mo | No free plan; the strongest "sales tracking" framing |
| **DocSend** | Personal $10/user | Standard $45/user; Advanced $150 (3 users) | Not a flipbook — the "who read my document" competitor |
| **Papermark** | Free | Pro ~$29/user; Business ~$59 | Open-source DocSend alternative |
| **QLICO today** | **Free** | **Pro $19** — lead gate, CSV, badge removal, live data, 365-day analytics | |

What this says:

1. **Two markets meet here.** Flipbook tools compete on looks and price, and
   are crowded at $5–25. Document-tracking tools (DocSend, Papermark,
   FlippingBook's positioning) sell "know who read it", and charge $29–150.
   QLICO's hero line ("Send a PDF. See who actually read it.") puts it in the
   second market. Its price puts it in the first.
2. **At $19, QLICO undercuts the tier it actually competes with by about half**,
   and sits next to Heyzine and Publuu tiers that are cheaper and look similar
   to a buyer skimming a comparison table. Being cheap gives no lasting advantage
   against Heyzine's free plan.
3. **Nobody in the category leads with live data or commerce.** That was true in
   the August audit and is still the honest point of difference. Commerce has
   since been cut (owner's decision, Sept 2026), which leaves **live data blocks
   + server-enforced lead gating + per-page analytics** as the wedge.

## 3. Unit economics

### Variable cost per account

| Cost | Rate (list) | Per typical Pro account / month |
|---|---|---|
| Stripe card + Billing | 2.9% + $0.30, + 0.7% | $0.98 at $19 · $1.34 at $29 (annual: ~$0.60–0.90) |
| Storage (Supabase) | ~$0.021/GB-month | ~$0.04 at 2 GB · $0.21 at the 10 GB cap |
| AI detection (Gemini Flash) | ~$0.30/M in, $2.50/M out | ~$0.0014/page (est.) · $0.28 at 200 pages · $1.39 at the 1,000 cap |
| **Bandwidth (Supabase egress)** | **~$0.09/GB** | **see below — the cost that dominates** |
| Email, support tooling | — | ~$0.50 (allowance) |

**AI is cheap.** Even a Pro user at the full 1,000-page cap costs about $1.40 a
month. The allowances in `lib/plans.ts` protect against abuse, not against
normal use. They could be raised without hurting margin.

**Correction (same day): readers do not download the raw PNGs.** Page images
render through `next/image` (`components/blocks/ImageBlock.tsx`), so on Vercel a
reader gets a resized WebP/AVIF from Vercel's image cache, not the 2× PNG from
Supabase. Supabase egress is mostly the optimiser fetching each original once.
The first version of this section billed every read as raw PNG at Supabase's
rate and overstated the cost several times over. What readers actually cost:

| Cost | Rate (Vercel Pro, list; verify) | What drives it |
|---|---|---|
| Fast Data Transfer | 1 TB/mo included, then ~$0.15/GB (one source says $0.40) | ~2–3 MB per read (est., optimised WebP) → 1 TB ≈ 350–500k reads/mo free |
| Image Optimization, **legacy model** | ~$5 per 1,000 *source images* | **Every imported page is a unique source image.** 10,000 editions × 24 pages ≈ 240k sources ≈ **~$1,200/mo** |
| Image Optimization, **transformation model** (opt-in) | ~$0.05 per 1,000 transformations + cache reads/writes | The same 240k pages at ~2 widths ≈ **~$25–50/mo** |

So the scale risk is not bandwidth. It is **which Vercel image-pricing model the
project is on.** Opt into transformation pricing, or have the import write
pre-sized WebP files and serve them directly with `unoptimized` (see §9).
The raw PNG still reaches readers through the lightbox and feeds the AI
pass, so converting pages to WebP at import still cuts storage and those paths.
It is just no longer the emergency the first version described.

### Fixed cost

Supabase Pro $25 + Vercel Pro ~$20 + email ~$20 + domain/mail ~$10 ≈
**$75/mo**. Three to five Pro customers cover it. Fixed cost is not the
constraint.

### Lifetime value (margin-adjusted, LTV = price × margin ÷ monthly churn)

SMB SaaS churn is typically 3–7% a month; for SMB products under about $25 a
month it is 5–7%.

| | 3% churn | 5% churn | 7% churn |
|---|---|---|---|
| $19 Pro | $519 | $312 | $223 |
| $29 Pro | $831 | $499 | $356 |

**The annual plan is worth pushing.** Each annual subscriber is a year with no
monthly churn, and Stripe's $0.30 fixed fee is paid once instead of twelve
times. Show the yearly price first on the account page once it is
configured.

## 4. What it takes to reach a given revenue

Freemium free→paid conversion: typical 3–5%, strong 8–12% (ChartMogul /
ProductLed 2026; others report 2–8%). Assuming 70% of subscribers pay monthly
and 30% annually:

| Target MRR | Price | Paying customers | Active free accounts needed (5% / 3%) |
|---|---|---|---|
| $5,000 | $19 | 277 | 5,500 / 9,200 |
| $5,000 | **$29** | **181** | **3,600 / 6,100** |
| $10,000 | $19 | 554 | 11,100 / 18,500 |
| $10,000 | **$29** | **363** | **7,300 / 12,100** |

At $29 the same revenue needs about a third fewer customers, a third fewer
support tickets, and a third less free-account bandwidth. The usual cost of a
higher price is a slightly lower conversion rate. The table shows how much room
there is: at $29, converting at 3.3% earns the same as $19 at 5%.

**Realistic read.** Getting 3,000–6,000 *active* free accounts takes an
acquisition channel that works. The plan relies on two, both unproven: the
badge loop and founder-led outreach. $5k MRR inside 12 months is a reasonable
target if one of them works. $10k needs both, or a third channel (SEO
comparison pages, partnerships with Canva-adjacent tools).

## 5. AppSumo

AppSumo does not publish a fixed revenue share. Founders report keeping about
**20–40%**, with ~30% the most common figure, and buyers have a 60-day refund
window. At 30% with 10% refunds:

| Tier | Price | Net per code |
|---|---|---|
| 1 | $59 | ~$16 |
| 2 | $119 | ~$32 |
| 3 | $239 | ~$65 |

A typical buyer costs well under $1/mo to serve, so a code covers years of
use. A heavy agency importing hundreds of pages a month is covered only on
Vercel's transformation pricing, or with pre-sized images (§3).

- **Worth doing for cash, reviews and backlinks, not as the revenue model.** Every
  lifetime buyer is a customer who will never pay again, and LTD buyers expect
  support and a roadmap.
- **Cap the codes** (for example 500–1,000 total) and close the deal on a date.
  An uncapped LTD sells away the recurring revenue the business needs.
- **Confirm the image-pricing model first** (§3). The heavy Tier 3 user, who
  is exactly the agency profile Tier 3 targets, is the one who imports the most pages.
- **Put storage and AI caps on the listing.** An "unlimited" buyer who hits a
  cap they were not told about asks for a refund.

## 6. Recommended plan structure

| | **Free** | **Pro** | **Studio** *(when built)* |
|---|---|---|---|
| Price | $0 | **$29/mo or $290/yr** | **$79/mo or $790/yr** |
| Editions | 3 | 100 | 500 |
| Analytics | 30 days | 365 days | 365 days |
| Lead gate + CSV, live data, remove badge | — | ✓ | ✓ |
| Storage / AI pages | 500 MB / 50 | 10 GB / 1,000 | 50 GB / 3,000 |
| Seats, client workspaces, custom domain | — | — | ✓ |

- **Raise Pro for new customers only.** Stripe Prices are immutable, so anyone
  already on $19 stays there unless moved. Honour it publicly ("early
  customers keep $19 for life"); that line is also a launch incentive.
- **Studio waits for evidence.** Seats and custom domains are real projects.
  Build them when three agencies have asked, not before. Until then, the AppSumo
  Tier 2–3 buyers are the agency segment.
- **Keep Free generous.** Free has to stay good enough to publish one real
  edition, because the badge on that edition is the acquisition channel. The
  caps that matter for cost (bandwidth, AI) are handled technically, not by
  shrinking Free.

## 7. Risks to the model, in order of how much they would hurt

1. **No channel works.** Everything above assumes thousands of active free
   accounts. The badge click-through rate and the outreach reply rate are both
   unmeasured.
2. **Per-page image billing outruns revenue.** On Vercel's legacy image
   pricing, free accounts' imports are billed page by page. Check the
   project's billing model before any launch that brings a spike of imports
   (AppSumo, Product Hunt).
3. **Being placed in the wrong category.** If buyers compare QLICO with Heyzine
   ($5) rather than DocSend ($45), even $19 looks expensive. The landing page and
   comparison pages decide which list QLICO ends up on.
4. **LTD overhang.** A large lifetime base adds support load with no revenue.
   Caps on codes and on usage are the mitigation.
5. **Price is still a guess.** Nothing here is a customer saying "I would pay".

## 8. How to validate, cheaply, before committing

1. **Check the Vercel image-pricing model** on the project's billing page, and
   opt into transformation pricing if it is still per source image (10 minutes).
2. **Ask ten design partners the four Van Westendorp questions** — at what price
   is it too cheap to trust, a bargain, getting expensive, too expensive? Ten
   answers give a usable acceptable-price range. Do it in the outreach
   conversations already planned (`docs/product-strategy-audit.md` §12).
3. **Launch at $29 with the "early customers keep $19" offer** and watch
   checkout starts against completions (`checkout_started` is already
   tracked). If conversion from the account page is under ~2% after 200
   free signups, revisit the price.
4. **Track the badge.** Readers who click "Powered by QLICO" ÷ unique readers,
   and signups that follow. Under ~1% and the plan needs a different main
   channel.

## 9. Sustainable at scale — what breaks first, and what to do

> **Status:** items 1–4 are fixed (migration 022), along with a bug found while
> fixing them: reader events were stored with no page number. Edition limits
> are finite on every plan (Pro 100, Tier 3 200). Item 7 (abuse: reports,
> takedown, link checks) and item 10 (Stripe Tax, as a switch) are built
> (023). Pages are now stored as WebP. See `HANDOVER.md` §2. Still open: 5
> (Vercel image-pricing model — a billing setting), 6 (shared rate limiter —
> needs a Redis/KV account), 8 (usage add-on packs), 9 (archiving), 11–12
> (help centre, Sentry).

Read off the code on `claude/monetisation-guardrails`. Ordered by which bites
first as usage grows.

### Breaks before 1,000 users

1. **Insights go quietly wrong on any edition with more than ~1,000 events in range.**
   `app/api/analytics/[slug]/route.ts` selects raw `events` rows and adds them
   up in JavaScript. Supabase's API returns at most 1,000 rows by default, so
   past that point opens, completion and the heatmap are computed from a
   truncated sample, with no error. That is about 70 reads at ~15 events a
   read, and the most successful authors (the ones most likely to pay) hit it
   first. **Fix:** aggregate in SQL (an RPC like `edition_engagement`), or keep
   a daily rollup table.
2. **The weekly digest reaches only 200 people a week.** It runs once, Mondays
   09:00 (`vercel.json`), and each run is capped at `BATCH_SIZE = 200`; the
   rest wait for next Monday. With 1,000 eligible authors, each gets a digest
   about every five weeks. **Fix:** run the cron hourly on Mondays (or daily).
   Slot claiming already makes repeat runs safe.

### Breaks at ~10,000 editions or ~1M reads a month

3. **The events table outgrows the database.** At ~15 events × ~500 bytes
   (row + indexes, est.) a read, 1M reads a month ≈ 7.5 GB a month, against 8
   GB included on Supabase Pro. Nothing ever deletes events. **Fix:** keep raw
   events for 13 months at most (the longest plan window), roll older ones up
   into daily per-page counts, and prune with a cron job.
4. **One HTTP request and one insert per event.** Each page turn is a
   serverless invocation and a row write. **Fix:** batch events in the reader
   (one `sendBeacon` with an array, flushed on page hide) and insert them in one
   statement. That cuts invocations ~10×.
5. **Vercel image pricing** (§3): per-source-image billing grows with every
   imported page. Opt into transformation pricing, or pre-size pages at import.
6. **In-memory limiters and caches multiply with server instances.** The rate
   limiter (`lib/rate-limit.ts`) and the 30-second live-data cache
   (`lib/live-data.ts`) are per instance, so at scale each new instance fetches
   an author's source again and allows a fresh burst. **Fix:** move both to a
   shared store (Upstash / Vercel KV, or Next's data cache for live data).

### Business sustainability

7. **Abuse is the existential risk, not cost.** Hosted flipbook and document
   platforms are regularly used to host phishing pages. If Google Safe
   Browsing flags `qlico.app`, every customer's links break at once.
   **Do before scaling free signups:** a "report this edition" link on the
   reader, URL checks (Safe Browsing API) on hotspot and button links at
   publish, a kill switch to unpublish an edition, and serving readers from a
   separate domain from the app (for example `read.qlico.app`), so a flag
   doesn't take the dashboard down too.
8. **Sell usage instead of only refusing it.** The new storage and AI caps stop
   at a wall. Add-on packs (for example +10 GB for $5/mo, +1,000 AI pages for
   $5) turn heavy users into extra revenue instead of support tickets.
9. **Archive dead free editions.** A free edition with no reads for 12 months
   costs storage forever. Email the author, then archive it (unpublish, and
   move its pages to cold storage or delete them after notice). Paid plans are
   never archived; that becomes a reason to pay.
10. **Sales tax / VAT.** Selling subscriptions to EU, UK and many US-state
    customers means registering and remitting tax. Either turn on Stripe Tax
    (~0.5% a transaction) and register where thresholds are crossed, or move
    to a merchant of record (Paddle, Lemon Squeezy: ~5% + fees, and they
    carry the liability). For a solo founder, a merchant of record is usually
    the cheaper choice once sales are international.
11. **Support load scales with LTD buyers and free users, not revenue.** Keep
    the codes capped, put a self-serve help centre in front of email, and
    answer AppSumo Q&A fast. That is the one support channel that is public.
12. **Watch it.** Sentry is not connected (`HANDOVER.md` §1). Add spend alerts
    on Vercel and Supabase (leave Supabase's spend cap on until revenue
    covers overage), and a weekly look at cost per active edition. That
    number tells you whether the plan limits are right.

## 10. Running the MVP as cheaply as possible

The plan: **Vercel Pro, and free tiers for everything else that has one.**
Vercel Pro is not optional for a product that takes payments: Vercel's terms
limit Hobby to personal, non-commercial use, and a revenue-generating project
on Hobby can be paused.

| Service | Plan | $/month | Why this one |
|---|---|---|---|
| Vercel | **Pro, 1 seat** | **20** | Required for commercial use. Includes ~1 TB transfer; crons at any frequency. Add a seat only for someone who deploys. |
| Supabase | **Pro** | **25** | Free projects pause after a week idle and hold 1 GB of files — fine before launch, not for customers. Pro includes 8 GB database, 100 GB files, 250 GB egress. Keep the spend cap **on**. |
| Resend (email) | **Free** | 0 | 100/day, 3,000/month. Set `EMAIL_DAILY_LIMIT=95`; the digest spreads over the week and lead emails always get through (024). Move to Pro ($20) past ~400 active authors. |
| Gemini (AI) | Pay-as-you-go | ~0–2 | ~$0.0014 a page. Or leave the key unset at first: import falls back to the free heuristic. |
| Google Web Risk | Free tier | 0 | First 100,000 lookups a month. |
| Stripe | No fixed fee | 0 | 2.9% + 30¢ + 0.7% Billing per charge. Stripe Tax (+0.5%) only when switched on. |
| Domain | — | ~1–2 | |
| **Total** | | **≈ $46–49** | **Covered by 2 Pro customers at $29** (or 3 at $19). |

**Not worth paying for yet:** a Redis/KV service for rate limiting (the
in-memory limiter is fine at MVP traffic; everything billing-sensitive is
already counted in Postgres), Resend Pro, Sentry paid, extra Vercel seats.

**Settings that keep the bill flat (10 minutes, in dashboards):**

1. **Vercel → Settings → Billing → Spend Management:** set an on-demand budget
   (e.g. $30) with alerts, so a traffic spike cannot run up an open-ended bill.
2. **Vercel → Image Optimization:** make sure the project is on the
   transformation-based pricing, not per-source-image (§3).
3. **Supabase → Billing:** leave the spend cap on until revenue covers overage.
4. **Resend:** set `EMAIL_DAILY_LIMIT=95` while on the free plan.

**What would raise the bill, and when:** past ~400 authors who get the digest
(email), past ~250 GB of image egress or ~8 GB of database (Supabase overage —
event pruning keeps the database flat), or a viral edition (Vercel transfer
past 1 TB, ≈ 350–500k reads). Each of these arrives with revenue well above
its cost if the conversion figures in §4 hold.

## Sources

Competitor pricing:
[Flipsnack — Capterra](https://www.capterra.com/p/176854/Flipsnack/pricing/) ·
[Flipsnack — PricingSaaS](https://pricingsaas.com/companies/flipsnack) ·
[Flipsnack — Capterra UK](https://www.capterra.co.uk/software/176854/flipsnack) ·
[Flipsnack — GetApp](https://www.getapp.com/marketing-software/a/flipsnack/pricing) ·
[Issuu — Capterra](https://www.capterra.com/p/212526/Issuu/pricing/) ·
[Issuu — PricingSaaS](https://pricingsaas.com/companies/issuu) ·
[FlippingBook — Capterra](https://www.capterra.com/p/123930/FlippingBook-Publisher/pricing/) ·
[Publuu — Capterra](https://www.capterra.com/p/214310/Publuu/pricing/) ·
[Publuu — G2](https://g2.com/products/publuu/pricing) ·
[Heyzine — FitGap](https://us.fitgap.com/products/heyzine) ·
[Heyzine vs Publuu — Publitas](https://www.publitas.com/blog/publuu-vs-heyzine/) ·
[DocSend — pricing](https://www.docsend.com/pricing/) ·
[DocSend — Peony review](https://www.peony.ink/blog/docsend-pricing-review) ·
[Papermark — Capterra](https://www.capterra.com/p/10023636/Papermark/) ·
[Papermark — Ellty](https://www.ellty.com/blog/papermark-pricing)

Benchmarks:
[ChartMogul SaaS Conversion Report](https://chartmogul.com/reports/saas-conversion-report/) ·
[Userpilot — freemium to premium](https://userpilot.com/blog/freemium-to-premium) ·
[Vena — SaaS churn](https://www.venasolutions.com/blog/saas-churn-rate) ·
[Sender — churn statistics](https://www.sender.net/marketing-glossary/churn-rate/statistics/) ·
[UserJot — churn benchmarks](https://userjot.com/blog/saas-churn-rate-benchmarks)

Market size:
[The Insight Partners](https://www.theinsightpartners.com/reports/flipbook-software-market) ·
[DataHorizzon](https://datahorizzonresearch.com/flipbook-software-market-39786) ·
[Coherent Market Insights (US)](https://www.coherentmarketinsights.com/industry-reports/us-flipbook-software-market)

AppSumo:
[AppSumo — revenue share](https://appsumo.com/blog/breaking-down-appsumo-revenue-share) ·
[MySignature launch review](https://mysignature.io/blog/appsumo-launch/) ·
[MEAN CEO — launch statistics](https://blog.mean.ceo/?p=11216) ·
[Monetizely — marketplace pricing](https://www.getmonetizely.com/articles/should-you-launch-on-appsumo-a-vibe-coders-guide-to-deal-marketplace-pricing)

MVP plans:
[Vercel — Hobby plan (non-commercial)](https://vercel.com/docs/plans/hobby-plan) ·
[Vercel — fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines) ·
[Vercel Terms](https://vercel.com/terms) ·
[Resend — sending limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits) ·
[Resend — pricing](https://resend.com/docs/knowledge-base/what-is-resend-pricing)

Abuse:
[Google Safe Browsing API](https://developers.google.com/safe-browsing)

Costs:
[Vercel — image optimisation pricing change](https://vercel.com/changelog/faster-transformations-and-reduced-pricing-for-image-optimization) ·
[Vercel — image limits and pricing](https://vercel.com/docs/concepts/image-optimization/limits-and-pricing) ·
[Vercel cost 2026 — MakerKit](https://makerkit.dev/blog/saas/vercel-cost) ·
[Vercel pricing 2026 — Activepieces](https://www.activepieces.com/blog/vercel-pricing-in-2026-how-the-costs-scale.md) ·
[Supabase pricing — MakerKit](https://makerkit.dev/blog/saas/supabase-pricing) ·
[Supabase pricing — Schematic](https://schematichq.com/blog/supabase-pricing) ·
[Stripe fees — Flexprice](https://flexprice.io/blog/stripe-pricing-breakdown-2026) ·
[Gemini Flash pricing — CloudPrice](https://cloudprice.net/models/openrouter/google/gemini-2.5-flash)
