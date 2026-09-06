-- The parts of a Supabase project that `supabase/master_migration.sql` assumes
-- already exist, so it can be executed against a plain PostgreSQL server.
--
-- This is a test fixture, never applied to a real project — Supabase creates all
-- of it. It exists so the consolidated migration can be *run* rather than
-- read: it had never been executed anywhere, and it is the file every launch
-- document tells an operator to paste into the SQL editor.

CREATE SCHEMA IF NOT EXISTS auth;

-- The roles RLS policies and GRANTs name.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END $$;

-- Enough of auth.users to satisfy the foreign keys and the signup trigger.
CREATE TABLE IF NOT EXISTS auth.users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- `auth.uid()` is the identity every RLS policy is written against, so a shim
-- that gets it wrong does not fail — it returns NULL, every `USING (auth.uid()
-- = owner_id)` denies, and the harness reports the product as broken.
--
-- This read `request.jwt.claim.sub`, which PostgREST stopped setting in v9.
-- Against PostgREST 12 it is always NULL, so no harness here had ever executed
-- a statement as a signed-in user: everything ran as `service_role`, which
-- bypasses RLS entirely, or as `anon` against the public-read policy. The
-- policies themselves were untested.
--
-- These are Supabase's own definitions. The legacy setting is kept first
-- because it is also what `SET LOCAL request.jwt.claim.sub = '…'` sets, which
-- is how a psql test becomes a given user without minting a token.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    'anon'
  );
$$;

CREATE OR REPLACE FUNCTION auth.email() RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.email', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  );
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Supabase grants the API roles blanket table privileges and lets RLS do the
-- real gating. Without these PostgREST answers permission-denied for
-- everything, which looks like a broken app rather than a missing GRANT.
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- `service_role` is BYPASSRLS above, which is what makes supabaseAdmin able to
-- read and write regardless of policy — and why every route using it has to
-- check ownership itself.
