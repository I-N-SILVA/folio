-- Which of this app's database functions are actually installed.
--
-- `/api/health` checks tables, columns and CHECK constraints against the
-- deployment that is running, and checks **no functions at all**. Eight of them
-- carry load, and two carry the money:
--
--   * `claim_appsumo_license` (015) — without it `redeemLicense` falls back to
--     nothing and every AppSumo redemption answers "We could not find that
--     license code". That is the bug this branch opened with. A deployment that
--     applied an older `master_migration.sql` reproduces it exactly, and every
--     other health check reports green while it does.
--   * `replace_book_pages` (009) — without it the page save falls back to a
--     non-atomic delete-then-insert, which is the data-loss shape that function
--     exists to prevent. The route already logs it; nothing surfaces it to
--     whoever is deciding whether the deployment is ready.
--
-- Read-only, and asks the catalog rather than calling anything. The obvious
-- alternative — invoking each function with harmless arguments — means a health
-- endpoint that runs an UPDATE and a DELETE every time somebody polls it, which
-- is not what "health check" should mean. This is the same shape as
-- `constraint_allowed_values` (014) for the same reason.

CREATE OR REPLACE FUNCTION public.installed_functions()
RETURNS TABLE (name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.proname::text
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
  GROUP BY p.proname;
$$;

REVOKE ALL ON FUNCTION public.installed_functions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.installed_functions() TO service_role;

COMMENT ON FUNCTION public.installed_functions() IS
  'Names of the public schema functions on this deployment. Read-only; /api/health compares it against REQUIRED_FUNCTIONS in lib/required-functions.ts.';
