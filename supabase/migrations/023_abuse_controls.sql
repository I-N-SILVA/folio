-- Abuse controls: reader reports, and a takedown the author cannot undo.
--
-- Hosted document readers are a standard phishing host: an attacker signs up
-- free, publishes a page that looks like a bank login or an invoice, and sends
-- the link. If that happens at volume, Google Safe Browsing flags the domain,
-- and every customer's edition — on the same host — shows a red warning screen
-- to every reader. That is the failure that ends a product like this, and it
-- had no defence at all: no way for a reader to report an edition, and no way
-- for the operator to take one down short of deleting the author's data.
--
--   * `books.suspended_at` takes an edition off the public internet. It is
--     enforced in the public read policies themselves, so the reader, the
--     embed, the unlock route and anything written later all honour it without
--     having to remember to.
--   * Only the server can set or clear it. `owner_all` lets an author update
--     their own row, so a trigger pins the two columns for every other role.
--   * `edition_reports` records what readers report; the API mails the
--     operator. Nothing is suspended automatically on reports — a report count
--     is something a competitor can manufacture.

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS suspended_at     timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_reason text;

COMMENT ON COLUMN public.books.suspended_at IS
  'Set by the operator (suspend_edition) to take an edition off the public internet. Authors cannot change it.';

-- ── Authors cannot lift their own suspension ─────────────────────────────────
--
-- The same shape as the profiles UPDATE policy in 009, which pins plan and
-- status: a row the owner may write, with columns that are not theirs to write.
-- Silently keeps the old values rather than raising, so an ordinary save of a
-- suspended edition still saves everything else.
CREATE OR REPLACE FUNCTION public.pin_book_suspension()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.suspended_at := NULL;
      NEW.suspended_reason := NULL;
    ELSE
      NEW.suspended_at := OLD.suspended_at;
      NEW.suspended_reason := OLD.suspended_reason;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS books_pin_suspension ON public.books;
CREATE TRIGGER books_pin_suspension
  BEFORE INSERT OR UPDATE ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.pin_book_suspension();

-- ── Suspended editions are not public ────────────────────────────────────────

DROP POLICY IF EXISTS "public_read_published" ON public.books;
CREATE POLICY "public_read_published" ON public.books
  FOR SELECT
  USING ((settings->>'published')::boolean = true AND suspended_at IS NULL);

DROP POLICY IF EXISTS "public_read_published" ON public.pages;
CREATE POLICY "public_read_published" ON public.pages
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id = pages.book_id
      AND (books.settings->>'published')::boolean = true
      AND books.suspended_at IS NULL
  ));

-- ── Operator controls ────────────────────────────────────────────────────────
--
-- Run from the Supabase SQL editor:
--   SELECT public.suspend_edition('the-slug', 'phishing: fake invoice login');
--   SELECT public.restore_edition('the-slug');
-- Each returns the number of editions changed (0 means no such slug).
-- The reader caches for up to 60 seconds (ISR), so a takedown is live within a
-- minute.

CREATE OR REPLACE FUNCTION public.suspend_edition(p_slug text, p_reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.books
  SET suspended_at = now(), suspended_reason = NULLIF(trim(p_reason), '')
  WHERE slug = p_slug;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_edition(p_slug text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.books
  SET suspended_at = NULL, suspended_reason = NULL
  WHERE slug = p_slug;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.suspend_edition(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_edition(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_edition(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_edition(text) TO service_role;

-- ── Reader reports ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.edition_reports (
  id            bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  book_id       uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  reason        text NOT NULL CHECK (reason IN (
    'phishing', 'malware', 'scam', 'illegal', 'copyright', 'hate', 'other'
  )),
  details       text CHECK (char_length(details) <= 2000),
  reporter_email text CHECK (char_length(reporter_email) <= 320),
  -- A hash, not the address: enough to spot one person filing fifty reports,
  -- without keeping readers' IPs.
  reporter_hash text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS edition_reports_book
  ON public.edition_reports (book_id, created_at DESC);

-- No policies: written and read by the server only.
ALTER TABLE public.edition_reports ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.edition_reports IS
  'Reader reports of abusive editions. Server-only; POST /api/report writes it and mails the operator.';
