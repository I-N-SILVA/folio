-- ============================================================================
-- QLICO COMPLETE MASTER SUPABASE DATABASE MIGRATION (IDEMPOTENT)
-- Run this in the Supabase SQL Editor to set up the entire production backend.
-- Includes: Books, Pages, Analytics Events, Profiles, AppSumo LTD Licensing,
-- Stripe Subscriptions, Quota Triggers, and Stored Procedures.
-- ============================================================================

-- 1. Helper function for automated updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 2. BOOKS TABLE
-- ----------------------------------------------------------------------------
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

DROP TRIGGER IF EXISTS books_updated_at ON public.books;
CREATE TRIGGER books_updated_at
  BEFORE UPDATE ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'books' AND policyname = 'owner_all') THEN
    CREATE POLICY "owner_all" ON public.books
      FOR ALL
      USING (auth.uid() = owner_id)
      WITH CHECK (auth.uid() = owner_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'books' AND policyname = 'public_read_published') THEN
    CREATE POLICY "public_read_published" ON public.books
      FOR SELECT
      USING ((settings->>'published')::boolean = true);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. PAGES TABLE
-- ----------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS pages_book_order ON public.pages (book_id, page_number);

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pages' AND policyname = 'owner_all') THEN
    CREATE POLICY "owner_all" ON public.pages
      FOR ALL
      USING (EXISTS (
        SELECT 1 FROM public.books WHERE books.id = pages.book_id AND books.owner_id = auth.uid()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.books WHERE books.id = pages.book_id AND books.owner_id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pages' AND policyname = 'public_read_published') THEN
    CREATE POLICY "public_read_published" ON public.pages
      FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.books
        WHERE books.id = pages.book_id AND (books.settings->>'published')::boolean = true
      ));
  END IF;
END $$;

-- Atomic batch page replacement for autosave
CREATE OR REPLACE FUNCTION public.replace_book_pages(p_book_id uuid, p_pages jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.pages WHERE book_id = p_book_id;

  IF p_pages IS NULL OR jsonb_typeof(p_pages) <> 'array' OR jsonb_array_length(p_pages) = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.pages (
    id,
    book_id,
    page_number,
    type,
    layout,
    background,
    blocks,
    hotspots,
    created_at,
    updated_at
  )
  SELECT
    COALESCE((elem->>'id')::uuid, gen_random_uuid()),
    p_book_id,
    (elem->>'page_number')::int,
    elem->>'type',
    elem->>'layout',
    elem->'background',
    COALESCE(
      (SELECT array_agg(b) FROM jsonb_array_elements(elem->'blocks') b),
      '{}'::jsonb[]
    ),
    COALESCE(
      (SELECT array_agg(h) FROM jsonb_array_elements(elem->'hotspots') h),
      '{}'::jsonb[]
    ),
    now(),
    now()
  FROM jsonb_array_elements(p_pages) AS elem;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. ANALYTICS EVENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
  id          bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  book_id     uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  session_id  text NOT NULL,
  event_type  text NOT NULL CHECK (event_type IN (
    'book_open','page_view','page_flip','hotspot_click',
    'modal_open','modal_close','video_play','video_complete',
    'audio_play','cta_click','book_complete','page_click',
    'gate_view','gate_unlock'
  )),
  page_number int,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_book_type ON public.events (book_id, event_type);
CREATE INDEX IF NOT EXISTS events_book_id ON public.events (book_id, created_at DESC);
CREATE INDEX IF NOT EXISTS events_page_number ON public.events (book_id, page_number) WHERE page_number IS NOT NULL;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'anon_insert') THEN
    CREATE POLICY "anon_insert" ON public.events FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'owner_read') THEN
    CREATE POLICY "owner_read" ON public.events FOR SELECT USING (EXISTS (
      SELECT 1 FROM public.books WHERE books.id = events.book_id AND books.owner_id = auth.uid()
    ));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. USER PROFILES TABLE (Billing & Entitlements)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id                   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                text,
  plan                 text NOT NULL DEFAULT 'free',
  status               text NOT NULL DEFAULT 'active', -- active | refunded | deactivated
  appsumo_license_key  text UNIQUE,
  appsumo_tier         int,
  appsumo_invoice_uuid text,
  stripe_customer_id   text UNIQUE,
  stripe_subscription_id text,
  stripe_status        text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_stripe_customer ON public.profiles (stripe_customer_id);

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-provision profile on auth signup
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

-- Backfill profiles for existing users
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_read_own') THEN
    CREATE POLICY "profiles_read_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. APPSUMO LIFETIME-DEAL LICENSES TABLE
-- ----------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS appsumo_licenses_email ON public.appsumo_licenses (lower(activation_email));

DROP TRIGGER IF EXISTS appsumo_licenses_updated_at ON public.appsumo_licenses;
CREATE TRIGGER appsumo_licenses_updated_at
  BEFORE UPDATE ON public.appsumo_licenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.appsumo_licenses ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 7. DEFENSE-IN-DEPTH BOOK QUOTA ENFORCEMENT TRIGGER
-- ----------------------------------------------------------------------------
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

-- ============================================================================
-- SUCCESS: Complete master migration initialized!
-- ============================================================================
