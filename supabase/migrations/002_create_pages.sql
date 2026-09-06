-- Pages table
CREATE TABLE IF NOT EXISTS public.pages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id     uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  page_number int NOT NULL,
  type        text NOT NULL CHECK (type IN ('cover', 'content', 'back')),
  layout      text NOT NULL CHECK (layout IN ('hero', 'split', 'text', 'blank')),
  background  jsonb,
  blocks      jsonb[] NOT NULL DEFAULT '{}',
  hotspots    jsonb[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (book_id, page_number)
);

DROP TRIGGER IF EXISTS pages_updated_at ON public.pages;
CREATE TRIGGER pages_updated_at
  BEFORE UPDATE ON public.pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Index for ordered page fetching
CREATE INDEX IF NOT EXISTS pages_book_order ON public.pages (book_id, page_number);

-- RLS
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

-- Owner inherits access via books
DROP POLICY IF EXISTS "owner_all" ON public.pages;
CREATE POLICY "owner_all" ON public.pages
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.books WHERE books.id = pages.book_id AND books.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.books WHERE books.id = pages.book_id AND books.owner_id = auth.uid()
  ));

-- Public can read pages of published books
DROP POLICY IF EXISTS "public_read_published" ON public.pages;
CREATE POLICY "public_read_published" ON public.pages
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id = pages.book_id AND (books.settings->>'published')::boolean = true
  ));
