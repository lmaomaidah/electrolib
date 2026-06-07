import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Users, BookOpen, MessageSquare, CheckCircle2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, CartesianGrid,
} from "recharts";

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

const COLORS = ["#ff6b6b", "#fcd34d", "#a5b4fc", "#86efac", "#fda4af", "#c4b5fd"];

function AdminPage() {
  const qc = useQueryClient();
  const [chartType, setChartType] = useState<"bar" | "pie" | "line">("bar");
  const [metric, setMetric] = useState<"shelves" | "ratings" | "signups">("shelves");

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

  const { data: allShelves = [] } = useQuery({
    queryKey: ["admin-shelves"],
    queryFn: async () => {
      const { data } = await supabase.from("user_books").select("shelf,rating,updated_at,created_at");
      return data ?? [];
    },
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["admin-profiles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,display_name,created_at").order("created_at", { ascending: false });
      return data ?? [];
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

  const chartData = useMemo(() => {
    if (metric === "shelves") {
      const counts: Record<string, number> = {};
      allShelves.forEach((s: any) => { counts[s.shelf] = (counts[s.shelf] ?? 0) + 1; });
      return Object.entries(counts).map(([name, value]) => ({ name: name.replace("-", " "), value }));
    }
    if (metric === "ratings") {
      const counts: Record<string, number> = { "1★": 0, "2★": 0, "3★": 0, "4★": 0, "5★": 0 };
      allShelves.forEach((s: any) => { if (s.rating) counts[`${s.rating}★`] += 1; });
      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }
    // signups by day (last 14)
    const days: Record<string, number> = {};
    const now = Date.now();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * 86400000).toISOString().slice(5, 10);
      days[d] = 0;
    }
    allProfiles.forEach((p: any) => {
      const key = p.created_at?.slice(5, 10);
      if (key in days) days[key] += 1;
    });
    return Object.entries(days).map(([name, value]) => ({ name, value }));
  }, [metric, allShelves, allProfiles]);

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

  const removeBook = useMutation({
    mutationFn: async (_id: string) => {
      // books table has no delete RLS — best-effort. Remove user_books references instead would need admin.
      const { error } = await supabase.from("user_books").delete().eq("book_id", _id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cleared all shelf references for that book");
      qc.invalidateQueries({ queryKey: ["admin-shelves"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="min-h-screen bg-periwinkle font-rounded pb-24">
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

        {/* Interactive chart panel */}
        <div className="mt-8 rounded-3xl bg-white p-6 pop-shadow">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-chunky text-xl text-midnight">READING ANALYTICS</h2>
            <div className="flex flex-wrap gap-2">
              <Toggle items={[
                { v: "shelves", l: "Shelves" },
                { v: "ratings", l: "Ratings" },
                { v: "signups", l: "Signups (14d)" },
              ]} value={metric} onChange={(v) => setMetric(v as any)} />
              <Toggle items={[
                { v: "bar", l: "Bar" },
                { v: "pie", l: "Pie" },
                { v: "line", l: "Line" },
              ]} value={chartType} onChange={(v) => setChartType(v as any)} />
            </div>
          </div>

          <div className="mt-5 h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "bar" ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  <XAxis dataKey="name" stroke="#1a1a3a" fontSize={12} />
                  <YAxis stroke="#1a1a3a" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "2px solid #1a1a3a" }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              ) : chartType === "pie" ? (
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={110} label>
                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "2px solid #1a1a3a" }} />
                </PieChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  <XAxis dataKey="name" stroke="#1a1a3a" fontSize={12} />
                  <YAxis stroke="#1a1a3a" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "2px solid #1a1a3a" }} />
                  <Line type="monotone" dataKey="value" stroke="#ff6b6b" strokeWidth={3} dot={{ fill: "#ff6b6b" }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Users list */}
        <div className="mt-6 rounded-3xl bg-white p-6 pop-shadow">
          <h2 className="font-chunky text-xl text-midnight">USERS ({allProfiles.length})</h2>
          <div className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-2">
            {allProfiles.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-midnight/10 px-3 py-2 text-sm">
                <span className="font-bold text-midnight">{p.display_name ?? "—"}</span>
                <span className="font-mono text-[10px] text-midnight/50">{p.id.slice(0, 8)}…</span>
                <span className="text-xs text-midnight/60">{new Date(p.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Feedback */}
        <div className="mt-6 rounded-3xl bg-white p-6 pop-shadow">
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

function Toggle({ items, value, onChange }: { items: { v: string; l: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-full bg-periwinkle/20 p-1">
      {items.map((it) => (
        <button
          key={it.v}
          onClick={() => onChange(it.v)}
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide transition ${
            value === it.v ? "bg-coral text-white pop-shadow" : "text-midnight hover:bg-white"
          }`}
        >
          {it.l}
        </button>
      ))}
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
