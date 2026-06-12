-- Stripe subscription billing for the Pro plan. AppSumo (lifetime) and Stripe
-- (subscription) coexist: a profile's `plan` is driven by whichever is active.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id     text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_status          text;

CREATE INDEX IF NOT EXISTS profiles_stripe_customer
  ON public.profiles (stripe_customer_id);
