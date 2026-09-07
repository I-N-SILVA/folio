-- Draft comments, for a reviewer who has no account.
--
-- `docs/editor-redesign-spec.md` §9.3. There was a review drawer once and it
-- was cut, because what a reviewer typed lived in component state and a refresh
-- threw it away — a feedback tool that loses feedback is worse than no feedback
-- tool, because somebody trusted it. Persisting is therefore the whole point,
-- and the auth story is the part that needs deciding rather than assuming.
--
-- **Who a reviewer is.** Nobody. A client looking at a lookbook will not make an
-- account, and requiring one is how this feature goes unused. So access is a
-- capability, not an identity: a random token in a link, one row per link, and
-- the link can be revoked or given an expiry. The token is the credential, which
-- means it is treated like one — 32 bytes of randomness, never guessable, and
-- revocation is immediate because every read re-checks the row.
--
-- **What a token buys.** Reading one edition and adding comments to it. Not
-- listing editions, not editing, not seeing other editions' comments, and not
-- reading the author's analytics. The routes are the enforcement; RLS below is
-- the floor under them.
--
-- **What it does not do.** A reviewer cannot resolve a comment or delete one.
-- Resolving is a judgement about the work, and that is the author's.

CREATE TABLE IF NOT EXISTS public.book_review_links (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id    uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  -- The credential. Unique so a lookup is an index hit rather than a scan, and
  -- so a collision is a constraint violation rather than two editions sharing a
  -- link.
  token      text NOT NULL UNIQUE,
  label      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS book_review_links_book_idx
  ON public.book_review_links (book_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.book_comments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id        uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  -- Which link it came through, so revoking a link can be traced to the
  -- comments it produced. Null for a comment the author left themselves.
  review_link_id uuid REFERENCES public.book_review_links(id) ON DELETE SET NULL,
  page_number    int NOT NULL CHECK (page_number > 0),
  author_name    text NOT NULL CHECK (length(btrim(author_name)) BETWEEN 1 AND 60),
  body           text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
  resolved_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS book_comments_book_idx
  ON public.book_comments (book_id, page_number, created_at);

ALTER TABLE public.book_review_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_comments ENABLE ROW LEVEL SECURITY;

-- The author, and only the author. A reviewer never talks to PostgREST — they
-- go through routes holding a token, which run as service_role. There is
-- deliberately no anon policy here: an anon SELECT on `book_comments` would let
-- anyone who found one token read the comments on every edition.
DROP POLICY IF EXISTS review_links_owner ON public.book_review_links;
CREATE POLICY review_links_owner ON public.book_review_links
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_id AND b.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS comments_owner ON public.book_comments;
CREATE POLICY comments_owner ON public.book_comments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_id AND b.owner_id = auth.uid())
  );

/**
 * Resolve a review token to the edition it opens, or nothing.
 *
 * One statement, so "is this link live" cannot drift from "which edition does it
 * open". Revocation and expiry are checked here rather than in a caller that
 * might forget one of them.
 */
CREATE OR REPLACE FUNCTION public.review_link_book(p_token text)
RETURNS TABLE (link_id uuid, book_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.book_id
  FROM public.book_review_links l
  WHERE l.token = p_token
    AND l.revoked_at IS NULL
    AND (l.expires_at IS NULL OR l.expires_at > now());
$$;

REVOKE ALL ON FUNCTION public.review_link_book(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_link_book(text) TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_review_links TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_comments TO authenticated, service_role;

COMMENT ON TABLE public.book_review_links IS
  'A capability, not an identity: the token in the link is the whole credential. Revoke by setting revoked_at — review_link_book() re-checks it on every read.';
