
-- Allow any authenticated user to READ epubs (shared library), keep upload/delete owner-only
DROP POLICY IF EXISTS "Users read own epubs" ON storage.objects;
CREATE POLICY "Authenticated can read epubs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'epubs');

-- Security-definer helper: find a shared epub_path for a given book_id
CREATE OR REPLACE FUNCTION public.get_shared_epub_path(_book_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT epub_path
  FROM public.user_books
  WHERE book_id = _book_id AND epub_path IS NOT NULL
  ORDER BY updated_at DESC
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_epub_path(uuid) TO authenticated;

-- Find or create a canonical book row by title + author (case-insensitive)
CREATE OR REPLACE FUNCTION public.find_or_create_book(
  _title text, _author text, _cover_url text, _isbn text, _genre text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE existing uuid;
BEGIN
  SELECT id INTO existing FROM public.books
  WHERE lower(title) = lower(_title)
    AND lower(coalesce(author, '')) = lower(coalesce(_author, ''))
  LIMIT 1;
  IF existing IS NOT NULL THEN RETURN existing; END IF;
  INSERT INTO public.books (title, author, cover_url, isbn, genre)
  VALUES (_title, _author, _cover_url, _isbn, _genre)
  RETURNING id INTO existing;
  RETURN existing;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_or_create_book(text,text,text,text,text) TO authenticated;
