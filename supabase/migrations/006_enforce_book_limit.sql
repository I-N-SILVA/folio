-- Defense-in-depth: enforce the per-plan book limit at the database level so it
-- holds no matter which path creates a book (the REST API *or* a direct
-- client-side insert via RLS). The API still returns a friendly message first;
-- this trigger is the backstop.
--
-- Keep the limits in sync with lib/plans.ts.
CREATE OR REPLACE FUNCTION public.book_limit_for_plan(p text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p
    WHEN 'pro'       THEN 2147483647
    WHEN 'ltd_tier3' THEN 2147483647
    WHEN 'ltd_tier2' THEN 50
    WHEN 'ltd_tier1' THEN 10
    ELSE 1 -- free
  END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_book_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_plan   text;
  v_status text;
  v_limit  int;
  v_count  int;
BEGIN
  SELECT plan, status INTO v_plan, v_status
  FROM public.profiles WHERE id = NEW.owner_id;

  IF v_plan IS NULL THEN v_plan := 'free'; END IF;
  -- Refunded / deactivated accounts fall back to the free limit.
  IF v_status IS DISTINCT FROM 'active' THEN v_plan := 'free'; END IF;

  v_limit := public.book_limit_for_plan(v_plan);

  SELECT count(*) INTO v_count FROM public.books WHERE owner_id = NEW.owner_id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'BOOK_LIMIT_REACHED: plan % allows % book(s)', v_plan, v_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS books_enforce_limit ON public.books;
CREATE TRIGGER books_enforce_limit
  BEFORE INSERT ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.enforce_book_limit();
