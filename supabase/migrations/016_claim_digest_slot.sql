-- Claim a profile's weekly-digest slot atomically, in the database.
--
-- The same failure as 015, in the other place this codebase claims a slot
-- before acting. `app/api/cron/digest` expressed it as a PostgREST filter:
--
--   .update({ digest_last_sent_at: now })
--   .eq('id', profile.id)
--   .or(`digest_last_sent_at.is.null,digest_last_sent_at.lt.${due}`)
--   .select('id')
--
-- PostgREST compiles an UPDATE carrying a `select=` into a CTE and re-applies
-- logical filters to the CTE's output, which here holds only `id`. So the
-- second copy of the OR names `profiles.digest_last_sent_at`, which is not
-- there, and Postgres answers `42703`. The route reads no rows from that and
-- treats it as "somebody else claimed this one" — `skipped++`, `continue`.
--
-- Every profile. Every run. **The weekly digest has never sent an email to
-- anybody**, and could not have. `HANDOVER` recorded that as "written,
-- scheduled, idempotent and typechecked, and no human has ever received one"
-- and read it as nobody having run the cron. Running it was never going to
-- work.
--
-- The interval is the caller's to decide (six days, deliberately shorter than
-- the reported window, because a weekly cron drifts) so it is a parameter
-- rather than baked in here.

CREATE OR REPLACE FUNCTION public.claim_digest_slot(
  p_user_id uuid,
  p_due     timestamptz
)
RETURNS TABLE (id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles AS p
  SET digest_last_sent_at = now()
  WHERE p.id = p_user_id
    AND (p.digest_last_sent_at IS NULL OR p.digest_last_sent_at < p_due)
  RETURNING p.id;
$$;

-- Server only. Exposed to `authenticated` this would let anyone mark anyone
-- else's digest as sent, which is a quiet way to stop a competitor's email.
REVOKE ALL ON FUNCTION public.claim_digest_slot(uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_digest_slot(uuid, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.claim_digest_slot(uuid, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_digest_slot(uuid, timestamptz) TO service_role;

COMMENT ON FUNCTION public.claim_digest_slot(uuid, timestamptz) IS
  'Marks a profile''s digest as sent, only if it was actually due. Returns the row only if the caller won the claim, so a retry or an overlapping cron run cannot double-send.';
