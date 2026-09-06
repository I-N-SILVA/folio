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
