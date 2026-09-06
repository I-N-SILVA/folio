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

-- `auth.uid()` is the identity every RLS policy is written against. Supabase
-- reads it out of the request JWT; here it reads a session setting, which lets
-- a test become a given user with `SET LOCAL request.jwt.claim.sub`.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
