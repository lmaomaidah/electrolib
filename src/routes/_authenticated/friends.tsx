import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, UserMinus, BookOpen, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/friends")({
  component: FriendsPage,
  head: () => ({ meta: [{ title: "Friends — reader circle" }] }),
});

type Profile = { id: string; display_name: string | null; avatar_url: string | null };

function FriendsPage() {
  const qc = useQueryClient();
  const [me, setMe] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null)); }, []);

  const { data: people = [] } = useQuery({
    queryKey: ["all-profiles", q],
    enabled: !!me,
    queryFn: async () => {
      let query = supabase.from("profiles").select("id,display_name,avatar_url").neq("id", me!).limit(40);
      if (q.trim()) query = query.ilike("display_name", `%${q.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const { data: follows = [] } = useQuery({
    queryKey: ["my-follows", me],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase.from("follows").select("followee_id").eq("follower_id", me!);
      if (error) throw error;
      return (data ?? []).map((r) => r.followee_id);
    },
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["friend-activity", follows.join(",")],
    enabled: follows.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_books")
        .select("id,shelf,updated_at,user_id,current_page,total_pages,book:books(title,author,cover_url)")
        .in("user_id", follows)
        .order("updated_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const follow = useMutation({
    mutationFn: async (followeeId: string) => {
      const { error } = await supabase.from("follows").insert({ follower_id: me, followee_id: followeeId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Following"); qc.invalidateQueries({ queryKey: ["my-follows"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not follow"),
  });

  const unfollow = useMutation({
    mutationFn: async (followeeId: string) => {
      const { error } = await supabase.from("follows").delete().eq("follower_id", me).eq("followee_id", followeeId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Unfollowed"); qc.invalidateQueries({ queryKey: ["my-follows"] }); },
  });

  const profileById = (id: string) => people.find((p) => p.id === id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <h1 className="font-display text-4xl text-walnut">Reader friends</h1>
      <p className="font-hand text-mahogany">whose shelf is glowing tonight?</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-2xl text-ink">Find readers</h2>
          <div className="mt-3 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
            <Search className="h-4 w-4 text-walnut/60" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name…" className="flex-1 bg-transparent font-serif outline-none" />
          </div>
          <div className="mt-4 space-y-2">
            {people.map((p) => {
              const isFollowing = follows.includes(p.id);
              return (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-parchment font-display text-walnut">
                      {(p.display_name ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                    <span className="font-serif text-ink">{p.display_name ?? "Anonymous reader"}</span>
                  </div>
                  <button
                    onClick={() => (isFollowing ? unfollow.mutate(p.id) : follow.mutate(p.id))}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-serif text-xs ${
                      isFollowing ? "bg-parchment text-walnut" : "bg-mahogany text-aged hover:bg-walnut"
                    }`}
                  >
                    {isFollowing ? <UserMinus className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                    {isFollowing ? "Following" : "Follow"}
                  </button>
                </div>
              );
            })}
            {people.length === 0 && <p className="font-serif italic text-muted-foreground">No other readers yet.</p>}
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">Activity</h2>
          <div className="mt-3 space-y-3">
            {activity.length === 0 && (
              <p className="font-serif italic text-muted-foreground">
                Follow someone to see what they're reading.
              </p>
            )}
            {activity.map((a) => {
              const book = a.book as { title: string; author: string | null; cover_url: string | null } | null;
              const p = profileById(a.user_id);
              return (
                <article key={a.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                  {book?.cover_url ? (
                    <img src={book.cover_url} alt="" className="h-16 w-12 rounded object-cover" />
                  ) : (
                    <div className="flex h-16 w-12 items-center justify-center rounded bg-parchment">
                      <BookOpen className="h-5 w-5 text-walnut/50" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-hand text-sm text-mahogany">
                      {p?.display_name ?? "A reader"} · {a.shelf.replace("-", " ")}
                    </p>
                    <p className="line-clamp-1 font-display text-base text-ink">{book?.title}</p>
                    <p className="line-clamp-1 font-serif text-xs italic text-muted-foreground">{book?.author}</p>
                    {a.current_page && a.total_pages && (
                      <p className="mt-1 font-serif text-xs text-walnut/70">page {a.current_page} / {a.total_pages}</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
