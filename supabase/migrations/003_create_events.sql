-- Events table (append-only analytics)
CREATE TABLE IF NOT EXISTS public.events (
  id          bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  book_id     uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  session_id  text NOT NULL,
  event_type  text NOT NULL CHECK (event_type IN (
    'book_open','page_view','page_flip','hotspot_click',
    'modal_open','modal_close','video_play','video_complete',
    'audio_play','cta_click','book_complete'
  )),
  page_number int,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- GIN index for fast per-book dashboard queries
CREATE INDEX events_book_type ON public.events (book_id, event_type);
-- B-tree for book_id filtering (most common query pattern)
CREATE INDEX events_book_id ON public.events (book_id, created_at DESC);
-- Partial index for page-level queries
CREATE INDEX events_page_number ON public.events (book_id, page_number)
  WHERE page_number IS NOT NULL;

-- RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can insert events
CREATE POLICY "anon_insert" ON public.events
  FOR INSERT
  WITH CHECK (true);

-- Only book owner can read their events
CREATE POLICY "owner_read" ON public.events
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.books WHERE books.id = events.book_id AND books.owner_id = auth.uid()
  ));
