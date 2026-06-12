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

CREATE POLICY "profiles_read_own" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Note: plan/status are mutated only by the service role (webhook + redeem
-- routes), which bypasses RLS. We intentionally do NOT grant an UPDATE policy
-- to end users so they cannot upgrade their own plan client-side.
