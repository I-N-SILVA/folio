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
- **Margins are healthy, apart from one cost: page-image bandwidth.** Pages are
  stored as 2× PNG. At the estimated size, a busy free account costs more to
  serve than a paying one earns, and a heavy lifetime Tier 3 buyer uses up
  their whole payment in about 3 months. **Switching page renders to WebP is
  the highest-value technical change for the business** — about 6× less
  bandwidth (estimated).
- **Use AppSumo for cash and reviews, capped, after the WebP change.** Net per
  code is about $16–65. That is fine for the typical buyer and loses money on
  heavy ones.

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

**Bandwidth is not cheap.** Every reader downloads page images. Assuming a
reader sees about 12 pages:

| Page format | ~MB per read | 2,000 reads/mo | 10,000 reads/mo | Pro margin at $19 / $29 (2,000 reads) |
|---|---|---|---|---|
| **PNG at 2× (today)** | ~24 (est.) | $4.32 | $21.60 | **68% / 78%** |
| WebP at 2× | ~4 (est.) | $0.72 | $3.60 | 87% / 90% |

Free accounts carry the same cost and pay nothing. **6,000 active free accounts
at 200 reads a month ≈ $2,600/mo on PNG, or ≈ $430/mo on WebP.** The badge loop
is meant to be the main acquisition channel, so this bandwidth is effectively
the cost of acquiring customers. It is affordable only on WebP.

> **Measure before acting on this.** Import two real catalogs (one photographic,
> one mostly text), read the object sizes in Supabase Storage, and divide.
> If PNG pages are already under ~600 KB, the problem is 4× smaller than
> stated here. Either way, `lib/pdf-renderer.ts` calling
> `canvas.toBlob(…, 'image/webp', 0.85)` is a one-line change, though it needs
> a fallback check for Safari < 14.

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

| Tier | Price | Net per code | Typical user (~$0.81/mo, WebP-era) | Heavy user (10k reads/mo, PNG) |
|---|---|---|---|---|
| 1 | $59 | ~$16 | ~20 months covered | — |
| 2 | $119 | ~$32 | ~40 months | — |
| 3 | $239 | ~$65 | ~80 months | **~3 months** (~12 on WebP) |

- **Worth doing for cash, reviews and backlinks, not as the revenue model.** Every
  lifetime buyer is a customer who will never pay again, and LTD buyers expect
  support and a roadmap.
- **Cap the codes** (for example 500–1,000 total) and close the deal on a date.
  An uncapped LTD sells away the recurring revenue the business needs.
- **Do it after the WebP change**, so the heavy Tier 3 user, who is exactly the
  agency profile Tier 3 targets, costs ~$5/mo rather than ~$24.
- **Put storage and AI caps on the listing.** An "unlimited" buyer who hits a
  cap they were not told about asks for a refund.

## 6. Recommended plan structure

| | **Free** | **Pro** | **Studio** *(when built)* |
|---|---|---|---|
| Price | $0 | **$29/mo or $290/yr** | **$79/mo or $790/yr** |
| Editions | 3 | Unlimited | Unlimited |
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
2. **Free accounts' bandwidth outruns revenue.** Real on PNG; manageable on WebP.
   It needs measuring before any launch that brings a spike of readers
   (AppSumo, Product Hunt).
3. **Being placed in the wrong category.** If buyers compare QLICO with Heyzine
   ($5) rather than DocSend ($45), even $19 looks expensive. The landing page and
   comparison pages decide which list QLICO ends up on.
4. **LTD overhang.** A large lifetime base adds support load with no revenue.
   Caps on codes and on usage are the mitigation.
5. **Price is still a guess.** Nothing here is a customer saying "I would pay".

## 8. How to validate, cheaply, before committing

1. **Measure page-image size** on two real imports (½ day). That one number
   makes §3 either true or 4× too pessimistic.
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

Costs:
[Supabase pricing — MakerKit](https://makerkit.dev/blog/saas/supabase-pricing) ·
[Supabase pricing — Schematic](https://schematichq.com/blog/supabase-pricing) ·
[Stripe fees — Flexprice](https://flexprice.io/blog/stripe-pricing-breakdown-2026) ·
[Gemini Flash pricing — CloudPrice](https://cloudprice.net/models/openrouter/google/gemini-2.5-flash)
