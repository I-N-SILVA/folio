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
