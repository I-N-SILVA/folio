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
