-- The free plan allowed one edition and the product sold three.
--
-- `lib/plans.ts` is what the whole app reads: `/account` draws the quota bar
-- from `PLANS.free.entitlements.maxBooks`, `checkBookQuota` admits the request
-- from the same number, and the landing page's pricing card says "3 Active
-- Editions" in so many words. 006's ladder is a second copy of those numbers,
-- kept in step by a comment saying to keep them in step, and the free row
-- drifted to 1.
--
-- What a free author saw, on the second edition they tried to make:
--
--   HTTP 500  {"error":"BOOK_LIMIT_REACHED: plan free allows 1 book(s)"}
--
-- The API's quota check passed — it reads the correct 3 — so the request went
-- all the way to the insert and the trigger raised. The route's designed answer
-- for this (403, `code: 'plan_limit'`, used/limit, an upgrade prompt) was
-- unreachable, and a raw Postgres exception went to the browser instead.
--
-- This is the top of the funnel for the AppSumo launch: the people who arrive
-- from the deal page, try the free tier first, and decide from that whether the
-- lifetime deal is worth buying.
--
-- Only `free` had drifted; pro, tier1, tier2 and tier3 already agreed.
-- `lib/plan-limits.test.ts` now parses this function and `lib/plans.ts` and
-- fails if any row of the ladder stops matching, so the next edit to either
-- cannot go quiet.

CREATE OR REPLACE FUNCTION public.book_limit_for_plan(p text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p
    WHEN 'pro'       THEN 2147483647
    WHEN 'ltd_tier3' THEN 2147483647
    WHEN 'ltd_tier2' THEN 50
    WHEN 'ltd_tier1' THEN 10
    ELSE 3 -- free
  END;
$$;

COMMENT ON FUNCTION public.book_limit_for_plan(text) IS
  'The per-plan edition limit, mirroring PLANS[*].entitlements.maxBooks in lib/plans.ts. Infinity is stored as int4 max. lib/plan-limits.test.ts enforces the mirror.';
