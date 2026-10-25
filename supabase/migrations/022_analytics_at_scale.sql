-- Analytics that stay correct as editions get read, and a table that stops
-- growing for ever. Plus finite edition limits on every plan.
--
-- Four problems, all invisible at launch and all worse the better an edition
-- does:
--
--   1. **Every reader event was stored with no page number.** The reader puts
--      `page_number` in the payload (`trackEvent(id, 'page_view', { page_number
--      })`); `/api/events` only read a top-level `pageNumber`, which no caller
--      sends. So `events.page_number` was NULL on every page view, click and
--      hotspot event, and the per-page views, the reading funnel and the
--      heatmap in Insights had nothing to group by. The route now reads the
--      payload; this backfills the rows already written.
--   2. **Insights were computed from at most 1,000 rows.** The analytics route
--      selected raw events and counted them in JavaScript, and PostgREST caps a
--      response at 1,000 rows by default. Past ~70 reads in the window, every
--      figure on the dashboard was a silent undercount. `edition_analytics`
--      counts where the rows live, the way `edition_engagement` (009) already
--      does for the Insights list.
--   3. **Nothing ever deleted an event.** At ~15 events a read the table grows
--      by gigabytes a month at modest scale. No surface reads further back than
--      the longest plan window (365 days), so `prune_events` deletes older rows,
--      in batches, from a daily cron.
--   4. **Two plans had no edition limit.** See `book_limit_for_plan` below.

-- ── 1. Backfill page numbers from the payload ────────────────────────────────
--
-- Only rows that have none, only where the payload holds a plain positive
-- integer. Idempotent: a second run matches nothing.
UPDATE public.events
SET page_number = (payload->>'page_number')::int
WHERE page_number IS NULL
  AND payload ? 'page_number'
  AND payload->>'page_number' ~ '^[1-9][0-9]{0,5}$';

-- ── 2. An index the prune can use ────────────────────────────────────────────
--
-- Every existing index leads with book_id, so "everything older than X" would
-- scan the table. BRIN is a few pages in size for an append-only table whose
-- rows arrive in created_at order, and costs next to nothing on insert.
CREATE INDEX IF NOT EXISTS events_created_brin
  ON public.events USING brin (created_at);

-- ── 3. Per-edition analytics, aggregated in Postgres ─────────────────────────
--
-- One call, one JSON document, exact at any volume. The shape matches what
-- `app/api/analytics/[slug]/route.ts` returns, so the dashboard did not change.
--
-- Two lists are bounded on purpose, because they are lists rather than counts:
-- heatmap points (the most recent 2,000 per page — a sample is what a heatmap
-- draws) and leads (the most recent 1,000 — the CSV export has all of them).
--
-- SECURITY INVOKER, service role only, like `edition_engagement`: the route
-- establishes ownership first and then calls this for that one book.
CREATE OR REPLACE FUNCTION public.edition_analytics(
  p_book_id uuid,
  p_since   timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH ev AS (
    SELECT session_id, event_type, page_number, payload, created_at
    FROM public.events
    WHERE book_id = p_book_id AND created_at >= p_since
  ),
  sessions AS (
    SELECT COUNT(DISTINCT session_id) AS n FROM ev
  ),
  summary AS (
    SELECT jsonb_build_object(
      'totalOpens',     COUNT(*) FILTER (WHERE event_type = 'book_open'),
      'uniqueSessions', (SELECT n FROM sessions),
      'completionRate', CASE WHEN (SELECT n FROM sessions) > 0
        THEN ROUND(100.0 * COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'book_complete')
                   / (SELECT n FROM sessions))::int
        ELSE 0 END,
      'avgSessionMs', COALESCE(ROUND(AVG((payload->>'session_duration_ms')::numeric)
        FILTER (WHERE event_type = 'book_complete'
                  AND payload->>'session_duration_ms' ~ '^[0-9]+(\.[0-9]+)?$'))::bigint, 0)
    ) AS j
    FROM ev
  ),
  page_views AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'page', page, 'views', views, 'avgDwellMs', avg_dwell) ORDER BY page), '[]'::jsonb) AS j
    FROM (
      SELECT COALESCE(page_number, 0) AS page,
             COUNT(*) AS views,
             COALESCE(ROUND(AVG(CASE WHEN payload->>'dwell_ms' ~ '^[0-9]+(\.[0-9]+)?$'
                                     THEN (payload->>'dwell_ms')::numeric ELSE 0 END))::bigint, 0) AS avg_dwell
      FROM ev
      WHERE event_type = 'page_view'
      GROUP BY 1
    ) p
  ),
  funnel AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'page', page,
             'sessions', reached,
             'pct', CASE WHEN (SELECT n FROM sessions) > 0
                         THEN ROUND(100.0 * reached / (SELECT n FROM sessions))::int ELSE 0 END)
             ORDER BY page), '[]'::jsonb) AS j
    FROM (
      SELECT pages.page,
             COUNT(DISTINCT pv.session_id) AS reached
      FROM (SELECT DISTINCT page_number AS page FROM ev WHERE page_number IS NOT NULL) pages
      LEFT JOIN ev pv
        ON pv.event_type = 'page_view' AND pv.page_number = pages.page
      GROUP BY pages.page
    ) f
  ),
  hotspots AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'count', n) ORDER BY n DESC, id), '[]'::jsonb) AS j
    FROM (
      SELECT payload->>'hotspot_id' AS id, COUNT(*) AS n
      FROM ev
      WHERE event_type = 'hotspot_click' AND payload->>'hotspot_id' IS NOT NULL
      GROUP BY 1
      ORDER BY n DESC, id
      LIMIT 10
    ) h
  ),
  ctas AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'id', id, 'href', href, 'page', page,
             'clicks', clicks, 'uniqueClicks', unique_clicks)), '[]'::jsonb) AS j
    FROM (
      SELECT payload->>'block_id' AS id,
             (array_agg(payload->>'href' ORDER BY created_at))[1] AS href,
             (array_agg(page_number ORDER BY created_at))[1] AS page,
             COUNT(*) AS clicks,
             COUNT(DISTINCT session_id) AS unique_clicks
      FROM ev
      WHERE event_type = 'cta_click' AND payload->>'block_id' IS NOT NULL
      GROUP BY 1
    ) c
  ),
  heat AS (
    SELECT COALESCE(jsonb_object_agg(page, points), '{}'::jsonb) AS j
    FROM (
      SELECT page, jsonb_agg(jsonb_build_object('x', x, 'y', y)) AS points
      FROM (
        SELECT COALESCE(page_number, 0) AS page,
               (payload->>'x')::numeric AS x,
               (payload->>'y')::numeric AS y,
               ROW_NUMBER() OVER (PARTITION BY COALESCE(page_number, 0) ORDER BY created_at DESC) AS rn
        FROM ev
        WHERE event_type = 'page_click'
          AND payload->>'x' ~ '^-?[0-9]+(\.[0-9]+)?$'
          AND payload->>'y' ~ '^-?[0-9]+(\.[0-9]+)?$'
      ) pts
      WHERE rn <= 2000
      GROUP BY page
    ) hp
  ),
  leads AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'email', email, 'timestamp', created_at, 'page', page) ORDER BY created_at), '[]'::jsonb) AS j
    FROM (
      SELECT payload->>'email' AS email, created_at, COALESCE(page_number, 3) AS page
      FROM ev
      WHERE event_type = 'gate_unlock' AND payload->>'email' IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1000
    ) l
  ),
  gate AS (
    SELECT jsonb_build_object(
      'views',   COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'gate_view'),
      'unlocks', COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'gate_unlock'),
      'rate', CASE WHEN COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'gate_view') > 0
        THEN ROUND(100.0 * COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'gate_unlock')
                   / COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'gate_view'))::int
        ELSE 0 END
    ) AS j
    FROM ev
  )
  SELECT jsonb_build_object(
    'summary',      (SELECT j FROM summary),
    'pageViewData', (SELECT j FROM page_views),
    'funnelData',   (SELECT j FROM funnel),
    'topHotspots',  (SELECT j FROM hotspots),
    'ctaData',      (SELECT j FROM ctas),
    'heatmapData',  (SELECT j FROM heat),
    'leadData',     (SELECT j FROM leads),
    'gate',         (SELECT j FROM gate)
  );
$$;

REVOKE ALL ON FUNCTION public.edition_analytics(uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.edition_analytics(uuid, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.edition_analytics(uuid, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.edition_analytics(uuid, timestamptz) TO service_role;

COMMENT ON FUNCTION public.edition_analytics(uuid, timestamptz) IS
  'Everything the per-edition Insights page shows, aggregated in Postgres. Exact at any volume; heatmap points and leads are capped lists.';

-- ── 4. Retention ─────────────────────────────────────────────────────────────
--
-- Deletes up to `p_batch` events older than `p_before` and returns how many it
-- deleted; the cron calls it until it returns less than a full batch, so no
-- single statement holds a long lock on a large table.
--
-- **Leads are never pruned.** A `gate_unlock` row is the only copy of an email
-- a reader gave an author, and deleting it on a schedule would delete the
-- author's customer list. Everything else is reading telemetry that no surface
-- shows past the longest plan window.
CREATE OR REPLACE FUNCTION public.prune_events(
  p_before timestamptz,
  p_batch  integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF p_batch IS NULL OR p_batch <= 0 THEN
    RETURN 0;
  END IF;

  WITH doomed AS (
    SELECT id FROM public.events
    WHERE created_at < p_before
      AND event_type <> 'gate_unlock'
    LIMIT p_batch
  )
  DELETE FROM public.events e
  USING doomed
  WHERE e.id = doomed.id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_events(timestamptz, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prune_events(timestamptz, integer) FROM anon;
REVOKE ALL ON FUNCTION public.prune_events(timestamptz, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.prune_events(timestamptz, integer) TO service_role;

COMMENT ON FUNCTION public.prune_events(timestamptz, integer) IS
  'Deletes up to p_batch reading events older than p_before, never gate_unlock (leads). Returns the number deleted.';

-- ── 5. No plan is unlimited any more ─────────────────────────────────────────
--
-- `pro` and `ltd_tier3` were int4 max. An edition limit nobody reaches costs
-- nothing to keep, and an unlimited one on a lifetime plan is a liability sold
-- at a fixed price. Mirrors `lib/plans.ts`; `lib/plan-limits.test.ts` enforces
-- the mirror.
--
-- Accounts already above a new limit keep every edition they have — the
-- trigger only refuses new inserts.
CREATE OR REPLACE FUNCTION public.book_limit_for_plan(p text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p
    WHEN 'pro'       THEN 100
    WHEN 'ltd_tier3' THEN 200
    WHEN 'ltd_tier2' THEN 50
    WHEN 'ltd_tier1' THEN 10
    ELSE 3 -- free
  END;
$$;
