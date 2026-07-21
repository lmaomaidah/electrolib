
CREATE TABLE public.epub_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_name text,
  requester_email text,
  title text NOT NULL,
  author text,
  message text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.epub_requests TO authenticated;
GRANT SELECT, INSERT ON public.epub_requests TO anon;
GRANT ALL ON public.epub_requests TO service_role;
ALTER TABLE public.epub_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can request" ON public.epub_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Users see own requests" ON public.epub_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins see all requests" ON public.epub_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update requests" ON public.epub_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER set_epub_requests_updated_at BEFORE UPDATE ON public.epub_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.reading_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  book_id uuid REFERENCES public.books(id) ON DELETE SET NULL,
  pages int,
  minutes int,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX reading_log_user_date_book_uidx ON public.reading_log(user_id, log_date, COALESCE(book_id, '00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reading_log TO authenticated;
GRANT ALL ON public.reading_log TO service_role;
ALTER TABLE public.reading_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own log" ON public.reading_log FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Followers view log" ON public.reading_log FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = auth.uid() AND f.followee_id = reading_log.user_id)
);
CREATE TRIGGER set_reading_log_updated_at BEFORE UPDATE ON public.reading_log FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX reading_log_user_date_idx ON public.reading_log(user_id, log_date DESC);

CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  title text NOT NULL,
  book_id uuid REFERENCES public.books(id) ON DELETE SET NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own events" ON public.calendar_events FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.club_members ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member';
INSERT INTO public.club_members (club_id, user_id, role)
SELECT c.id, c.owner_id, 'moderator'
FROM public.clubs c
WHERE NOT EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = c.id AND m.user_id = c.owner_id)
ON CONFLICT DO NOTHING;
UPDATE public.club_members m SET role = 'moderator'
  FROM public.clubs c
  WHERE c.id = m.club_id AND c.owner_id = m.user_id AND m.role <> 'moderator';

CREATE POLICY "Mods manage memberships update" ON public.club_members FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_members.club_id AND c.owner_id = auth.uid())
  );
CREATE POLICY "Mods can kick" ON public.club_members FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_members.club_id AND c.owner_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.is_club_mod(_club_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = _club_id AND c.owner_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = _club_id AND m.user_id = _user_id AND m.role = 'moderator');
$$;

CREATE TABLE public.club_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  book_id uuid REFERENCES public.books(id) ON DELETE SET NULL,
  pinned boolean NOT NULL DEFAULT false,
  score int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_posts TO authenticated;
GRANT ALL ON public.club_posts TO service_role;
ALTER TABLE public.club_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view posts" ON public.club_posts FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = club_posts.club_id AND m.user_id = auth.uid())
);
CREATE POLICY "Members create posts" ON public.club_posts FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = club_posts.club_id AND m.user_id = auth.uid())
);
CREATE POLICY "Author or mod update post" ON public.club_posts FOR UPDATE TO authenticated USING (
  auth.uid() = user_id OR public.is_club_mod(club_id, auth.uid())
);
CREATE POLICY "Author or mod delete post" ON public.club_posts FOR DELETE TO authenticated USING (
  auth.uid() = user_id OR public.is_club_mod(club_id, auth.uid())
);
CREATE TRIGGER set_club_posts_updated_at BEFORE UPDATE ON public.club_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX club_posts_club_created_idx ON public.club_posts(club_id, created_at DESC);

CREATE TABLE public.club_post_votes (
  post_id uuid NOT NULL REFERENCES public.club_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_post_votes TO authenticated;
GRANT ALL ON public.club_post_votes TO service_role;
ALTER TABLE public.club_post_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone auth can view votes" ON public.club_post_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users manage own vote" ON public.club_post_votes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.recompute_post_score()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _post uuid;
BEGIN
  _post := COALESCE(NEW.post_id, OLD.post_id);
  UPDATE public.club_posts SET score = COALESCE((SELECT SUM(value) FROM public.club_post_votes WHERE post_id = _post), 0)
    WHERE id = _post;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_recompute_post_score AFTER INSERT OR UPDATE OR DELETE ON public.club_post_votes
  FOR EACH ROW EXECUTE FUNCTION public.recompute_post_score();

CREATE TABLE public.club_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.club_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.club_post_comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_post_comments TO authenticated;
GRANT ALL ON public.club_post_comments TO service_role;
ALTER TABLE public.club_post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view comments" ON public.club_post_comments FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.club_posts p
    JOIN public.club_members m ON m.club_id = p.club_id
    WHERE p.id = club_post_comments.post_id AND m.user_id = auth.uid()
  )
);
CREATE POLICY "Members comment" ON public.club_post_comments FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.club_posts p
    JOIN public.club_members m ON m.club_id = p.club_id
    WHERE p.id = club_post_comments.post_id AND m.user_id = auth.uid()
  )
);
CREATE POLICY "Author or mod delete comment" ON public.club_post_comments FOR DELETE TO authenticated USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.club_posts p WHERE p.id = club_post_comments.post_id AND public.is_club_mod(p.club_id, auth.uid())
  )
);
CREATE INDEX club_post_comments_post_idx ON public.club_post_comments(post_id, created_at);

CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM auth.users WHERE id = _user_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_role(_user_id uuid, _role app_role, _grant boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, app_role, boolean) TO authenticated;

ALTER TABLE public.books ADD COLUMN IF NOT EXISTS description text;
