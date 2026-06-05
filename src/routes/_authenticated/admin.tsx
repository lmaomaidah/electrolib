import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Users, BookOpen, MessageSquare, CheckCircle2, Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data, error } = await supabase
      .from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (error || !data) throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin — ElectroLibrary" }] }),
});

type Feedback = {
  id: string; user_id: string; message: string;
  rating: number | null; resolved: boolean; created_at: string;
};

function AdminPage() {
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [profiles, books, userBooks, feedback, clubs] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("books").select("id", { count: "exact", head: true }),
        supabase.from("user_books").select("id", { count: "exact", head: true }),
        supabase.from("feedback").select("rating,resolved"),
        supabase.from("clubs").select("id", { count: "exact", head: true }),
      ]);
      const ratings = (feedback.data ?? []).map((f) => f.rating).filter((r): r is number => !!r);
      const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      const open = (feedback.data ?? []).filter((f) => !f.resolved).length;
      return {
        users: profiles.count ?? 0,
        books: books.count ?? 0,
        shelfEntries: userBooks.count ?? 0,
        clubs: clubs.count ?? 0,
        feedback: feedback.data?.length ?? 0,
        openFeedback: open,
        avgRating: avg,
      };
    },
  });

  const { data: feedback } = useQuery({
    queryKey: ["all-feedback"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Feedback[];
    },
  });

  const toggleResolved = useMutation({
    mutationFn: async ({ id, resolved }: { id: string; resolved: boolean }) => {
      const { error } = await supabase.from("feedback").update({ resolved: !resolved }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-feedback"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="min-h-screen bg-periwinkle font-rounded">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        <div className="rounded-3xl bg-midnight p-6 pop-shadow text-white tilt-l-sm">
          <div className="flex items-center gap-2"><Shield className="h-5 w-5" />
            <p className="font-hand text-white/80">command center</p>
          </div>
          <h1 className="font-chunky text-4xl text-stroke-white text-shadow-pop md:text-5xl">ADMIN!</h1>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat icon={Users} label="Users" value={stats?.users ?? 0} color="bg-coral text-white" />
          <Stat icon={BookOpen} label="Books" value={stats?.books ?? 0} color="bg-butter text-midnight" />
          <Stat icon={BookOpen} label="Shelf entries" value={stats?.shelfEntries ?? 0} color="bg-white text-midnight" />
          <Stat icon={Users} label="Clubs" value={stats?.clubs ?? 0} color="bg-periwinkle text-midnight" />
          <Stat icon={MessageSquare} label="Feedback" value={stats?.feedback ?? 0} color="bg-white text-midnight" />
          <Stat icon={MessageSquare} label="Open" value={stats?.openFeedback ?? 0} color="bg-coral text-white" />
          <Stat icon={Star} label="Avg rating" value={(stats?.avgRating ?? 0).toFixed(2)} color="bg-butter text-midnight" />
        </div>

        <div className="mt-8 rounded-3xl bg-white p-6 pop-shadow">
          <h2 className="font-chunky text-xl text-midnight">All feedback</h2>
          <div className="mt-3 space-y-3">
            {feedback?.length === 0 && <p className="font-hand italic text-midnight/60">No feedback yet.</p>}
            {feedback?.map((f) => (
              <div key={f.id} className="rounded-2xl border-2 border-midnight/10 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {[1,2,3,4,5].map((n) => (
                      <Star key={n} className={`h-4 w-4 ${f.rating && n <= f.rating ? "fill-coral text-coral" : "text-midnight/20"}`} />
                    ))}
                    <span className="text-xs text-midnight/50">{new Date(f.created_at).toLocaleString()}</span>
                  </div>
                  <button
                    onClick={() => toggleResolved.mutate({ id: f.id, resolved: f.resolved })}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase ${
                      f.resolved ? "bg-mint/40 text-midnight" : "bg-coral text-white hover:bg-coral-deep"
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {f.resolved ? "Resolved" : "Mark resolved"}
                  </button>
                </div>
                <p className="mt-2 text-sm text-midnight">{f.message}</p>
                <p className="mt-1 font-mono text-[10px] text-midnight/40">user: {f.user_id}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: typeof Users; label: string; value: number | string; color: string }) {
  return (
    <div className={`rounded-2xl p-4 pop-shadow ${color}`}>
      <Icon className="h-5 w-5 opacity-80" />
      <p className="mt-2 font-chunky text-3xl">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wider opacity-80">{label}</p>
    </div>
  );
}
