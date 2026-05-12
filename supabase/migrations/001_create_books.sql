-- Books table
CREATE TABLE IF NOT EXISTS public.books (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,
  title       text NOT NULL,
  description text,
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme       jsonb NOT NULL DEFAULT '{"preset":"ivory"}'::jsonb,
  settings    jsonb NOT NULL DEFAULT '{"published":false,"unlisted":false}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER books_updated_at
  BEFORE UPDATE ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

-- Owner can do everything
CREATE POLICY "owner_all" ON public.books
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Public can read published books
CREATE POLICY "public_read_published" ON public.books
  FOR SELECT
  USING ((settings->>'published')::boolean = true);
