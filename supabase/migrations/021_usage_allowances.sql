-- Usage allowances: AI page detection per month, and storage per account.
--
-- Two things on every plan cost money in proportion to use, and neither had a
-- limit that outlived a cold start:
--
--   * AI detection spends the project's Gemini quota per page. The only brake
--     was `rateLimitCost` at 200 pages a minute, held in each serverless
--     instance's memory — so the effective ceiling was 200 × instances, reset on
--     every deploy, with no monthly bound at all, on the Free plan included.
--   * Storage had a per-file size cap and nothing per account. Tier 3 of the
--     lifetime deal is unlimited editions, paid once, so an account's storage
--     grew for ever against a single payment.
--
-- `lib/plans.ts` now carries `aiPagesPerMonth` and `storageMB`; these are the
-- two places the server counts against them.

-- ── AI pages, per user per calendar month (UTC) ────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- First day of the month, so the key is a date rather than a string format.
  month   date NOT NULL,
  pages   integer NOT NULL DEFAULT 0 CHECK (pages >= 0),
  PRIMARY KEY (user_id, month)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- An author may read their own usage. Nobody writes it but the server, through
-- the function below — a user-writable counter is a counter users reset.
DROP POLICY IF EXISTS "ai_usage_select_own" ON public.ai_usage;
CREATE POLICY "ai_usage_select_own" ON public.ai_usage
  FOR SELECT USING (auth.uid() = user_id);

-- Claim up to `p_pages` pages of this month's allowance, atomically.
--
-- Returns how many were granted, which may be fewer than asked for (the rest
-- of the request falls back to the free heuristic) and is 0 once the month is
-- spent. Two requests racing for the last pages cannot both get them: the
-- upsert takes the row lock, and the grant is computed from the locked value.
CREATE OR REPLACE FUNCTION public.claim_ai_pages(
  p_user_id uuid,
  p_month   date,
  p_pages   integer,
  p_limit   integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used    integer;
  v_granted integer;
BEGIN
  IF p_pages IS NULL OR p_pages <= 0 OR p_limit IS NULL OR p_limit <= 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.ai_usage (user_id, month, pages)
  VALUES (p_user_id, p_month, 0)
  ON CONFLICT (user_id, month) DO NOTHING;

  SELECT pages INTO v_used
  FROM public.ai_usage
  WHERE user_id = p_user_id AND month = p_month
  FOR UPDATE;

  v_granted := GREATEST(0, LEAST(p_pages, p_limit - v_used));

  IF v_granted > 0 THEN
    UPDATE public.ai_usage
    SET pages = pages + v_granted
    WHERE user_id = p_user_id AND month = p_month;
  END IF;

  RETURN v_granted;
END;
$$;

-- Server only: exposed to `authenticated`, anyone could spend anyone's month.
REVOKE ALL ON FUNCTION public.claim_ai_pages(uuid, date, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_ai_pages(uuid, date, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.claim_ai_pages(uuid, date, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ai_pages(uuid, date, integer, integer) TO service_role;

COMMENT ON FUNCTION public.claim_ai_pages(uuid, date, integer, integer) IS
  'Grants up to p_pages of a user''s monthly AI allowance and returns how many were granted. Atomic under concurrency.';

-- ── Storage, per account ───────────────────────────────────────────────────

-- Bytes stored under every edition the user owns.
--
-- Uploads go straight from the browser to storage on signed URLs (the PDF
-- import), so the server never sees most of the bytes it is storing; the only
-- authoritative count is the object metadata Supabase Storage keeps.
--
-- plpgsql rather than sql on purpose: a sql body is resolved when the function
-- is created, and `storage.objects` does not exist in the plain PostgreSQL that
-- `npm run verify:migration` applies this file to. Resolved at call time, the
-- function installs anywhere and answers 0 where there is no storage schema.
CREATE OR REPLACE FUNCTION public.user_storage_bytes(p_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RETURN 0;
  END IF;

  EXECUTE $q$
    SELECT COALESCE(SUM((o.metadata->>'size')::bigint), 0)
    FROM storage.objects o
    JOIN public.books b
      ON o.name LIKE 'books/' || b.id::text || '/%'
    WHERE o.bucket_id = 'folio-assets'
      AND b.owner_id = $1
  $q$
  INTO v_total
  USING p_user_id;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.user_storage_bytes(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_storage_bytes(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.user_storage_bytes(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.user_storage_bytes(uuid) TO service_role;

COMMENT ON FUNCTION public.user_storage_bytes(uuid) IS
  'Total bytes in folio-assets under the editions a user owns. 0 where the storage schema is absent.';
