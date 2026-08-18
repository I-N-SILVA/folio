-- Per-edition engagement, aggregated in Postgres.
--
-- `lib/insights.ts` pulled the raw event rows for every published edition and
-- counted them in JavaScript, capped at 20,000 rows so a popular account
-- couldn't turn the dashboard into a memory problem. That cap is the problem:
-- the figures it produces are a floor, not a total, and the one question the
-- page exists to answer — is anyone reading this? — deserves an exact answer.
--
-- Counting where the rows already live is both exact and cheaper: three
-- COUNT(DISTINCT) per book instead of tens of thousands of rows crossing the
-- wire. The route prefers this function and keeps the JS path as a fallback for
-- installs that haven't applied this migration, the same way
-- PUT /api/books/[id]/pages falls back when 010 is missing.
--
-- Readers are distinct `session_id`s rather than `book_open` counts. One person
-- who opens an edition three times is one reader; counting opens is how an
-- author refreshing their own tab becomes an audience.
--
-- SECURITY INVOKER (the default) is deliberate, matching replace_book_pages():
-- callers pass book ids they have already established ownership of, and they
-- call with the service role. As an invoker function a direct caller is still
-- bound by the RLS policies on `events`, and EXECUTE is revoked from the client
-- roles below regardless.

CREATE OR REPLACE FUNCTION public.edition_engagement(
  p_book_ids uuid[],
  p_since    timestamptz
)
RETURNS TABLE (
  book_id      uuid,
  readers      bigint,
  completions  bigint,
  leads        bigint,
  last_read_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    b.id AS book_id,
    COUNT(DISTINCT e.session_id) FILTER (WHERE e.event_type = 'book_open')     AS readers,
    COUNT(DISTINCT e.session_id) FILTER (WHERE e.event_type = 'book_complete') AS completions,
    COUNT(*)                     FILTER (WHERE e.event_type = 'gate_unlock')   AS leads,
    MAX(e.created_at)                                                          AS last_read_at
  FROM unnest(p_book_ids) AS b(id)
  LEFT JOIN public.events e
    ON e.book_id = b.id
   AND e.created_at >= p_since
   AND e.event_type IN ('book_open', 'book_complete', 'gate_unlock')
  GROUP BY b.id;
$$;

REVOKE ALL ON FUNCTION public.edition_engagement(uuid[], timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.edition_engagement(uuid[], timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.edition_engagement(uuid[], timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.edition_engagement(uuid[], timestamptz) TO service_role;

-- The aggregate filters on event_type within a book and time window. The
-- existing (book_id, created_at DESC) index covers the range; this one lets the
-- type filter be satisfied without visiting rows for page_view and page_click,
-- which outnumber the three types above by a wide margin.
CREATE INDEX IF NOT EXISTS events_book_type_created
  ON public.events (book_id, event_type, created_at DESC);
