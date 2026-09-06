-- ============================================================================
-- QLICO — CONSOLIDATED SUPABASE MIGRATION
--
-- GENERATED FILE. Do not edit by hand.
--   node scripts/build-master-migration.mjs
--
-- Every numbered migration in supabase/migrations, in order. Run it in the
-- Supabase SQL editor to bring a new or an existing project fully up to date:
-- each statement is idempotent, so running it twice is a no-op rather than an
-- error, and running it on a database that is several migrations behind
-- applies only what is missing.
--
-- This file used to be maintained by hand and fell three migrations behind,
-- which meant setting production up from it produced a database that silently
-- dropped analytics events and refused to save two of the six page layouts.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 001_create_books.sql
-- --------------------------------------------------------------------------

-- Books table
CREATE TABLE IF NOT EXISTS public.books (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,
  title       text NOT NULL,
  description text,
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme       jsonb NOT NULL DEFAULT '{"preset":"ivory"}'::jsonb,
  settings    jsonb NOT NULL DEFAULT '{"published":false,"unlisted":false}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS books_updated_at ON public.books;
CREATE TRIGGER books_updated_at
  BEFORE UPDATE ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

-- Owner can do everything
DROP POLICY IF EXISTS "owner_all" ON public.books;
CREATE POLICY "owner_all" ON public.books
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Public can read published books
DROP POLICY IF EXISTS "public_read_published" ON public.books;
CREATE POLICY "public_read_published" ON public.books
  FOR SELECT
  USING ((settings->>'published')::boolean = true);

-- --------------------------------------------------------------------------
-- 002_create_pages.sql
-- --------------------------------------------------------------------------

-- Pages table
CREATE TABLE IF NOT EXISTS public.pages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id     uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  page_number int NOT NULL,
  type        text NOT NULL CHECK (type IN ('cover', 'content', 'back')),
  layout      text NOT NULL CHECK (layout IN ('hero', 'split', 'text', 'blank')),
  background  jsonb,
  blocks      jsonb[] NOT NULL DEFAULT '{}',
  hotspots    jsonb[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (book_id, page_number)
);

DROP TRIGGER IF EXISTS pages_updated_at ON public.pages;
CREATE TRIGGER pages_updated_at
  BEFORE UPDATE ON public.pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Index for ordered page fetching
CREATE INDEX IF NOT EXISTS pages_book_order ON public.pages (book_id, page_number);

-- RLS
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

-- Owner inherits access via books
DROP POLICY IF EXISTS "owner_all" ON public.pages;
CREATE POLICY "owner_all" ON public.pages
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.books WHERE books.id = pages.book_id AND books.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.books WHERE books.id = pages.book_id AND books.owner_id = auth.uid()
  ));

-- Public can read pages of published books
DROP POLICY IF EXISTS "public_read_published" ON public.pages;
CREATE POLICY "public_read_published" ON public.pages
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id = pages.book_id AND (books.settings->>'published')::boolean = true
  ));

-- --------------------------------------------------------------------------
-- 003_create_events.sql
-- --------------------------------------------------------------------------

-- Events table (append-only analytics)
CREATE TABLE IF NOT EXISTS public.events (
  id          bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  book_id     uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  session_id  text NOT NULL,
  event_type  text NOT NULL CHECK (event_type IN (
    'book_open','page_view','page_flip','hotspot_click',
    'modal_open','modal_close','video_play','video_complete',
    'audio_play','cta_click','book_complete'
  )),
  page_number int,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- GIN index for fast per-book dashboard queries
CREATE INDEX IF NOT EXISTS events_book_type ON public.events (book_id, event_type);
-- B-tree for book_id filtering (most common query pattern)
CREATE INDEX IF NOT EXISTS events_book_id ON public.events (book_id, created_at DESC);
-- Partial index for page-level queries
CREATE INDEX IF NOT EXISTS events_page_number ON public.events (book_id, page_number)
  WHERE page_number IS NOT NULL;

-- RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can insert events
DROP POLICY IF EXISTS "anon_insert" ON public.events;
CREATE POLICY "anon_insert" ON public.events
  FOR INSERT
  WITH CHECK (true);

-- Only book owner can read their events
DROP POLICY IF EXISTS "owner_read" ON public.events;
CREATE POLICY "owner_read" ON public.events
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.books WHERE books.id = events.book_id AND books.owner_id = auth.uid()
  ));

-- --------------------------------------------------------------------------
-- 004_create_profiles.sql
-- --------------------------------------------------------------------------

-- Profiles: one row per auth user, carrying their plan + billing status.
CREATE TABLE IF NOT EXISTS public.profiles (
  id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               text,
  plan                text NOT NULL DEFAULT 'free',
  status              text NOT NULL DEFAULT 'active', -- active | refunded | deactivated
  appsumo_license_key text UNIQUE,
  appsumo_tier        int,
  appsumo_invoice_uuid text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Reuse the shared updated_at trigger function from 001_create_books.sql
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-create a profile whenever a new auth user is created.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for any existing users.
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- RLS: a user can read (but not freely escalate) their own profile.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read_own" ON public.profiles;
CREATE POLICY "profiles_read_own" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Note: plan/status are mutated only by the service role (webhook + redeem
-- routes), which bypasses RLS. We intentionally do NOT grant an UPDATE policy
-- to end users so they cannot upgrade their own plan client-side.

-- --------------------------------------------------------------------------
-- 005_create_appsumo_licenses.sql
-- --------------------------------------------------------------------------

-- AppSumo lifetime-deal licenses. A license is created by the AppSumo webhook
-- at purchase time and later linked to a Qlico user when they redeem it.
CREATE TABLE IF NOT EXISTS public.appsumo_licenses (
  license_key       text PRIMARY KEY,
  prev_license_key  text,
  tier              int  NOT NULL DEFAULT 1,
  plan              text NOT NULL DEFAULT 'ltd_tier1',
  status            text NOT NULL DEFAULT 'active', -- active | deactivated | refunded
  activation_email  text,
  invoice_item_uuid text,
  redeemed_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appsumo_licenses_email
  ON public.appsumo_licenses (lower(activation_email));

DROP TRIGGER IF EXISTS appsumo_licenses_updated_at ON public.appsumo_licenses;
CREATE TRIGGER appsumo_licenses_updated_at
  BEFORE UPDATE ON public.appsumo_licenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS on, no policies: only the service role (webhook + redeem routes) may
-- touch this table. End users never read or write it directly.
ALTER TABLE public.appsumo_licenses ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- 006_enforce_book_limit.sql
-- --------------------------------------------------------------------------

-- Defense-in-depth: enforce the per-plan book limit at the database level so it
-- holds no matter which path creates a book (the REST API *or* a direct
-- client-side insert via RLS). The API still returns a friendly message first;
-- this trigger is the backstop.
--
-- Keep the limits in sync with lib/plans.ts.
CREATE OR REPLACE FUNCTION public.book_limit_for_plan(p text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p
    WHEN 'pro'       THEN 2147483647
    WHEN 'ltd_tier3' THEN 2147483647
    WHEN 'ltd_tier2' THEN 50
    WHEN 'ltd_tier1' THEN 10
    ELSE 1 -- free
  END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_book_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_plan   text;
  v_status text;
  v_limit  int;
  v_count  int;
BEGIN
  SELECT plan, status INTO v_plan, v_status
  FROM public.profiles WHERE id = NEW.owner_id;

  IF v_plan IS NULL THEN v_plan := 'free'; END IF;
  -- Refunded / deactivated accounts fall back to the free limit.
  IF v_status IS DISTINCT FROM 'active' THEN v_plan := 'free'; END IF;

  v_limit := public.book_limit_for_plan(v_plan);

  SELECT count(*) INTO v_count FROM public.books WHERE owner_id = NEW.owner_id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'BOOK_LIMIT_REACHED: plan % allows % book(s)', v_plan, v_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS books_enforce_limit ON public.books;
CREATE TRIGGER books_enforce_limit
  BEFORE INSERT ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.enforce_book_limit();

-- --------------------------------------------------------------------------
-- 007_add_stripe_columns.sql
-- --------------------------------------------------------------------------

-- Stripe subscription billing for the Pro plan. AppSumo (lifetime) and Stripe
-- (subscription) coexist: a profile's `plan` is driven by whichever is active.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id     text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_status          text;

CREATE INDEX IF NOT EXISTS profiles_stripe_customer
  ON public.profiles (stripe_customer_id);

-- --------------------------------------------------------------------------
-- 008_fix_events_check_constraint.sql
-- --------------------------------------------------------------------------

-- The original CHECK constraint omitted 'page_click' (heatmaps) and
-- 'gate_unlock' (lead capture), both of which the API and client have
-- always sent. Every insert of those types has been silently rejected.
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_event_type_check;

ALTER TABLE public.events ADD CONSTRAINT events_event_type_check CHECK (event_type IN (
  'book_open','page_view','page_flip','hotspot_click',
  'modal_open','modal_close','video_play','video_complete',
  'audio_play','cta_click','book_complete','page_click','gate_unlock'
));

-- --------------------------------------------------------------------------
-- 009_post_audit_features.sql
-- --------------------------------------------------------------------------

-- Migration: 009_add_gate_view_event.sql
-- 'gate_view' records a reader reaching the lead gate. Without it the dashboard
-- could only show unlocks, which is a count with no denominator — an author had
-- no way to tell whether their gate copy converts or whether people simply never
-- get that far.
--
-- Keep in sync with EventType in lib/book-schema.ts and the enum in
-- app/api/events/route.ts.
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_event_type_check;

ALTER TABLE public.events ADD CONSTRAINT events_event_type_check CHECK (event_type IN (
  'book_open','page_view','page_flip','hotspot_click',
  'modal_open','modal_close','video_play','video_complete',
  'audio_play','cta_click','book_complete','page_click',
  'gate_view','gate_unlock'
));


-- Migration: 010_replace_book_pages.sql
-- Atomic page replacement for autosave.
--
-- PUT /api/books/[id]/pages used to run two separate statements:
--
--   DELETE FROM pages WHERE book_id = $1;
--   INSERT INTO pages (...) VALUES (...);
--
-- with nothing joining them. Every autosave — which the editor fires roughly
-- every two seconds — therefore opened a window in which the book had zero
-- pages. Anything that stopped the insert from landing (a constraint violation
-- on one page, a dropped connection, the serverless function being reclaimed
-- between the two round-trips) left the author's book permanently empty. The
-- route returned 500, but a 500 restores nothing.
--
-- Delete-then-insert is itself necessary rather than lazy: UNIQUE
-- (book_id, page_number) is checked per row, so upserting a reorder — page 3
-- becoming page 5 while page 5 becomes page 3 — collides mid-statement. The fix
-- is not to avoid the delete but to make it share a transaction with the
-- insert. A plpgsql function body is exactly that: either both statements
-- commit or neither does.
--
-- SECURITY INVOKER (the default) is deliberate. The route already verifies
-- ownership before calling, and it calls with the service role, which bypasses
-- RLS. Were this SECURITY DEFINER, any client that reached it directly could
-- replace the pages of an arbitrary book_id. As an invoker function, a
-- non-owner is stopped by the same RLS policies that guard the table — and
-- EXECUTE is revoked from the client roles below regardless.

CREATE OR REPLACE FUNCTION public.replace_book_pages(p_book_id uuid, p_pages jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.pages WHERE book_id = p_book_id;

  IF p_pages IS NULL OR jsonb_typeof(p_pages) <> 'array' OR jsonb_array_length(p_pages) = 0 THEN
    RETURN;
  END IF;

  -- blocks/hotspots are jsonb[] columns, not jsonb, so each JSON array has to
  -- be unnested and re-aggregated into a Postgres array rather than cast.
  INSERT INTO public.pages (id, book_id, page_number, type, layout, background, blocks, hotspots)
  SELECT
    COALESCE(NULLIF(p->>'id', '')::uuid, gen_random_uuid()),
    p_book_id,
    (p->>'page_number')::int,
    p->>'type',
    p->>'layout',
    COALESCE(p->'background', '{}'::jsonb),
    COALESCE(
      (SELECT array_agg(b) FROM jsonb_array_elements(COALESCE(p->'blocks', '[]'::jsonb)) AS b),
      '{}'::jsonb[]
    ),
    COALESCE(
      (SELECT array_agg(h) FROM jsonb_array_elements(COALESCE(p->'hotspots', '[]'::jsonb)) AS h),
      '{}'::jsonb[]
    )
  FROM jsonb_array_elements(p_pages) AS t(p);
END;
$$;

REVOKE ALL ON FUNCTION public.replace_book_pages(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_book_pages(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.replace_book_pages(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_book_pages(uuid, jsonb) TO service_role;


-- Migration: 011_dunning_grace.sql
-- Dunning limit for failed subscription payments.
--
-- `past_due` was treated as an active status, with nothing recording when the
-- account entered it. A subscription whose payments keep failing therefore kept
-- Pro entitlements indefinitely: Stripe stops retrying and eventually cancels,
-- but if that final event is missed, delayed, or delivered out of order, the
-- account simply stays on Pro forever. Keeping a grace window is right — a
-- card that expires on a Friday shouldn't take the product away — but the
-- window has to end, which means knowing when it opened.
--
-- `stripe_past_due_since` is set the first time a subscription reports
-- `past_due` and cleared as soon as it recovers, so the grace period is
-- measured from the start of the dunning run rather than restarting on every
-- retry event.
--
-- `stripe_event_at` guards against Stripe's at-least-once, unordered delivery:
-- an `updated` event that arrives after a `deleted` event would otherwise
-- resurrect a cancelled subscription. The webhook ignores any event older than
-- the newest one it has already applied.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_past_due_since timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_event_at       timestamptz;

COMMENT ON COLUMN public.profiles.stripe_past_due_since IS
  'When the current dunning run began. NULL when the subscription is healthy.';
COMMENT ON COLUMN public.profiles.stripe_event_at IS
  'created timestamp of the newest Stripe subscription event applied to this row.';


-- Migration: 012_edition_engagement.sql
-- Per-edition engagement, aggregated in Postgres.
--
-- `lib/insights.ts` pulled the raw event rows for every published edition and
-- counted them in JavaScript, capped at 20,000 rows so a popular account
-- couldn't turn the dashboard into a memory problem. That cap is the problem:
-- the figures it produces are a floor, not a total, and the one question the
-- page exists to answer — is anyone reading this? — deserves an exact answer.
--
-- Counting where the rows already live is both exact and cheaper: three
-- COUNT(DISTINCT) per book instead of tens of thousands of rows crossing the
-- wire. The route prefers this function and keeps the JS path as a fallback for
-- installs that haven't applied this migration, the same way
-- PUT /api/books/[id]/pages falls back when 010 is missing.
--
-- Readers are distinct `session_id`s rather than `book_open` counts. One person
-- who opens an edition three times is one reader; counting opens is how an
-- author refreshing their own tab becomes an audience.
--
-- SECURITY INVOKER (the default) is deliberate, matching replace_book_pages():
-- callers pass book ids they have already established ownership of, and they
-- call with the service role. As an invoker function a direct caller is still
-- bound by the RLS policies on `events`, and EXECUTE is revoked from the client
-- roles below regardless.

CREATE OR REPLACE FUNCTION public.edition_engagement(
  p_book_ids uuid[],
  p_since    timestamptz
)
RETURNS TABLE (
  book_id      uuid,
  readers      bigint,
  completions  bigint,
  leads        bigint,
  last_read_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    b.id AS book_id,
    COUNT(DISTINCT e.session_id) FILTER (WHERE e.event_type = 'book_open')     AS readers,
    COUNT(DISTINCT e.session_id) FILTER (WHERE e.event_type = 'book_complete') AS completions,
    COUNT(*)                     FILTER (WHERE e.event_type = 'gate_unlock')   AS leads,
    MAX(e.created_at)                                                          AS last_read_at
  FROM unnest(p_book_ids) AS b(id)
  LEFT JOIN public.events e
    ON e.book_id = b.id
   AND e.created_at >= p_since
   AND e.event_type IN ('book_open', 'book_complete', 'gate_unlock')
  GROUP BY b.id;
$$;

REVOKE ALL ON FUNCTION public.edition_engagement(uuid[], timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.edition_engagement(uuid[], timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.edition_engagement(uuid[], timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.edition_engagement(uuid[], timestamptz) TO service_role;

-- The aggregate filters on event_type within a book and time window. The
-- existing (book_id, created_at DESC) index covers the range; this one lets the
-- type filter be satisfied without visiting rows for page_view and page_click,
-- which outnumber the three types above by a wide margin.
CREATE INDEX IF NOT EXISTS events_book_type_created
  ON public.events (book_id, event_type, created_at DESC);


-- Migration: 013_weekly_digest.sql
-- Weekly digest state.
--
-- The product had no reason for an author to come back. Reader numbers change
-- while they are away — that is the whole point of the analytics — and nothing
-- ever told them. A digest is the cheapest possible answer: one email a week
-- that says whether anything happened, with a link to the screen that says more.
--
-- `digest_opt_out` rather than `digest_opt_in`: this is transactional-adjacent
-- reporting about the author's own content, and defaulting it off would mean
-- building the feature and then having nobody receive it. Every send carries an
-- unsubscribe line, and the account page has the switch.
--
-- `digest_last_sent_at` is what makes the cron idempotent. A scheduler that
-- fires twice — a retry, an overlapping run, someone triggering it by hand —
-- must not send twice, and "have we already sent this week?" is a question only
-- the database can answer reliably.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS digest_opt_out      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS digest_last_sent_at timestamptz;

COMMENT ON COLUMN public.profiles.digest_opt_out IS
  'Author has unsubscribed from the weekly reader digest.';
COMMENT ON COLUMN public.profiles.digest_last_sent_at IS
  'When the last digest was sent. Guards against duplicate sends across cron retries.';

-- Lets the cron select only the candidates rather than scanning every profile.
CREATE INDEX IF NOT EXISTS profiles_digest_due
  ON public.profiles (digest_last_sent_at)
  WHERE digest_opt_out = false;

-- A user may switch their own digest off. Deliberately the only column end users
-- can update: 004 grants no UPDATE policy at all, precisely so nobody can
-- change their own `plan`, and that must stay true. The WITH CHECK clause pins
-- plan and status to their current values, so this policy cannot be used as a
-- route to escalation.
DROP POLICY IF EXISTS "profiles_update_own_prefs" ON public.profiles;
CREATE POLICY "profiles_update_own_prefs" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND plan   = (SELECT p.plan   FROM public.profiles p WHERE p.id = auth.uid())
    AND status = (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid())
  );


-- Migration: 014_slug_history.sql
-- Old slugs, so an edition's link can change without breaking what was sent.
--
-- The slug was set once at creation and then permanent, because it is the public
-- address and nothing could forward the old one. That made a typo in a link
-- forever — and the link is the whole product: it goes in emails, on printed
-- cards, into a client's CMS. "Delete it and start again" is not an answer when
-- the edition already has readers and analytics.
--
-- Every slug an edition has ever used lives here, so the reader can answer an
-- old link with a permanent redirect to the current one. The primary key on
-- `slug` is what stops a released slug being claimed by a different edition:
-- a new edition taking someone's abandoned slug would silently hijack their old
-- links, which is worse than the typo.

CREATE TABLE IF NOT EXISTS public.book_slug_history (
  slug       text PRIMARY KEY,
  book_id    uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS book_slug_history_book ON public.book_slug_history (book_id);

ALTER TABLE public.book_slug_history ENABLE ROW LEVEL SECURITY;

-- Readers arrive anonymously on a dead link and need the forwarding address.
-- The row holds no private data: a slug that was public and the id it points at.
DROP POLICY IF EXISTS "public_read" ON public.book_slug_history;
CREATE POLICY "public_read" ON public.book_slug_history
  FOR SELECT
  USING (true);

-- Writes happen in the rename path, which runs with the service role after
-- verifying ownership. No client-facing INSERT or UPDATE policy: a client that
-- could write here could redirect someone else's links.

-- --------------------------------------------------------------------------
-- 012_fix_pages_layout_check.sql
-- --------------------------------------------------------------------------

-- The pages CHECK constraint has been behind the application since 002.
--
-- It allows ('hero', 'split', 'text', 'blank'). The editor's layout dropdown has
-- shipped a fifth option the whole time — "Grid (2x2 Multi-Card Display)" in
-- PageSettingsForm — and `PageRenderer` has a `grid` branch to draw it. Choosing
-- it produced a check_violation on save, which the editor surfaced as "Could not
-- save these pages". Nothing in the message pointed at the layout, so the only
-- way to recover was to guess.
--
-- 'canvas' is the sixth: a per-page free-composition mode where each block
-- carries a `frame`. Without this migration the mode saves nothing at all.
--
-- This is the same failure as 008, one table over: a Postgres enum drifting
-- behind the app's. The test in lib/schema-db-drift.test.ts now compares the two
-- so there is not a third.

ALTER TABLE public.pages DROP CONSTRAINT IF EXISTS pages_layout_check;

ALTER TABLE public.pages
  ADD CONSTRAINT pages_layout_check CHECK (
    layout IN ('hero', 'split', 'text', 'grid', 'blank', 'canvas')
  );

-- --------------------------------------------------------------------------
-- 013_appsumo_columns_backfill.sql
-- --------------------------------------------------------------------------

-- Every column the AppSumo code writes, on a table that may predate them.
--
-- 005 creates `appsumo_licenses` with `CREATE TABLE IF NOT EXISTS`, which is the
-- right thing on a fresh project and a no-op on a project that already has an
-- older version of the table — including one missing columns added since. The
-- hand-maintained consolidated migration carried a defensive block for exactly
-- this and the numbered migrations did not, so the two files disagreed about
-- what a correctly set-up database looks like.
--
-- This is the table the AppSumo launch runs on. A missing column here is not a
-- degraded feature, it is a buyer who paid and cannot redeem, on day one, in
-- public. Cheap insurance.

ALTER TABLE public.appsumo_licenses
  ADD COLUMN IF NOT EXISTS prev_license_key  text,
  ADD COLUMN IF NOT EXISTS tier              int  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS plan              text NOT NULL DEFAULT 'ltd_tier1',
  ADD COLUMN IF NOT EXISTS status            text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS activation_email  text,
  ADD COLUMN IF NOT EXISTS invoice_item_uuid text,
  ADD COLUMN IF NOT EXISTS redeemed_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS redeemed_at       timestamptz,
  ADD COLUMN IF NOT EXISTS created_at        timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at        timestamptz NOT NULL DEFAULT now();

-- Same reasoning for the profile columns the entitlement code reads on every
-- request. `getUserPlan` falling back to Free because a column is absent looks
-- identical to a buyer who has not redeemed.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan                text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS status              text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS appsumo_license_key text,
  ADD COLUMN IF NOT EXISTS appsumo_tier        int;

-- --------------------------------------------------------------------------
-- 014_schema_selfcheck.sql
-- --------------------------------------------------------------------------

-- Let the app ask the database what its CHECK constraints actually allow.
--
-- This repo has shipped the same bug twice: a Postgres CHECK drifting behind
-- the TypeScript enum it mirrors. 008 exists because `events.event_type`
-- allowed eleven values while the client sent thirteen, so every `page_click`
-- and `gate_unlock` was rejected for months. 012 exists because `pages.layout`
-- allowed four while the editor offered six, so choosing "Grid" produced
-- "Could not save these pages" and no way to work out why.
--
-- `lib/schema-db-drift.test.ts` compares the app's enums to the `.sql` files.
-- That catches a migration nobody wrote. It cannot catch a migration nobody
-- *applied*, which is the failure that actually reaches customers — and on
-- launch day the deployed database is the only one whose opinion matters.
--
-- So: a read-only function the health check calls. PostgREST cannot run
-- arbitrary SQL, and probing by inserting rows is not an option on a live
-- table — `books.owner_id` is NOT NULL against `auth.users`, so there is no
-- row to hang a probe off that is not a real customer's.
--
-- SECURITY DEFINER because reading `pg_constraint` needs catalog access the
-- anon and authenticated roles do not have and must not be given. Execute is
-- revoked from everyone and granted only to `service_role`, which is the
-- server-side client — the same shape as `replace_book_pages` in 009.

CREATE OR REPLACE FUNCTION public.constraint_allowed_values(
  p_table  text,
  p_column text
)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  -- Pulls the quoted literals out of `CHECK (col = ANY (ARRAY['a'::text, …]))`,
  -- which is how Postgres normalises `CHECK (col IN ('a', …))` when it stores
  -- the expression.
  SELECT COALESCE(
    (
      SELECT array_agg(m[1])
      FROM pg_constraint c
      JOIN pg_class     t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      CROSS JOIN LATERAL regexp_matches(
        pg_get_constraintdef(c.oid), '''([^'']+)''::text', 'g'
      ) AS m
      WHERE n.nspname = 'public'
        AND t.relname = p_table
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%' || p_column || '%'
    ),
    ARRAY[]::text[]
  );
$$;

REVOKE ALL ON FUNCTION public.constraint_allowed_values(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.constraint_allowed_values(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.constraint_allowed_values(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.constraint_allowed_values(text, text) TO service_role;

COMMENT ON FUNCTION public.constraint_allowed_values(text, text) IS
  'Values a CHECK constraint on public.<table>.<column> allows. Read-only; used by /api/health to prove the live schema matches the running code.';

