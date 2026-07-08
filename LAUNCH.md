# QLICO — Premium Launch & App Store Plan

This is the playbook for taking QLICO from a polished web app to a premium,
installable product across the web, iOS, and Android — plus the marketing motion
to launch it loudly.

---

## 0. Where we are

QLICO already ships as a Next.js 16 web app with:

- A premium marketing landing page (`app/page.tsx`) — hero, trust marquee,
  features, use cases, workflow, testimonials, pricing, FAQ, and a final CTA band.
- **PWA installability** — `app/manifest.ts`, generated `app/icon.tsx` /
  `app/apple-icon.tsx`, `app/opengraph-image.tsx`, theme color + Apple web-app
  meta in `app/layout.tsx`, and `app/sitemap.ts`.

That makes the web app the single source of truth. Every app-store target below
wraps this same codebase — we build once and distribute everywhere.

---

## 1. Make the web app feel native (PWA hardening)

The cheapest "app" is the one users add to their home screen. Polish it first.

- [x] Web app manifest with name, icons, theme color, shortcuts.
- [x] Maskable + Apple touch icons.
- [x] `theme-color` + `apple-mobile-web-app` meta.
- [x] **Offline shell / service worker** — `public/sw.js` (registered in prod via
      `components/ServiceWorkerRegistrar.tsx`): network-first navigations with an
      `/offline` fallback, cache-first for hashed assets, stale-while-revalidate
      for the rest. API / auth / embed requests are bypassed.
- [x] **Install prompt UX** — `components/InstallPrompt.tsx` listens for
      `beforeinstallprompt` and surfaces an "Install app" button in the
      dashboard header.
- [ ] **iOS standalone polish** — `viewport-fit=cover` (done) + safe-area-inset
      padding on the reader chrome so it looks right on notched devices.
- [x] **Splash screens** for iOS standalone — generated on the fly at exact
      device resolutions by `app/apple-splash/route.tsx`, wired via
      `apple-touch-startup-image` links in `components/AppleSplashLinks.tsx`.
- [ ] Lighthouse PWA audit ≥ 90 on Performance, Accessibility, Best Practices, SEO.

**Exit criteria:** "Add to Home Screen" on iOS/Android produces a full-screen,
branded, offline-tolerant app.

---

## 2. Ship to the app stores

Two viable paths. Recommendation: **start with PWABuilder (TWA for Android) +
Capacitor for iOS**, because it reuses the exact same web build.

### Android — Trusted Web Activity (fastest)
- Use [PWABuilder](https://www.pwabuilder.com/) to package the deployed URL as a
  signed Android App Bundle (`.aab`) via Bubblewrap/TWA.
- Add `.well-known/assetlinks.json` to verify the domain ↔ app link (removes the
  browser URL bar). Serve it from `public/.well-known/assetlinks.json`.
- Submit to Google Play. Review is typically 1–3 days.

### iOS — Capacitor (App Store requires more than a webview wrapper)
- `npm i @capacitor/core @capacitor/ios && npx cap init`.
- Point the Capacitor `server.url` at the production deploy (or bundle the static
  shell). Add native niceties so it isn't "just a website": share sheet, haptics
  on page turn, status-bar theming, push notifications.
- Apple rejects thin wrappers (Guideline 4.2). Justify native value: offline
  reading, home-screen library, push re-engagement, native share.
- Submit via App Store Connect. Budget 1–2 review rounds.

### Alternative: one codebase, two stores
- **Capacitor for both** iOS and Android if we want unified native plugins.
- **Expo / React Native** only if we later want a fully native reader — higher
  cost, deferred.

**Store assets checklist (both):**
- [ ] App icon set (1024² master — white QLICO mark on violet, upscaled from
      `public/brand/icon-512.png`'s source).
- [ ] Screenshots per device class (use the reader + studio on real content).
- [ ] Preview video (15–30s: PDF in → interactive edition out → analytics).
- [ ] Title, subtitle, keywords, description, privacy policy URL, support URL.
- [ ] Data-safety / privacy nutrition labels (we collect reader analytics — disclose).

---

## 3. Pre-launch polish (web)

- [ ] **Performance:** lazy-load the reader, preconnect to Supabase, ship
      `next/font` for the display/body faces instead of system-font fallbacks so
      the brand is consistent on every device.
- [x] **Analytics + funnels:** Vercel Analytics wired in the root layout;
      custom events on hero/pricing/demo CTAs, magic-link signup, and first
      publish (`cta_click`, `demo_open`, `signup_magic_link_sent`,
      `edition_published`). Add PostHog later if we need session replays.
- [x] **SEO:** `sitemap.ts` (incl. all demo editions) + per-book OG images +
      JSON-LD `SoftwareApplication` schema on the landing page.
- [ ] **Social proof:** replace placeholder testimonials/logos with real design
      partners before launch day.
- [ ] **Legal:** real Privacy Policy + Terms (required for both app stores).
- [ ] **Email capture:** a "notify me when the app drops" list for the launch.

---

## 4. Launch week motion

| Day | Move |
| --- | --- |
| T-14 | Recruit 5–10 design partners; collect real quotes + sample editions. |
| T-7  | Warm up: teaser posts, build-in-public thread, waitlist emails. |
| T-1  | Final QA pass on web + TestFlight/internal-test builds. |
| **T-0** | **Product Hunt launch** (Tue–Thu, 12:01am PT). Hero GIF of a PDF becoming an interactive edition. |
| T-0  | Cross-post: X/LinkedIn thread, relevant subreddits, Indie Hackers, designer Slacks/Discords. |
| T-0  | Email the waitlist with the "now installable" hook. |
| T+1..7 | Reply to every comment; ship 1–2 small fixes publicly; collect testimonials. |

**Positioning line:** *"Turn any PDF into an interactive flipbook your readers
actually finish — on the web, embedded, and installed as an app."*

**Launch metrics to watch:** signups, first-publish rate, demo views, install
rate (PWA + stores), and reader completion on shared editions.

---

## 5. Backlog / nice-to-haves

- Web Share Target API so users can "share to QLICO" a PDF from other apps.
- Push notifications for "your edition hit 1,000 reads".
- Template gallery (catalog / lookbook / report starters) to shorten time-to-wow.
- Custom-domain onboarding wizard for Pro.
- AI cover + hotspot suggestions on import.

---

### Quick reference — what's already wired in this repo

| Concern | File |
| --- | --- |
| PWA manifest | `app/manifest.ts` → `/manifest.webmanifest` |
| App icons | `app/icon.png`, `app/apple-icon.png`, `public/brand/*` |
| Social share image | `app/opengraph-image.tsx` |
| SEO sitemap | `app/sitemap.ts` |
| Theme color / Apple meta / OG / Twitter | `app/layout.tsx` |
| Landing page | `app/page.tsx` + `components/landing/*` |
