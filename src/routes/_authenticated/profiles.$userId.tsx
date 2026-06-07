import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, MessageCircle, Send, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profiles/$userId")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Reader profile — ElectroLibrary" }] }),
});

type Comment = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
};

function ProfilePage() {
  const { userId } = useParams({ from: "/_authenticated/profiles/$userId" });
  const qc = useQueryClient();
  const [me, setMe] = useState<string | null>(null);
  const [body, setBody] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles").select("id,display_name,avatar_url,reading_goal").eq("id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: shelf = [] } = useQuery({
    queryKey: ["profile-shelf", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_books")
        .select("id,shelf,rating,updated_at,current_page,total_pages,book:books(title,author,cover_url)")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["profile-comments", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_comments").select("id,author_id,body,created_at")
        .eq("profile_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Comment[];
    },
  });

  const authorIds = Array.from(new Set(comments.map((c) => c.author_id)));
  const { data: authors = [] } = useQuery({
    queryKey: ["comment-authors", authorIds.join(",")],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,display_name").in("id", authorIds);
      return data ?? [];
    },
  });
  const authorName = (id: string) => authors.find((a) => a.id === id)?.display_name ?? "Reader";

  const postComment = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Sign in first");
      if (!body.trim()) throw new Error("Write something first");
      const { error } = await supabase
        .from("profile_comments").insert({ profile_id: userId, author_id: me, body: body.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      toast.success("Comment posted");
      qc.invalidateQueries({ queryKey: ["profile-comments", userId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const removeComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profile_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile-comments", userId] }),
  });

  const currentlyReading = shelf.find((s) => s.shelf === "currently-reading");

  return (
    <div className="min-h-screen bg-periwinkle font-rounded pb-24">
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-8">
        <Link to="/friends" className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 font-bold text-coral pop-shadow hover:bg-white">
          <ArrowLeft className="h-4 w-4" /> back
        </Link>

        <div className="mt-4 rounded-3xl bg-coral p-6 pop-shadow text-white tilt-l-sm">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-butter font-chunky text-2xl text-midnight pop-shadow">
              {(profile?.display_name ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="font-hand text-white/85">reader profile</p>
              <h1 className="font-chunky text-3xl text-stroke-white text-shadow-pop md:text-4xl">
                {profile?.display_name ?? "Anonymous reader"}
              </h1>
              {profile?.reading_goal && (
                <p className="mt-1 text-sm text-white/90">Goal: {profile.reading_goal} books this year</p>
              )}
            </div>
          </div>
        </div>

        {currentlyReading && (
          <div className="mt-6 rounded-3xl bg-white p-5 pop-shadow">
            <p className="font-hand text-sm text-coral">currently reading</p>
            <div className="mt-2 flex items-center gap-3">
              {(currentlyReading.book as any)?.cover_url ? (
                <img src={(currentlyReading.book as any).cover_url} className="h-20 w-14 rounded object-cover" alt="" />
              ) : (
                <div className="grid h-20 w-14 place-items-center rounded bg-periwinkle/30">
                  <BookOpen className="h-5 w-5" />
                </div>
              )}
              <div>
                <p className="font-chunky text-lg text-midnight">{(currentlyReading.book as any)?.title}</p>
                <p className="italic text-midnight/60">{(currentlyReading.book as any)?.author}</p>
                {currentlyReading.current_page && currentlyReading.total_pages && (
                  <p className="mt-1 text-xs text-midnight/65">
                    page {currentlyReading.current_page} / {currentlyReading.total_pages}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-3xl bg-white p-5 pop-shadow">
          <h2 className="font-chunky text-xl text-midnight">RECENT ACTIVITY</h2>
          <div className="mt-3 grid gap-2 max-h-72 overflow-y-auto pr-2">
            {shelf.length === 0 && <p className="font-hand italic text-midnight/60">Nothing on the shelf yet.</p>}
            {shelf.map((s) => {
              const b = s.book as any;
              return (
                <div key={s.id} className="flex items-center gap-3 rounded-2xl bg-periwinkle/15 p-2.5">
                  {b?.cover_url ? (
                    <img src={b.cover_url} className="h-12 w-9 rounded object-cover" alt="" />
                  ) : (
                    <div className="grid h-12 w-9 place-items-center rounded bg-white">
                      <BookOpen className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 font-bold text-midnight">{b?.title}</p>
                    <p className="text-xs italic text-midnight/60">{b?.author}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase text-coral">{s.shelf.replace("-", " ")}</p>
                    {s.rating && (
                      <p className="inline-flex items-center gap-0.5 text-xs">
                        {s.rating} <Star className="h-3 w-3 fill-coral text-coral" />
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 rounded-3xl bg-butter p-5 pop-shadow tilt-r-sm">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-midnight" />
            <h2 className="font-chunky text-xl text-midnight">WALL · {comments.length}</h2>
          </div>

          {me && me !== userId && (
            <div className="mt-3 flex gap-2">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Leave a friendly note…"
                className="flex-1 rounded-full border-2 border-midnight/15 bg-white px-4 py-2 text-sm outline-none focus:border-coral"
                onKeyDown={(e) => { if (e.key === "Enter") postComment.mutate(); }}
              />
              <button
                onClick={() => postComment.mutate()}
                disabled={postComment.isPending}
                className="inline-flex items-center gap-1 rounded-full bg-coral px-4 py-2 font-bold uppercase text-white pop-shadow hover:bg-coral-deep"
              >
                <Send className="h-4 w-4" /> Post
              </button>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {comments.length === 0 && <p className="font-hand italic text-midnight/60">No notes yet. Be the first!</p>}
            {comments.map((c) => (
              <div key={c.id} className="rounded-2xl bg-white p-3 pop-shadow">
                <div className="flex items-center justify-between">
                  <Link to="/profiles/$userId" params={{ userId: c.author_id }} className="font-bold text-midnight hover:text-coral">
                    {authorName(c.author_id)}
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-midnight/50">{new Date(c.created_at).toLocaleString()}</span>
                    {me === c.author_id && (
                      <button onClick={() => removeComment.mutate(c.id)} className="text-midnight/40 hover:text-coral">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-sm text-midnight">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
