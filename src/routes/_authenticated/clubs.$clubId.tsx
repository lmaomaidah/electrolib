import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { ArrowBigUp, ArrowBigDown, MessageSquare, Pin, Trash2, Shield, ArrowLeft, Send, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clubs/$clubId")({
  component: ClubPage,
  head: () => ({ meta: [{ title: "Club — ElectroLibrary" }] }),
});

type Sort = "hot" | "new" | "top";

function ClubPage() {
  const { clubId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [me, setMe] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("hot");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [showCompose, setShowCompose] = useState(false);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null)); }, []);

  const { data: club } = useQuery({
    queryKey: ["club", clubId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clubs").select("*").eq("id", clubId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["club-members", clubId],
    queryFn: async () => {
      const { data } = await supabase.from("club_members")
        .select("user_id,role,profiles:profiles!inner(id,display_name)")
        .eq("club_id", clubId);
      return data ?? [];
    },
  });

  const myMembership = members.find((m: any) => m.user_id === me);
  const isMember = !!myMembership;
  const isMod = myMembership?.role === "moderator" || club?.owner_id === me;

  const { data: myAdmin } = useQuery({
    queryKey: ["me-admin", me],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", me!).eq("role", "admin").maybeSingle();
      return !!data;
    },
  });
  const canModerate = isMod || myAdmin;

  const { data: posts = [] } = useQuery({
    queryKey: ["club-posts", clubId, sort],
    enabled: isMember,
    queryFn: async () => {
      let q = supabase.from("club_posts")
        .select("*,author:profiles!club_posts_user_id_fkey(display_name)")
        .eq("club_id", clubId);
      if (sort === "new") q = q.order("pinned", { ascending: false }).order("created_at", { ascending: false });
      else if (sort === "top") q = q.order("pinned", { ascending: false }).order("score", { ascending: false });
      else q = q.order("pinned", { ascending: false }).order("score", { ascending: false }).order("created_at", { ascending: false });
      const { data, error } = await q.limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: myVotes = {} } = useQuery({
    queryKey: ["club-my-votes", clubId, me],
    enabled: !!me && posts.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("club_post_votes")
        .select("post_id,value")
        .eq("user_id", me!)
        .in("post_id", posts.map((p: any) => p.id));
      const m: Record<string, number> = {};
      (data ?? []).forEach((v: any) => { m[v.post_id] = v.value; });
      return m;
    },
  });

  const createPost = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Sign in");
      if (!title.trim()) throw new Error("Title required");
      const { error } = await supabase.from("club_posts").insert({
        club_id: clubId, user_id: me, title: title.slice(0, 200), body: body.slice(0, 5000) || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Posted!"); setTitle(""); setBody(""); setShowCompose(false); qc.invalidateQueries({ queryKey: ["club-posts"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const vote = useMutation({
    mutationFn: async ({ postId, value }: { postId: string; value: number }) => {
      if (!me) throw new Error("Sign in");
      const current = myVotes[postId];
      if (current === value) {
        await supabase.from("club_post_votes").delete().eq("post_id", postId).eq("user_id", me);
      } else {
        await supabase.from("club_post_votes").upsert({ post_id: postId, user_id: me, value });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["club-posts"] }); qc.invalidateQueries({ queryKey: ["club-my-votes"] }); },
  });

  const togglePin = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { error } = await supabase.from("club_posts").update({ pinned: !pinned }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["club-posts"] }),
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("club_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Post removed"); qc.invalidateQueries({ queryKey: ["club-posts"] }); },
  });

  const promote = useMutation({
    mutationFn: async ({ userId, makeMod }: { userId: string; makeMod: boolean }) => {
      const { error } = await supabase.from("club_members")
        .update({ role: makeMod ? "moderator" : "member" })
        .eq("club_id", clubId).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["club-members"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const join = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Sign in");
      const { error } = await supabase.from("club_members").insert({ club_id: clubId, user_id: me });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["club-members"] }),
  });

  if (!club) return <div className="p-10 font-hand text-coral">Loading club…</div>;

  return (
    <div className="min-h-screen bg-periwinkle font-rounded pb-24">
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        <button onClick={() => navigate({ to: "/clubs" })} className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-midnight/70 hover:text-coral">
          <ArrowLeft className="h-4 w-4" /> All clubs
        </button>

        {/* Header */}
        <div className="rounded-3xl bg-coral p-6 pop-shadow text-white tilt-l-sm">
          <p className="font-hand text-white/80">a reading community</p>
          <h1 className="font-chunky text-4xl text-stroke-white text-shadow-pop md:text-5xl">r/{club.name}</h1>
          {club.description && <p className="mt-2 text-white/90">{club.description}</p>}
          <p className="mt-2 flex items-center gap-1 text-xs font-bold uppercase text-white/70"><Users className="h-3.5 w-3.5" /> {members.length} member{members.length === 1 ? "" : "s"}</p>
        </div>

        {!isMember && (
          <div className="mt-6 rounded-3xl bg-butter p-5 pop-shadow text-midnight">
            <p className="font-bold">Join r/{club.name} to see posts and comment.</p>
            <button onClick={() => join.mutate()} className="mt-3 rounded-full bg-coral px-5 py-2 text-sm font-bold uppercase text-white hover:bg-coral-deep">Join club</button>
          </div>
        )}

        {isMember && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem]">
            {/* Feed */}
            <div>
              {/* Compose */}
              <div className="rounded-3xl bg-white p-4 pop-shadow">
                {!showCompose ? (
                  <button onClick={() => setShowCompose(true)} className="w-full rounded-full border-2 border-dashed border-periwinkle/50 bg-periwinkle/10 px-4 py-3 text-left text-sm text-midnight/60 hover:border-coral hover:text-coral">
                    Share something with r/{club.name}…
                  </button>
                ) : (
                  <div>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Post title"
                      className="w-full rounded-2xl border-2 border-periwinkle/40 bg-white px-4 py-2 font-bold outline-none focus:border-coral" />
                    <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={4} placeholder="What's on your mind?"
                      className="mt-2 w-full rounded-2xl border-2 border-periwinkle/40 bg-white px-4 py-2 outline-none focus:border-coral" />
                    <div className="mt-2 flex justify-end gap-2">
                      <button onClick={() => setShowCompose(false)} className="rounded-full border-2 border-midnight/15 bg-white px-4 py-1.5 text-sm font-bold">Cancel</button>
                      <button onClick={() => createPost.mutate()} disabled={createPost.isPending}
                        className="inline-flex items-center gap-1 rounded-full bg-coral px-4 py-1.5 text-sm font-bold text-white hover:bg-coral-deep disabled:opacity-60">
                        <Send className="h-3.5 w-3.5" /> Post
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Sort */}
              <div className="mt-4 flex gap-2">
                {(["hot", "new", "top"] as Sort[]).map((s) => (
                  <button key={s} onClick={() => setSort(s)}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase ${sort === s ? "bg-coral text-white pop-shadow" : "bg-white text-midnight hover:bg-periwinkle/30"}`}>
                    {s}
                  </button>
                ))}
              </div>

              {/* Posts */}
              <div className="mt-4 space-y-3">
                {posts.length === 0 && <p className="rounded-2xl bg-white p-6 text-center font-hand text-midnight/60 pop-shadow">Be the first to post!</p>}
                {posts.map((p: any) => (
                  <PostCard key={p.id} post={p} myVote={myVotes[p.id] ?? 0}
                    canModerate={canModerate} isAuthor={p.user_id === me}
                    onVote={(v) => vote.mutate({ postId: p.id, value: v })}
                    onPin={() => togglePin.mutate({ id: p.id, pinned: p.pinned })}
                    onDelete={() => { if (confirm("Delete this post?")) deletePost.mutate(p.id); }}
                    me={me}
                  />
                ))}
              </div>
            </div>

            {/* Sidebar: members */}
            <aside className="rounded-3xl bg-white p-5 pop-shadow h-fit">
              <h3 className="font-chunky text-lg text-midnight">MEMBERS</h3>
              <div className="mt-3 max-h-[28rem] space-y-1 overflow-y-auto pr-2">
                {members.map((m: any) => {
                  const isCreator = club.owner_id === m.user_id;
                  const isThisMod = m.role === "moderator";
                  return (
                    <div key={m.user_id} className="flex items-center justify-between gap-2 rounded-xl bg-periwinkle/10 px-3 py-2 text-sm">
                      <Link to="/profiles/$userId" params={{ userId: m.user_id }} className="min-w-0 flex-1 truncate font-bold text-midnight hover:underline">
                        {m.profiles?.display_name ?? "Reader"}
                      </Link>
                      {isCreator && <span className="rounded-full bg-butter px-2 py-0.5 text-[9px] font-bold uppercase text-midnight">creator</span>}
                      {isThisMod && !isCreator && <Shield className="h-3.5 w-3.5 text-coral" />}
                      {canModerate && !isCreator && m.user_id !== me && (
                        <button onClick={() => promote.mutate({ userId: m.user_id, makeMod: !isThisMod })}
                          className="text-[10px] font-bold text-coral hover:underline">
                          {isThisMod ? "demote" : "make mod"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function PostCard({ post, myVote, canModerate, isAuthor, onVote, onPin, onDelete, me }: {
  post: any; myVote: number; canModerate: boolean; isAuthor: boolean;
  onVote: (v: number) => void; onPin: () => void; onDelete: () => void; me: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`rounded-2xl bg-white p-4 pop-shadow ${post.pinned ? "border-2 border-butter" : ""}`}>
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-0.5">
          <button onClick={() => onVote(1)} className={`p-0.5 ${myVote === 1 ? "text-coral" : "text-midnight/40 hover:text-coral"}`}>
            <ArrowBigUp className="h-5 w-5" fill={myVote === 1 ? "currentColor" : "none"} />
          </button>
          <span className="font-chunky text-sm text-midnight">{post.score}</span>
          <button onClick={() => onVote(-1)} className={`p-0.5 ${myVote === -1 ? "text-periwinkle-deep" : "text-midnight/40 hover:text-periwinkle-deep"}`}>
            <ArrowBigDown className="h-5 w-5" fill={myVote === -1 ? "currentColor" : "none"} />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] text-midnight/60">
            {post.pinned && <span className="inline-flex items-center gap-0.5 rounded-full bg-butter px-2 py-0.5 font-bold uppercase text-midnight"><Pin className="h-2.5 w-2.5" /> pinned</span>}
            <span>posted by <Link to="/profiles/$userId" params={{ userId: post.user_id }} className="font-bold text-coral hover:underline">{post.author?.display_name ?? "reader"}</Link></span>
            <span>· {timeAgo(post.created_at)}</span>
          </div>
          <h3 className="mt-1 font-chunky text-lg text-midnight">{post.title}</h3>
          {post.body && <p className="mt-1 whitespace-pre-wrap text-sm text-midnight/80">{post.body}</p>}
          <div className="mt-2 flex items-center gap-3 text-xs">
            <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 font-bold text-midnight/60 hover:text-coral">
              <MessageSquare className="h-3.5 w-3.5" /> Comments
            </button>
            {canModerate && (
              <button onClick={onPin} className="inline-flex items-center gap-1 font-bold text-midnight/60 hover:text-coral">
                <Pin className="h-3.5 w-3.5" /> {post.pinned ? "Unpin" : "Pin"}
              </button>
            )}
            {(canModerate || isAuthor) && (
              <button onClick={onDelete} className="inline-flex items-center gap-1 font-bold text-coral hover:text-coral-deep">
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </div>
          {open && <Comments postId={post.id} me={me} canModerate={canModerate} />}
        </div>
      </div>
    </article>
  );
}

function Comments({ postId, me, canModerate }: { postId: string; me: string | null; canModerate: boolean }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const { data: comments = [] } = useQuery({
    queryKey: ["post-comments", postId],
    queryFn: async () => {
      const { data } = await supabase.from("club_post_comments")
        .select("*,author:profiles!club_post_comments_user_id_fkey(display_name)")
        .eq("post_id", postId).order("created_at");
      return data ?? [];
    },
  });
  const add = useMutation({
    mutationFn: async () => {
      if (!me || !text.trim()) return;
      const { error } = await supabase.from("club_post_comments").insert({ post_id: postId, user_id: me, body: text.slice(0, 2000) });
      if (error) throw error;
    },
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["post-comments", postId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("club_post_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["post-comments", postId] }),
  });
  return (
    <div className="mt-3 border-l-2 border-periwinkle/40 pl-3">
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply…"
          className="flex-1 rounded-full border-2 border-periwinkle/40 bg-white px-3 py-1.5 text-sm outline-none focus:border-coral" />
        <button onClick={() => add.mutate()} className="rounded-full bg-coral px-4 text-xs font-bold text-white hover:bg-coral-deep">Send</button>
      </div>
      <div className="mt-2 space-y-2">
        {comments.map((c: any) => (
          <div key={c.id} className="rounded-xl bg-periwinkle/10 p-2 text-sm">
            <div className="flex items-center justify-between gap-2 text-[10px] text-midnight/60">
              <span><span className="font-bold text-coral">{c.author?.display_name ?? "reader"}</span> · {timeAgo(c.created_at)}</span>
              {(canModerate || c.user_id === me) && (
                <button onClick={() => del.mutate(c.id)} className="text-coral hover:underline">delete</button>
              )}
            </div>
            <p className="mt-0.5 whitespace-pre-wrap text-midnight">{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  if (d < 604800) return `${Math.floor(d / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
