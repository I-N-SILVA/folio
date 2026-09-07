-- "What did this look like last Tuesday."
--
-- `docs/editor-redesign-spec.md` §9.2. Undo is a session: `lib/editor-store.ts`
-- keeps a capped in-memory stack, and closing the tab is the end of it. The
-- manual stand-in has been "duplicate the edition", which costs a slot against
-- the plan's quota and produces a second thing in the library to be confused by.
--
-- Three decisions worth stating, because each has a wrong answer that looks
-- reasonable.
--
-- **When.** Not on every save: `PUT /api/books/[id]/pages` is the autosave and
-- runs every couple of seconds while somebody is typing. Not only on publish
-- either — the edits worth recovering are the ones made *before* deciding to
-- publish. So: automatic, time-bucketed. A save opens a new version only if the
-- newest one is older than the interval the caller passes, which makes a day of
-- work a readable handful of points rather than nine hundred.
--
-- **Where the throttle lives.** In one statement, in the database. Reading the
-- newest version and then deciding to insert is the same read-then-write that
-- made `redeemLicense` and the weekly digest fail (015, 016), and two autosaves
-- landing together would write two versions a second apart.
--
-- **What a version is.** The pages *and* the metadata — a theme change or a
-- retitle is exactly the kind of thing somebody wants back. `pages.blocks` and
-- `pages.hotspots` are `jsonb[]` rather than `jsonb`, so they are stored here as
-- proper JSON arrays and handed straight back to `replace_book_pages` on
-- restore.

CREATE TABLE IF NOT EXISTS public.book_versions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id    uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Null for an automatic one. A label is what makes a version findable later,
  -- so publishing and an explicit "save a version" both set one.
  label      text,
  pages      jsonb NOT NULL DEFAULT '[]'::jsonb,
  meta       jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS book_versions_book_created_idx
  ON public.book_versions (book_id, created_at DESC);

ALTER TABLE public.book_versions ENABLE ROW LEVEL SECURITY;

-- An edition's history is the author's alone: no public read policy here, and
-- deliberately not the one `books` carries for published editions. A draft
-- someone chose not to publish must not be readable through its own history.
DROP POLICY IF EXISTS book_versions_owner_read ON public.book_versions;
CREATE POLICY book_versions_owner_read ON public.book_versions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_id AND b.owner_id = auth.uid())
  );

-- Writes go through the functions below, which are the only things that can
-- keep the retention cap and the throttle honest.
DROP POLICY IF EXISTS book_versions_owner_write ON public.book_versions;

-- ─── Taking one ──────────────────────────────────────────────────────────────

/**
 * Snapshot an edition, but only if the newest version is older than p_min_gap.
 *
 * Returns the row when this call actually took one and nothing when the
 * previous version is still recent enough, so a caller can tell the difference
 * without a second query. An explicit label bypasses the throttle: a person
 * asking for a version, or a publish, is a checkpoint regardless of timing.
 */
CREATE OR REPLACE FUNCTION public.snapshot_book_version(
  p_book_id uuid,
  p_label   text DEFAULT NULL,
  p_min_gap interval DEFAULT interval '30 minutes',
  p_keep    int DEFAULT 20
)
RETURNS TABLE (id uuid, created_at timestamptz, label text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_label IS NULL AND EXISTS (
    SELECT 1 FROM public.book_versions v
    WHERE v.book_id = p_book_id AND v.created_at > now() - p_min_gap
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.book_versions (book_id, label, pages, meta)
  SELECT
    p_book_id,
    p_label,
    COALESCE(
      (
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'id', p.id,
                   'page_number', p.page_number,
                   'type', p.type,
                   'layout', p.layout,
                   'background', p.background,
                   'blocks', COALESCE(to_jsonb(p.blocks), '[]'::jsonb),
                   'hotspots', COALESCE(to_jsonb(p.hotspots), '[]'::jsonb)
                 )
                 ORDER BY p.page_number
               )
        FROM public.pages p
        WHERE p.book_id = p_book_id
      ),
      '[]'::jsonb
    ),
    jsonb_build_object(
      'title', b.title,
      'description', b.description,
      'theme', b.theme,
      'settings', b.settings
    )
  FROM public.books b
  WHERE b.id = p_book_id
  RETURNING public.book_versions.id INTO v_id;

  IF v_id IS NULL THEN
    RETURN; -- no such book
  END IF;

  -- Retention, in the same statement that created the surplus. An edition's
  -- history is a safety net, not an archive, and unbounded jsonb per autosave
  -- bucket is how a table becomes the largest thing in the database.
  DELETE FROM public.book_versions v
  WHERE v.book_id = p_book_id
    AND v.id NOT IN (
      SELECT v2.id FROM public.book_versions v2
      WHERE v2.book_id = p_book_id
      ORDER BY v2.created_at DESC
      LIMIT p_keep
    );

  RETURN QUERY
    SELECT v.id, v.created_at, v.label
    FROM public.book_versions v WHERE v.id = v_id;
END;
$$;

-- ─── Putting one back ────────────────────────────────────────────────────────

/**
 * Restore an edition to a version, after recording where it was.
 *
 * The snapshot taken first is the point: restoring is itself a destructive edit,
 * and somebody who restores the wrong one needs the same way back out. It is
 * labelled so it is findable, and it bypasses the throttle for that reason.
 *
 * Pages are replaced through `replace_book_pages`, which is transactional — the
 * delete-then-insert this would otherwise be is the exact shape 009 exists to
 * prevent.
 */
CREATE OR REPLACE FUNCTION public.restore_book_version(
  p_book_id    uuid,
  p_version_id uuid
)
RETURNS TABLE (restored_from timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.book_versions%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.book_versions
  WHERE id = p_version_id AND book_id = p_book_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  PERFORM public.snapshot_book_version(
    p_book_id,
    'Before restoring ' || to_char(v_row.created_at AT TIME ZONE 'UTC', 'Mon DD, HH24:MI') || ' UTC'
  );

  PERFORM public.replace_book_pages(p_book_id, v_row.pages);

  UPDATE public.books b
  SET title       = COALESCE(v_row.meta->>'title', b.title),
      description = v_row.meta->>'description',
      theme       = COALESCE(v_row.meta->'theme', b.theme),
      -- The slug is deliberately not restored: it is the public address, and
      -- rolling it back would break links that a rename filed in
      -- `book_slug_history` and left working.
      settings    = COALESCE(v_row.meta->'settings', b.settings),
      updated_at  = now()
  WHERE b.id = p_book_id;

  RETURN QUERY SELECT v_row.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.snapshot_book_version(uuid, text, interval, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_book_version(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.snapshot_book_version(uuid, text, interval, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_book_version(uuid, uuid) TO service_role;

GRANT SELECT ON public.book_versions TO authenticated, service_role;

COMMENT ON TABLE public.book_versions IS
  'Point-in-time snapshots of an edition. Written only by snapshot_book_version, which throttles automatic ones and enforces the retention cap.';
