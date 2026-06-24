# Folio

Turn a PDF or a blank page into an interactive, trackable flipbook you can publish and share. Folio pairs a drag-and-drop editor with a polished public reader, lead-gating, living "data" blocks, AI-assisted import, and per-book analytics.

## Stack

- **Next.js 16** (App Router) + **React 19** — see `AGENTS.md`: this Next.js has breaking changes, read `node_modules/next/dist/docs/` before writing framework code.
- **Supabase** — Postgres, auth, storage, and row-level security (`supabase/migrations/`).
- **Stripe** (Pro subscription) + **AppSumo** (lifetime deal) billing.
- **Google Gemini** — hotspot detection and SEO metadata on PDF import.
- **Tailwind CSS v4**, **Zustand** (editor store), **Zod** (end-to-end schemas), **TanStack Query**.

## Getting started

```bash
npm ci
cp .env.example .env.local   # fill in Supabase / Stripe / AppSumo / Gemini keys
npm run dev                  # http://localhost:3000
```

Apply the database schema by running the SQL in `supabase/migrations/` (in order) against your Supabase project.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript) |
| `npm run format` | Prettier write (`format:check` to verify only) |
| `npm test` | Vitest unit tests (`test:watch` for watch mode) |

## Project layout

```
app/                     App Router routes, grouped by surface
  (reader)/              Public book viewer (SSG/ISR)
  (studio)/              Authenticated dashboard + editor + account
  (analytics)/           Per-book analytics dashboard
  api/                   Route handlers (books, upload, billing, webhooks, events…)
components/              UI by domain: viewer/, studio/, blocks/, landing/
lib/                     Schemas, editor store, integrations, entitlements
supabase/migrations/     Database schema + row-level security policies
```

## Architecture notes

- **Authorization** is enforced by Supabase RLS. API routes use the user-scoped
  client (`createServerSupabase`) so RLS applies; the service-role client
  (`supabaseAdmin`) is reserved for operations RLS can't express — webhooks,
  license redemption, profile/plan mutations, and storage writes.
- **Plans & entitlements** live in `lib/plans.ts` (single source of truth) and
  are enforced via `lib/entitlements.ts`.
- **Uploads** are size- and type-limited in `lib/uploads.ts`; abuse-prone
  endpoints are throttled via `lib/rate-limit.ts`.

## CI

`.github/workflows/ci.yml` runs typecheck, lint, tests, and a production build
on every pull request.
