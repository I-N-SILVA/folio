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

CREATE TRIGGER appsumo_licenses_updated_at
  BEFORE UPDATE ON public.appsumo_licenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS on, no policies: only the service role (webhook + redeem routes) may
-- touch this table. End users never read or write it directly.
ALTER TABLE public.appsumo_licenses ENABLE ROW LEVEL SECURITY;
