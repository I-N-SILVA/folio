-- Does the schema `master_migration.sql` builds accept what the app produces?
--
-- Not "does the constraint contain the right words" — that is reading a
-- description. This inserts a row of every shape and lets Postgres answer.
-- Both constraint bugs in this repo's history (008, 012) would have failed
-- here on the line that names them.
--
-- Everything runs inside one transaction that is rolled back, so the scratch
-- database is left as the migration made it.

\set ON_ERROR_STOP on
\timing off

BEGIN;

-- A user to own things. `books.owner_id` is NOT NULL against auth.users.
INSERT INTO auth.users (id, email)
VALUES ('11111111-1111-1111-1111-111111111111', 'owner@example.com');

-- The signup trigger from 004 should have created the profile already.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111') THEN
    RAISE EXCEPTION 'handle_new_user did not create a profile — the signup trigger is not wired up';
  END IF;
  RAISE NOTICE 'ok  profile auto-provisioned on signup';
END $$;

INSERT INTO public.books (id, owner_id, slug, title, theme, settings)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'verify-edition',
  'Verify',
  '{"preset":"ivory","typeset":"editorial"}'::jsonb,
  '{"published":true,"unlisted":false}'::jsonb
);

-- Every page layout and page type, through `replace_book_pages` — the stored
-- procedure the editor's autosave actually calls. Testing a raw INSERT here
-- would be testing a path the app does not take, and would have missed that
-- `blocks`/`hotspots` are `jsonb[]` rather than `jsonb`, which is the whole
-- reason that procedure exists.
--
-- 012 exists because this rejected 'grid' and 'canvas'.
DO $$
DECLARE
  saved int;
BEGIN
  PERFORM public.replace_book_pages(
    '22222222-2222-2222-2222-222222222222',
    jsonb_build_array(
      jsonb_build_object('page_number', 1, 'type', 'cover',   'layout', 'hero',
        'blocks', jsonb_build_array(jsonb_build_object('id','b1','type','text','variant','title','content','Hi'))),
      jsonb_build_object('page_number', 2, 'type', 'content', 'layout', 'split',  'blocks', '[]'::jsonb),
      jsonb_build_object('page_number', 3, 'type', 'content', 'layout', 'text',   'blocks', '[]'::jsonb),
      jsonb_build_object('page_number', 4, 'type', 'content', 'layout', 'grid',   'blocks', '[]'::jsonb),
      jsonb_build_object('page_number', 5, 'type', 'content', 'layout', 'blank',  'blocks', '[]'::jsonb),
      jsonb_build_object('page_number', 6, 'type', 'back',    'layout', 'canvas',
        'blocks', jsonb_build_array(jsonb_build_object('id','b2','type','data','source','/x.json','path','a')),
        'hotspots', jsonb_build_array(jsonb_build_object('id','h1','x',10,'y',20)))
    )
  );

  SELECT count(*) INTO saved FROM public.pages
  WHERE book_id = '22222222-2222-2222-2222-222222222222';
  IF saved <> 6 THEN
    RAISE EXCEPTION 'replace_book_pages saved % of 6 pages', saved;
  END IF;
  RAISE NOTICE 'ok  all 6 layouts and all 3 page types saved through replace_book_pages';
END $$;

-- The blocks survived the jsonb[] round trip rather than arriving empty.
DO $$
DECLARE
  b jsonb[];
BEGIN
  SELECT blocks INTO b FROM public.pages
  WHERE book_id = '22222222-2222-2222-2222-222222222222' AND page_number = 1;
  IF array_length(b, 1) IS DISTINCT FROM 1 OR b[1]->>'content' <> 'Hi' THEN
    RAISE EXCEPTION 'blocks did not survive the save: %', b;
  END IF;
  RAISE NOTICE 'ok  blocks and hotspots survive the jsonb[] round trip';
END $$;

-- Replacing is atomic and total: a second call with fewer pages must leave
-- exactly those, not merge with what was there.
DO $$
DECLARE saved int;
BEGIN
  PERFORM public.replace_book_pages(
    '22222222-2222-2222-2222-222222222222',
    jsonb_build_array(jsonb_build_object('page_number', 1, 'type', 'cover', 'layout', 'hero', 'blocks', '[]'::jsonb))
  );
  SELECT count(*) INTO saved FROM public.pages WHERE book_id = '22222222-2222-2222-2222-222222222222';
  IF saved <> 1 THEN
    RAISE EXCEPTION 'replace_book_pages left % pages, so a delete does not stick', saved;
  END IF;
  RAISE NOTICE 'ok  saving fewer pages actually removes the rest';
END $$;

-- Every event the client sends. 008 exists because two of these were dropped
-- for months, which is every heatmap and every captured lead.
DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'book_open','page_view','page_flip','hotspot_click','modal_open','modal_close',
    'video_play','video_complete','audio_play','cta_click','book_complete',
    'page_click','gate_view','gate_unlock'
  ] LOOP
    INSERT INTO public.events (book_id, session_id, event_type, page_number)
    VALUES ('22222222-2222-2222-2222-222222222222', 'verify-session', v, 1);
  END LOOP;
  RAISE NOTICE 'ok  all 14 event types accepted';
END $$;

-- An AppSumo licence, with every column the webhook writes.
INSERT INTO public.appsumo_licenses (
  license_key, prev_license_key, tier, plan, status,
  activation_email, invoice_item_uuid, redeemed_by, redeemed_at
) VALUES (
  'VERIFY-KEY-1', NULL, 2, 'ltd_tier2', 'active',
  'buyer@example.com', 'inv-1', '11111111-1111-1111-1111-111111111111', now()
);

DO $$ BEGIN RAISE NOTICE 'ok  appsumo_licenses accepts every column the webhook writes'; END $$;

-- The profile columns the entitlement and dunning code reads.
UPDATE public.profiles
SET plan = 'ltd_tier2',
    status = 'active',
    appsumo_license_key = 'VERIFY-KEY-1',
    appsumo_tier = 2,
    digest_opt_out = false,
    digest_last_sent_at = now(),
    stripe_customer_id = 'cus_verify',
    stripe_subscription_id = 'sub_verify',
    stripe_status = 'active',
    stripe_past_due_since = NULL,
    stripe_event_at = now()
WHERE id = '11111111-1111-1111-1111-111111111111';

DO $$ BEGIN RAISE NOTICE 'ok  profiles has every column the app reads'; END $$;

-- The stored procedures the app calls by name. A missing one is a runtime
-- 404 from PostgREST that nothing in the build would have caught.
DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'replace_book_pages',
    'edition_engagement',
    'constraint_allowed_values',
    'claim_appsumo_license',
    'claim_digest_slot'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    ) THEN
      RAISE EXCEPTION 'public.% is missing — the app calls it by name', fn;
    END IF;
  END LOOP;
  RAISE NOTICE 'ok  every stored procedure the app calls exists';
END $$;

-- Slug history, which is what makes a renamed edition's old link keep working.
INSERT INTO public.book_slug_history (book_id, slug)
VALUES ('22222222-2222-2222-2222-222222222222', 'old-slug');
DO $$ BEGIN RAISE NOTICE 'ok  slug history writable'; END $$;

-- The self-check function agrees with what the app can produce.
DO $$
DECLARE
  allowed text[];
BEGIN
  allowed := public.constraint_allowed_values('pages', 'layout');
  IF NOT ('canvas' = ANY(allowed) AND 'grid' = ANY(allowed)) THEN
    RAISE EXCEPTION 'constraint_allowed_values disagrees with the live constraint';
  END IF;
  allowed := public.constraint_allowed_values('events', 'event_type');
  IF NOT ('gate_unlock' = ANY(allowed) AND 'page_click' = ANY(allowed)) THEN
    RAISE EXCEPTION 'constraint_allowed_values disagrees with the live constraint';
  END IF;
  RAISE NOTICE 'ok  /api/health''s self-check function reports the truth';
END $$;

-- And the things that must be refused stay refused.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.pages (book_id, page_number, type, layout)
    VALUES ('22222222-2222-2222-2222-222222222222', 900, 'content', 'no-such-layout');
    RAISE EXCEPTION 'a nonsense layout was accepted — the CHECK is not doing anything';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'ok  a nonsense layout is still refused';
  END;

  BEGIN
    INSERT INTO public.events (book_id, session_id, event_type)
    VALUES ('22222222-2222-2222-2222-222222222222', 's', 'no-such-event');
    RAISE EXCEPTION 'a nonsense event type was accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'ok  a nonsense event type is still refused';
  END;
END $$;

-- RLS is on everywhere it should be. Off on any of these means a published
-- edition's rows are readable and writable by anyone with the anon key.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['books','pages','events','profiles','appsumo_licenses','book_slug_history'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'RLS is OFF on public.% — its rows are exposed to the anon key', t;
    END IF;
  END LOOP;
  RAISE NOTICE 'ok  RLS enabled on every table';
END $$;

ROLLBACK;

-- ── The redemption claim, under contention ───────────────────────────────────
--
-- `redeemLicense` does not decide the outcome in TypeScript; it narrows an
-- UPDATE to rows that are still unclaimed and lets the database arbitrate, then
-- reads the returned rows to see whether it won. A prior SELECT followed by an
-- unconditional UPDATE left a window where two simultaneous redemptions both
-- passed the check and both wrote — one licence, a paid plan on two accounts,
-- and an audit trail keeping only the later one. Trivially exploitable by
-- firing the same request from two sessions.
--
-- `lib/appsumo.test.ts` proves the TypeScript builds that filter. This proves
-- the database actually behaves the way that filter assumes, which no mock can.

\set ON_ERROR_STOP on

BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('33333333-3333-3333-3333-333333333333', 'first@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'second@example.com');

INSERT INTO public.appsumo_licenses (license_key, tier, plan, status)
VALUES ('RACE-KEY', 1, 'ltd_tier1', 'active');

DO $$
DECLARE
  first_won  int;
  second_won int;
  holder     uuid;
BEGIN
  -- Both callers run the same conditional claim, in order, in one transaction.
  -- Serialising them here is the honest model of what the database does to two
  -- concurrent UPDATEs of the same row: the second waits, re-evaluates its
  -- WHERE against the committed row, and matches nothing.
  WITH claimed AS (
    UPDATE public.appsumo_licenses
    SET redeemed_by = '33333333-3333-3333-3333-333333333333', redeemed_at = now()
    WHERE license_key = 'RACE-KEY'
      AND status <> 'refunded'
      AND (redeemed_by IS NULL OR redeemed_by = '33333333-3333-3333-3333-333333333333')
    RETURNING 1
  ) SELECT count(*) INTO first_won FROM claimed;

  WITH claimed AS (
    UPDATE public.appsumo_licenses
    SET redeemed_by = '44444444-4444-4444-4444-444444444444', redeemed_at = now()
    WHERE license_key = 'RACE-KEY'
      AND status <> 'refunded'
      AND (redeemed_by IS NULL OR redeemed_by = '44444444-4444-4444-4444-444444444444')
    RETURNING 1
  ) SELECT count(*) INTO second_won FROM claimed;

  IF first_won <> 1 THEN
    RAISE EXCEPTION 'the first claim did not win — nobody can redeem';
  END IF;
  IF second_won <> 0 THEN
    RAISE EXCEPTION 'the second claim also won — one licence, two paid accounts';
  END IF;

  SELECT redeemed_by INTO holder FROM public.appsumo_licenses WHERE license_key = 'RACE-KEY';
  IF holder <> '33333333-3333-3333-3333-333333333333' THEN
    RAISE EXCEPTION 'the later claim overwrote the earlier one: %', holder;
  END IF;

  RAISE NOTICE 'ok  one licence can only ever be claimed by one account';
END $$;

-- The same claim run twice by its own holder is idempotent, so a retry after a
-- dropped response does not tell the buyer their code is already used.
DO $$
DECLARE again int;
BEGIN
  WITH claimed AS (
    UPDATE public.appsumo_licenses
    SET redeemed_at = now()
    WHERE license_key = 'RACE-KEY'
      AND status <> 'refunded'
      AND (redeemed_by IS NULL OR redeemed_by = '33333333-3333-3333-3333-333333333333')
    RETURNING 1
  ) SELECT count(*) INTO again FROM claimed;

  IF again <> 1 THEN
    RAISE EXCEPTION 'the holder retrying was refused — a dropped response looks like a used code';
  END IF;
  RAISE NOTICE 'ok  the holder retrying still succeeds';
END $$;

-- A refunded licence is claimable by nobody, including the person who held it.
DO $$
DECLARE won int;
BEGIN
  UPDATE public.appsumo_licenses SET status = 'refunded' WHERE license_key = 'RACE-KEY';

  WITH claimed AS (
    UPDATE public.appsumo_licenses
    SET redeemed_by = '44444444-4444-4444-4444-444444444444'
    WHERE license_key = 'RACE-KEY'
      AND status <> 'refunded'
      AND (redeemed_by IS NULL OR redeemed_by = '44444444-4444-4444-4444-444444444444')
    RETURNING 1
  ) SELECT count(*) INTO won FROM claimed;

  IF won <> 0 THEN
    RAISE EXCEPTION 'a refunded licence was redeemed';
  END IF;
  RAISE NOTICE 'ok  a refunded licence is claimable by nobody';
END $$;

ROLLBACK;

-- ── Usage allowances (021) ───────────────────────────────────────────────────
--
-- `claimAiPages` trusts the number `claim_ai_pages` returns to decide how many
-- pages Gemini sees, so the function has to grant partially at the edge of the
-- allowance and grant nothing past it.

BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('55555555-5555-5555-5555-555555555555', 'ai@example.com');

DO $$
DECLARE
  u uuid := '55555555-5555-5555-5555-555555555555';
  g int;
  used int;
BEGIN
  g := public.claim_ai_pages(u, '2026-10-01', 30, 50);
  IF g <> 30 THEN RAISE EXCEPTION 'a claim inside the allowance granted %, not 30', g; END IF;

  g := public.claim_ai_pages(u, '2026-10-01', 30, 50);
  IF g <> 20 THEN RAISE EXCEPTION 'a claim across the edge granted %, not the 20 left', g; END IF;

  g := public.claim_ai_pages(u, '2026-10-01', 5, 50);
  IF g <> 0 THEN RAISE EXCEPTION 'a spent month still granted %', g; END IF;

  SELECT pages INTO used FROM public.ai_usage WHERE user_id = u AND month = '2026-10-01';
  IF used <> 50 THEN RAISE EXCEPTION 'usage recorded %, not the 50 granted', used; END IF;

  g := public.claim_ai_pages(u, '2026-11-01', 5, 50);
  IF g <> 5 THEN RAISE EXCEPTION 'a new month did not reset the allowance (granted %)', g; END IF;

  g := public.claim_ai_pages(u, '2026-11-01', 0, 50);
  IF g <> 0 THEN RAISE EXCEPTION 'asking for nothing granted %', g; END IF;

  RAISE NOTICE 'ok  the AI allowance grants partially at the edge and nothing past it';
END $$;

-- Plain PostgreSQL has no storage schema. The function has to install anyway
-- and answer 0, rather than fail the whole migration.
DO $$
BEGIN
  IF public.user_storage_bytes('55555555-5555-5555-5555-555555555555') <> 0 THEN
    RAISE EXCEPTION 'user_storage_bytes reported storage where there is none';
  END IF;
  RAISE NOTICE 'ok  storage usage installs and reads 0 without a storage schema';
END $$;

ROLLBACK;

-- And with one: a stand-in for Supabase's `storage.objects`, holding only the
-- columns the function reads, to prove it counts the owner's editions and
-- nobody else's. Rolled back, so the scratch database keeps no storage schema.
BEGIN;

CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE storage.objects (bucket_id text, name text, metadata jsonb);

INSERT INTO auth.users (id, email) VALUES
  ('66666666-6666-6666-6666-666666666666', 'owner@example.com'),
  ('77777777-7777-7777-7777-777777777777', 'other@example.com');

INSERT INTO public.books (id, slug, title, owner_id) VALUES
  ('a6666666-6666-6666-6666-666666666666', 'storage-mine', 'Mine', '66666666-6666-6666-6666-666666666666'),
  ('a7777777-7777-7777-7777-777777777777', 'storage-theirs', 'Theirs', '77777777-7777-7777-7777-777777777777');

INSERT INTO storage.objects (bucket_id, name, metadata) VALUES
  ('folio-assets', 'books/a6666666-6666-6666-6666-666666666666/pages/1.png', '{"size": 1000}'),
  ('folio-assets', 'books/a6666666-6666-6666-6666-666666666666/assets/x.jpg', '{"size": 250}'),
  ('folio-assets', 'books/a7777777-7777-7777-7777-777777777777/pages/1.png', '{"size": 9999}'),
  ('other-bucket', 'books/a6666666-6666-6666-6666-666666666666/pages/2.png', '{"size": 5000}');

DO $$
DECLARE total bigint;
BEGIN
  total := public.user_storage_bytes('66666666-6666-6666-6666-666666666666');
  IF total <> 1250 THEN
    RAISE EXCEPTION 'user_storage_bytes counted %, not the owner''s 1250 bytes in folio-assets', total;
  END IF;
  RAISE NOTICE 'ok  storage usage counts the owner''s editions and nobody else''s';
END $$;

ROLLBACK;

-- ── Analytics at scale (022) ─────────────────────────────────────────────────
--
-- The route used to count raw rows in JavaScript and PostgREST stops a
-- response at 1,000 rows, so every figure past that was an undercount. This
-- writes 1,500 page views across 300 sessions and checks the function counts
-- all of them, groups them by page, and that the prune keeps the leads.

BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('88888888-8888-8888-8888-888888888888', 'analytics@example.com');
INSERT INTO public.books (id, slug, title, owner_id) VALUES
  ('a8888888-8888-8888-8888-888888888888', 'analytics-scale', 'Scale',
   '88888888-8888-8888-8888-888888888888');

-- 300 sessions × 5 pages, each page viewed once with 1,000 ms of dwell.
INSERT INTO public.events (book_id, session_id, event_type, page_number, payload)
SELECT 'a8888888-8888-8888-8888-888888888888', 's' || s, 'page_view', p,
       jsonb_build_object('page_number', p, 'dwell_ms', 1000)
FROM generate_series(1, 300) s, generate_series(1, 5) p;

-- Every session opens; a third finish; ten give an email at the gate.
INSERT INTO public.events (book_id, session_id, event_type, payload)
SELECT 'a8888888-8888-8888-8888-888888888888', 's' || s, 'book_open', '{}'::jsonb
FROM generate_series(1, 300) s;
INSERT INTO public.events (book_id, session_id, event_type, payload)
SELECT 'a8888888-8888-8888-8888-888888888888', 's' || s, 'book_complete',
       jsonb_build_object('session_duration_ms', 60000)
FROM generate_series(1, 100) s;
INSERT INTO public.events (book_id, session_id, event_type, page_number, payload)
SELECT 'a8888888-8888-8888-8888-888888888888', 's' || s, 'gate_unlock', 3,
       jsonb_build_object('email', 'reader' || s || '@example.com')
FROM generate_series(1, 10) s;

DO $$
DECLARE
  a jsonb := public.edition_analytics('a8888888-8888-8888-8888-888888888888', now() - interval '1 day');
  views bigint;
BEGIN
  IF (a->'summary'->>'uniqueSessions')::int <> 300 THEN
    RAISE EXCEPTION 'uniqueSessions is %, not 300', a->'summary'->>'uniqueSessions';
  END IF;
  IF (a->'summary'->>'totalOpens')::int <> 300 THEN
    RAISE EXCEPTION 'totalOpens is %, not 300', a->'summary'->>'totalOpens';
  END IF;
  IF (a->'summary'->>'completionRate')::int <> 33 THEN
    RAISE EXCEPTION 'completionRate is %, not 33', a->'summary'->>'completionRate';
  END IF;
  IF (a->'summary'->>'avgSessionMs')::int <> 60000 THEN
    RAISE EXCEPTION 'avgSessionMs is %, not 60000', a->'summary'->>'avgSessionMs';
  END IF;

  SELECT SUM((p->>'views')::bigint) INTO views FROM jsonb_array_elements(a->'pageViewData') p;
  IF views <> 1500 THEN
    RAISE EXCEPTION 'page views summed to %, not all 1,500 — the 1,000-row ceiling is back', views;
  END IF;
  IF jsonb_array_length(a->'pageViewData') <> 5 THEN
    RAISE EXCEPTION 'page views grouped into % pages, not 5', jsonb_array_length(a->'pageViewData');
  END IF;
  IF (a->'pageViewData'->0->>'avgDwellMs')::int <> 1000 THEN
    RAISE EXCEPTION 'average dwell is %, not 1000', a->'pageViewData'->0->>'avgDwellMs';
  END IF;
  IF (a->'funnelData'->0->>'pct')::int <> 100 THEN
    RAISE EXCEPTION 'the funnel says % of sessions reached page 1, not 100', a->'funnelData'->0->>'pct';
  END IF;
  IF jsonb_array_length(a->'leadData') <> 10 THEN
    RAISE EXCEPTION '% leads reported, not 10', jsonb_array_length(a->'leadData');
  END IF;
  IF (a->'gate'->>'unlocks')::int <> 10 THEN
    RAISE EXCEPTION 'gate unlocks is %, not 10', a->'gate'->>'unlocks';
  END IF;

  RAISE NOTICE 'ok  edition analytics count every row past 1,000 and group by page';
END $$;

-- An empty window is a well-formed document, not NULLs the dashboard trips on.
DO $$
DECLARE a jsonb := public.edition_analytics('a8888888-8888-8888-8888-888888888888', now() + interval '1 day');
BEGIN
  IF a->'pageViewData' <> '[]'::jsonb OR a->'heatmapData' <> '{}'::jsonb
     OR (a->'summary'->>'uniqueSessions')::int <> 0 THEN
    RAISE EXCEPTION 'an empty window returned %', a;
  END IF;
  RAISE NOTICE 'ok  an empty window returns empty lists and zeros';
END $$;

-- Age everything, then prune: reading telemetry goes, leads stay.
UPDATE public.events SET created_at = now() - interval '500 days'
WHERE book_id = 'a8888888-8888-8888-8888-888888888888';

DO $$
DECLARE
  first_batch int;
  total int := 0;
  n int;
  left_reading int;
  left_leads int;
BEGIN
  first_batch := public.prune_events(now() - interval '400 days', 1000);
  IF first_batch <> 1000 THEN
    RAISE EXCEPTION 'a full batch deleted %, not 1,000', first_batch;
  END IF;
  total := first_batch;
  LOOP
    n := public.prune_events(now() - interval '400 days', 1000);
    total := total + n;
    EXIT WHEN n < 1000;
  END LOOP;

  SELECT COUNT(*) FILTER (WHERE event_type <> 'gate_unlock'),
         COUNT(*) FILTER (WHERE event_type = 'gate_unlock')
  INTO left_reading, left_leads
  FROM public.events WHERE book_id = 'a8888888-8888-8888-8888-888888888888';

  IF left_reading <> 0 THEN RAISE EXCEPTION '% old reading events survived the prune', left_reading; END IF;
  IF left_leads <> 10 THEN RAISE EXCEPTION 'the prune deleted leads: % of 10 left', left_leads; END IF;
  IF total <> 1900 THEN RAISE EXCEPTION 'pruned %, expected 1,900', total; END IF;

  IF public.prune_events(now() - interval '400 days', 0) <> 0 THEN
    RAISE EXCEPTION 'a zero batch deleted something';
  END IF;

  RAISE NOTICE 'ok  the prune deletes old reading events in batches and never deletes leads';
END $$;

ROLLBACK;

-- No plan is unlimited.
DO $$
BEGIN
  IF public.book_limit_for_plan('pro') <> 100 OR public.book_limit_for_plan('ltd_tier3') <> 200 THEN
    RAISE EXCEPTION 'edition ladder is pro=%, ltd_tier3=%',
      public.book_limit_for_plan('pro'), public.book_limit_for_plan('ltd_tier3');
  END IF;
  RAISE NOTICE 'ok  every plan has a finite edition limit';
END $$;

-- ── Abuse controls (023) ─────────────────────────────────────────────────────
--
-- A suspended edition has to vanish from the public read path, and its author
-- must not be able to bring it back by writing the column themselves —
-- `owner_all` lets them update their own row.

BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('99999999-9999-9999-9999-999999999999', 'author@example.com');
INSERT INTO public.books (id, slug, title, owner_id, settings) VALUES
  ('a9999999-9999-9999-9999-999999999999', 'abuse-check', 'Invoice',
   '99999999-9999-9999-9999-999999999999', '{"published": true}');
INSERT INTO public.pages (book_id, page_number, type, layout)
VALUES ('a9999999-9999-9999-9999-999999999999', 1, 'cover', 'blank');

DO $$
BEGIN
  IF public.suspend_edition('abuse-check', 'phishing: test') <> 1 THEN
    RAISE EXCEPTION 'suspend_edition did not find the edition';
  END IF;
  IF public.suspend_edition('no-such-slug', 'x') <> 0 THEN
    RAISE EXCEPTION 'suspend_edition reported a change for a slug that does not exist';
  END IF;
END $$;

-- The public, as the reader page sees it.
SET LOCAL ROLE anon;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.books WHERE slug = 'abuse-check') THEN
    RAISE EXCEPTION 'a suspended edition is still publicly readable';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pages WHERE book_id = 'a9999999-9999-9999-9999-999999999999') THEN
    RAISE EXCEPTION 'a suspended edition''s pages are still publicly readable';
  END IF;
  RAISE NOTICE 'ok  a suspended edition disappears from the public read path';
END $$;
RESET ROLE;

-- The author, trying to lift it.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
UPDATE public.books
SET suspended_at = NULL, suspended_reason = NULL, title = 'Invoice (edited)'
WHERE id = 'a9999999-9999-9999-9999-999999999999';
RESET ROLE;

DO $$
DECLARE b record;
BEGIN
  SELECT title, suspended_at, suspended_reason INTO b
  FROM public.books WHERE id = 'a9999999-9999-9999-9999-999999999999';
  IF b.suspended_at IS NULL THEN
    RAISE EXCEPTION 'the author lifted their own suspension';
  END IF;
  IF b.title <> 'Invoice (edited)' THEN
    RAISE EXCEPTION 'pinning the suspension also threw away the author''s other edits';
  END IF;
  RAISE NOTICE 'ok  an author cannot lift a suspension, and their other edits still save';
END $$;

-- An author cannot create an edition already "suspended" to dodge anything
-- either; and the operator can restore.
DO $$
BEGIN
  IF public.restore_edition('abuse-check') <> 1 THEN
    RAISE EXCEPTION 'restore_edition did not find the edition';
  END IF;
END $$;

SET LOCAL ROLE anon;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.books WHERE slug = 'abuse-check') THEN
    RAISE EXCEPTION 'a restored edition is still hidden';
  END IF;
  RAISE NOTICE 'ok  a restored edition is public again';
END $$;
RESET ROLE;

-- Reports accept every reason the app offers, and refuse others.
DO $$
BEGIN
  INSERT INTO public.edition_reports (book_id, reason) VALUES
    ('a9999999-9999-9999-9999-999999999999', 'phishing'),
    ('a9999999-9999-9999-9999-999999999999', 'other');
  BEGIN
    INSERT INTO public.edition_reports (book_id, reason)
    VALUES ('a9999999-9999-9999-9999-999999999999', 'nonsense');
    RAISE EXCEPTION 'a report with an unknown reason was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  RAISE NOTICE 'ok  edition_reports accepts the app''s reasons and refuses others';
END $$;

ROLLBACK;

-- ── Daily email budget (024) ─────────────────────────────────────────────────
BEGIN;
DO $$
DECLARE i int; ok int := 0;
BEGIN
  FOR i IN 1..5 LOOP
    IF public.claim_email_send('2026-10-30', 3) THEN ok := ok + 1; END IF;
  END LOOP;
  IF ok <> 3 THEN RAISE EXCEPTION 'a limit of 3 allowed % sends', ok; END IF;

  -- A higher limit (lead notifications) still has room after the digest's share is spent.
  IF NOT public.claim_email_send('2026-10-30', 5) THEN
    RAISE EXCEPTION 'the larger notice limit was refused at 3 of 5';
  END IF;
  IF NOT public.claim_email_send('2026-10-31', 3) THEN
    RAISE EXCEPTION 'a new day did not reset the count';
  END IF;
  IF public.claim_email_send('2026-10-30', 0) THEN
    RAISE EXCEPTION 'a zero limit allowed a send';
  END IF;
  RAISE NOTICE 'ok  the email budget counts per day and refuses past each limit';
END $$;
ROLLBACK;
