
-- Theme preference + currently reading pointer
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS currently_reading_id uuid;

-- Per-book epub file pointer + reader location
ALTER TABLE public.user_books
  ADD COLUMN IF NOT EXISTS epub_path text,
  ADD COLUMN IF NOT EXISTS reader_cfi text,
  ADD COLUMN IF NOT EXISTS reader_percent numeric;

-- Follows
CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  followee_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows visible to all authenticated"
  ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can follow"
  ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow"
  ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON public.follows(followee_id);

-- Activity feed: derived from user_books updates of friends
-- (read via a view scoped by RLS on user_books? user_books is private per user.
--  We add a permissive SELECT policy for followers.)
CREATE POLICY "Followers can view shelves"
  ON public.user_books FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.follows f
    WHERE f.follower_id = auth.uid() AND f.followee_id = user_books.user_id
  ));

-- Storage bucket for epub files (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('epubs', 'epubs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users read own epubs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'epubs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own epubs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'epubs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own epubs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'epubs' AND auth.uid()::text = (storage.foldername(name))[1]);
