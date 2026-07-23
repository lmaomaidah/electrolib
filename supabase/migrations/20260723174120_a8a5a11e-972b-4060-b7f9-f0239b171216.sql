
-- 1. Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated where not needed
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_admin_if_designated() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_post_score() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_shared_epub_path(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.find_or_create_book(text, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_club_mod(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_role(uuid, public.app_role, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

-- 2. epub_requests: require authenticated submitters tied to their own user_id
DROP POLICY IF EXISTS "Anyone can request" ON public.epub_requests;
CREATE POLICY "Authenticated users can request"
  ON public.epub_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. epubs storage: restrict reads to owner or files on the caller's own shelf
DROP POLICY IF EXISTS "Authenticated can read epubs" ON storage.objects;
CREATE POLICY "Users read own or shelved epubs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'epubs'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.user_books ub
        WHERE ub.user_id = auth.uid() AND ub.epub_path = name
      )
    )
  );

-- 4. profile_comments: restrict reads to involved parties, followers, or admins
DROP POLICY IF EXISTS "comments viewable by auth" ON public.profile_comments;
CREATE POLICY "Comments viewable by involved users"
  ON public.profile_comments
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = profile_id
    OR auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.follower_id = auth.uid() AND f.followee_id = profile_id
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );
