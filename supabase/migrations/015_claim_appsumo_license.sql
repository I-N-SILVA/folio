-- Claim an AppSumo licence atomically, in one statement, in the database.
--
-- `redeemLicense` used to express this as a PostgREST filter:
--
--   .update({ redeemed_by: userId, redeemed_at: now })
--   .eq('license_key', licenseKey)
--   .neq('status', 'refunded')
--   .or(`redeemed_by.is.null,redeemed_by.eq.${userId}`)
--   .select('license_key, plan')
--
-- which is correct SQL and does not work. PostgREST compiles an UPDATE with a
-- `select=` into a CTE and then applies the *logical* filters a second time to
-- the CTE's output:
--
--   WITH pgrst_source AS (UPDATE … RETURNING license_key, plan)
--   SELECT … FROM pgrst_source AS appsumo_licenses
--   WHERE (appsumo_licenses.redeemed_by IS NULL OR appsumo_licenses.redeemed_by = $5)
--
-- `pgrst_source` only has the columns RETURNING produced, so the second copy of
-- the OR references a column that is not there and Postgres answers
-- `42703: column appsumo_licenses.redeemed_by does not exist`. Plain `eq`/`neq`
-- filters are not duplicated, which is why the failure looked column-specific
-- and was not.
--
-- `redeemLicense` treats that error as `not_found`, so **every AppSumo
-- redemption would have failed** with "We could not find that license code" —
-- on day one, to everybody, with the buyer holding a valid code. The unit tests
-- pass because they assert against a hand-rolled mock of the client, which
-- happily accepts `.or()`.
--
-- Adding `redeemed_by` to the `select=` makes PostgREST's second filter resolve
-- and is a one-word fix. It is not the one taken: it leaves the money path
-- depending on an undocumented quirk of how a filter is compiled, one careless
-- edit of a select list away from silently breaking again. The claim is a
-- single conditional UPDATE and belongs in a single statement the database
-- runs.
--
-- Concurrency is the whole point. Two simultaneous redemptions of one code must
-- not both win: the WHERE re-evaluates against the committed row, so the second
-- matches nothing and returns no rows. `redeemed_by = p_user_id` keeps a retry
-- by the rightful holder idempotent, so a dropped response does not tell a
-- buyer their own code is already used.

CREATE OR REPLACE FUNCTION public.claim_appsumo_license(
  p_license_key text,
  p_user_id     uuid
)
RETURNS TABLE (license_key text, plan text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.appsumo_licenses AS l
  SET redeemed_by = p_user_id,
      redeemed_at = now()
  WHERE l.license_key = p_license_key
    AND l.status <> 'refunded'
    AND (l.redeemed_by IS NULL OR l.redeemed_by = p_user_id)
  RETURNING l.license_key, l.plan;
$$;

-- Only the server may claim a licence. Exposed to `authenticated` this would
-- let any signed-in user claim any code they could guess, which is the whole
-- reason the redemption route is rate limited.
REVOKE ALL ON FUNCTION public.claim_appsumo_license(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_appsumo_license(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.claim_appsumo_license(text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_appsumo_license(text, uuid) TO service_role;

COMMENT ON FUNCTION public.claim_appsumo_license(text, uuid) IS
  'Atomically links an AppSumo licence to a user. Returns the row only if the caller won the claim; no rows means it was already held by somebody else, or refunded.';
