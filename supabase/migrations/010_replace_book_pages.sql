-- Atomic page replacement for autosave.
--
-- PUT /api/books/[id]/pages used to run two separate statements:
--
--   DELETE FROM pages WHERE book_id = $1;
--   INSERT INTO pages (...) VALUES (...);
--
-- with nothing joining them. Every autosave — which the editor fires roughly
-- every two seconds — therefore opened a window in which the book had zero
-- pages. Anything that stopped the insert from landing (a constraint violation
-- on one page, a dropped connection, the serverless function being reclaimed
-- between the two round-trips) left the author's book permanently empty. The
-- route returned 500, but a 500 restores nothing.
--
-- Delete-then-insert is itself necessary rather than lazy: UNIQUE
-- (book_id, page_number) is checked per row, so upserting a reorder — page 3
-- becoming page 5 while page 5 becomes page 3 — collides mid-statement. The fix
-- is not to avoid the delete but to make it share a transaction with the
-- insert. A plpgsql function body is exactly that: either both statements
-- commit or neither does.
--
-- SECURITY INVOKER (the default) is deliberate. The route already verifies
-- ownership before calling, and it calls with the service role, which bypasses
-- RLS. Were this SECURITY DEFINER, any client that reached it directly could
-- replace the pages of an arbitrary book_id. As an invoker function, a
-- non-owner is stopped by the same RLS policies that guard the table — and
-- EXECUTE is revoked from the client roles below regardless.

CREATE OR REPLACE FUNCTION public.replace_book_pages(p_book_id uuid, p_pages jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.pages WHERE book_id = p_book_id;

  IF p_pages IS NULL OR jsonb_typeof(p_pages) <> 'array' OR jsonb_array_length(p_pages) = 0 THEN
    RETURN;
  END IF;

  -- blocks/hotspots are jsonb[] columns, not jsonb, so each JSON array has to
  -- be unnested and re-aggregated into a Postgres array rather than cast.
  INSERT INTO public.pages (id, book_id, page_number, type, layout, background, blocks, hotspots)
  SELECT
    COALESCE(NULLIF(p->>'id', '')::uuid, gen_random_uuid()),
    p_book_id,
    (p->>'page_number')::int,
    p->>'type',
    p->>'layout',
    COALESCE(p->'background', '{}'::jsonb),
    COALESCE(
      (SELECT array_agg(b) FROM jsonb_array_elements(COALESCE(p->'blocks', '[]'::jsonb)) AS b),
      '{}'::jsonb[]
    ),
    COALESCE(
      (SELECT array_agg(h) FROM jsonb_array_elements(COALESCE(p->'hotspots', '[]'::jsonb)) AS h),
      '{}'::jsonb[]
    )
  FROM jsonb_array_elements(p_pages) AS t(p);
END;
$$;

REVOKE ALL ON FUNCTION public.replace_book_pages(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_book_pages(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.replace_book_pages(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_book_pages(uuid, jsonb) TO service_role;
