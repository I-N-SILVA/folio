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
CREATE POLICY "profiles_update_own_prefs" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND plan   = (SELECT p.plan   FROM public.profiles p WHERE p.id = auth.uid())
    AND status = (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid())
  );
