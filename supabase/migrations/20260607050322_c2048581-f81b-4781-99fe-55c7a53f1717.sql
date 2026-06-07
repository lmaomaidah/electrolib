
-- Profile comments
CREATE TABLE public.profile_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_comments TO authenticated;
GRANT ALL ON public.profile_comments TO service_role;
ALTER TABLE public.profile_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments viewable by auth" ON public.profile_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "users post comments" ON public.profile_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "users edit own comments" ON public.profile_comments FOR UPDATE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "users delete own comments" ON public.profile_comments FOR DELETE TO authenticated USING (auth.uid() = author_id OR has_role(auth.uid(), 'admin'::app_role));

-- Activity events
CREATE TABLE public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  book_id uuid,
  kind text NOT NULL,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.activity_events TO authenticated;
GRANT ALL ON public.activity_events TO service_role;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity viewable by auth" ON public.activity_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "users log own activity" ON public.activity_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own activity" ON public.activity_events FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_activity_user_created ON public.activity_events(user_id, created_at DESC);
CREATE INDEX idx_comments_profile_created ON public.profile_comments(profile_id, created_at DESC);
