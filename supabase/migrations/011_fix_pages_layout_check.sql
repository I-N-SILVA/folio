-- The pages CHECK constraint has been behind the application since 002.
--
-- It allows ('hero', 'split', 'text', 'blank'). The editor's layout dropdown has
-- shipped a fifth option the whole time — "Grid (2x2 Multi-Card Display)" in
-- PageSettingsForm — and `PageRenderer` has a `grid` branch to draw it. Choosing
-- it produced a check_violation on save, which the editor surfaced as "Could not
-- save these pages". Nothing in the message pointed at the layout, so the only
-- way to recover was to guess.
--
-- 'canvas' is the sixth: a per-page free-composition mode where each block
-- carries a `frame`. Without this migration the mode saves nothing at all.
--
-- This is the same failure as 008, one table over: a Postgres enum drifting
-- behind the app's. The test in lib/schema-db-drift.test.ts now compares the two
-- so there is not a third.

ALTER TABLE public.pages DROP CONSTRAINT IF EXISTS pages_layout_check;

ALTER TABLE public.pages
  ADD CONSTRAINT pages_layout_check CHECK (
    layout IN ('hero', 'split', 'text', 'grid', 'blank', 'canvas')
  );
