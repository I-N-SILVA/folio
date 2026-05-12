---
title: Folio — Production Readiness + Improvements
type: feat
date: 2026-05-12
---

# Folio — Production Readiness + Improvements

## Overview

All 6 MVP phases are complete and the build is clean. This plan covers everything needed to go from "builds clean" to "production-ready + commercially viable."

## Implementation Phases

### Phase 1 — Infrastructure (unblocks everything else)
- Fix `npm run dev` (package.json scripts)
- Add React Query `QueryClientProvider` to root layout
- Add `sonner` toast provider
- Replace layout-level auth redirect with Next.js `middleware.ts`
- Add `loading.tsx` Suspense boundaries for dashboard, editor, analytics

### Phase 2 — Performance (parallel with Phase 3)
- ISR on public book pages (`revalidate: 60`)
- Lazy-load all block components via `React.lazy` + `Suspense`
- Preload adjacent page images in `ViewerEngine`
- `next/image` blur placeholder on all images

### Phase 3 — PDF Import (the killer feature, parallel with Phase 2)
- Install `pdfjs-dist`
- API route `/api/import/pdf` — receives PDF, renders pages to PNG via canvas, uploads to Supabase Storage, creates book + page records
- Studio UI: "Import PDF" button on dashboard → file picker → progress modal → redirect to editor

### Phase 4 — Landing Page
- Marketing page at `/` (ungate from demo redirect)
- Hero with live embedded demo
- Features section (analytics, hotspots, embed, PDF import)
- Pricing section (free / pro / self-hosted)
- CTA to sign up

### Phase 5 — UX Polish
- `sonner` toasts: autosave feedback, publish success/error, copy link confirmation
- Share button on dashboard BookCards (opens ShareModal)
- Keyboard shortcut hint overlay in viewer (press `?`)
- "Coming soon" PDF import note in Studio if not yet live

## Acceptance Criteria

- [ ] `npm run dev` works
- [ ] Auth protected routes redirect via middleware, not layout
- [ ] Loading skeletons show on dashboard/editor/analytics
- [ ] PDF upload → book creation works end-to-end
- [ ] Landing page live at `/`
- [ ] Toasts fire on save, publish, copy
- [ ] Book pages use ISR (stale-while-revalidate)
- [ ] Block components are code-split
- [ ] All Lighthouse scores ≥ 85

## Risk Notes

- `pdfjs-dist` requires a worker file — must be copied to `/public` or use CDN worker URL
- PDF rendering is CPU-heavy; do it server-side in the API route, not client-side
- ISR requires Supabase queries to complete within revalidation window
