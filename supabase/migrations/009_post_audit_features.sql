-- Migration: 009_add_gate_view_event.sql
-- 'gate_view' records a reader reaching the lead gate. Without it the dashboard
-- could only show unlocks, which is a count with no denominator — an author had
-- no way to tell whether their gate copy converts or whether people simply never
-- get that far.
--
-- Keep in sync with EventType in lib/book-schema.ts and the enum in
-- app/api/events/route.ts.
ALTER TABLE public.events DROP CONSTRAINT events_event_type_check;

ALTER TABLE public.events ADD CONSTRAINT events_event_type_check CHECK (event_type IN (
  'book_open','page_view','page_flip','hotspot_click',
  'modal_open','modal_close','video_play','video_complete',
  'audio_play','cta_click','book_complete','page_click',
  'gate_view','gate_unlock'
));


-- Migration: 010_replace_book_pages.sql
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


-- Migration: 011_dunning_grace.sql
-- Dunning limit for failed subscription payments.
--
-- `past_due` was treated as an active status, with nothing recording when the
-- account entered it. A subscription whose payments keep failing therefore kept
-- Pro entitlements indefinitely: Stripe stops retrying and eventually cancels,
-- but if that final event is missed, delayed, or delivered out of order, the
-- account simply stays on Pro forever. Keeping a grace window is right — a
-- card that expires on a Friday shouldn't take the product away — but the
-- window has to end, which means knowing when it opened.
--
-- `stripe_past_due_since` is set the first time a subscription reports
-- `past_due` and cleared as soon as it recovers, so the grace period is
-- measured from the start of the dunning run rather than restarting on every
-- retry event.
--
-- `stripe_event_at` guards against Stripe's at-least-once, unordered delivery:
-- an `updated` event that arrives after a `deleted` event would otherwise
-- resurrect a cancelled subscription. The webhook ignores any event older than
-- the newest one it has already applied.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_past_due_since timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_event_at       timestamptz;

COMMENT ON COLUMN public.profiles.stripe_past_due_since IS
  'When the current dunning run began. NULL when the subscription is healthy.';
COMMENT ON COLUMN public.profiles.stripe_event_at IS
  'created timestamp of the newest Stripe subscription event applied to this row.';


-- Migration: 012_edition_engagement.sql
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


-- Migration: 013_weekly_digest.sql
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


-- Migration: 014_slug_history.sql
-- Old slugs, so an edition's link can change without breaking what was sent.
--
-- The slug was set once at creation and then permanent, because it is the public
-- address and nothing could forward the old one. That made a typo in a link
-- forever — and the link is the whole product: it goes in emails, on printed
-- cards, into a client's CMS. "Delete it and start again" is not an answer when
-- the edition already has readers and analytics.
--
-- Every slug an edition has ever used lives here, so the reader can answer an
-- old link with a permanent redirect to the current one. The primary key on
-- `slug` is what stops a released slug being claimed by a different edition:
-- a new edition taking someone's abandoned slug would silently hijack their old
-- links, which is worse than the typo.

CREATE TABLE IF NOT EXISTS public.book_slug_history (
  slug       text PRIMARY KEY,
  book_id    uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS book_slug_history_book ON public.book_slug_history (book_id);

ALTER TABLE public.book_slug_history ENABLE ROW LEVEL SECURITY;

-- Readers arrive anonymously on a dead link and need the forwarding address.
-- The row holds no private data: a slug that was public and the id it points at.
CREATE POLICY "public_read" ON public.book_slug_history
  FOR SELECT
  USING (true);

-- Writes happen in the rename path, which runs with the service role after
-- verifying ownership. No client-facing INSERT or UPDATE policy: a client that
-- could write here could redirect someone else's links.


