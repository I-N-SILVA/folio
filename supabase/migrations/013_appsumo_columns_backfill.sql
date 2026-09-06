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
