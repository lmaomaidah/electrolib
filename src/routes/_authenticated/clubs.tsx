import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Plus, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clubs")({
  component: ClubsPage,
  head: () => ({ meta: [{ title: "Reading Clubs — ElectroLibrary" }] }),
});

type Club = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
};

function ClubsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const { data: userId } = useQuery({
    queryKey: ["uid"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  const { data: clubs, isLoading } = useQuery({
    queryKey: ["clubs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Club[];
    },
  });

  const { data: myMemberships } = useQuery({
    queryKey: ["my-memberships", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_members")
        .select("club_id")
        .eq("user_id", userId!);
      if (error) throw error;
      return new Set(data.map((d) => d.club_id));
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["club-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("club_members").select("club_id");
      if (error) throw error;
      const map: Record<string, number> = {};
      data.forEach((r) => (map[r.club_id] = (map[r.club_id] || 0) + 1));
      return map;
    },
  });

  const createClub = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      if (!name.trim()) throw new Error("Name required");
      const { data: club, error } = await supabase
        .from("clubs")
        .insert({ name: name.trim(), description: desc.trim() || null, owner_id: userId })
        .select("id")
        .single();
      if (error) throw error;
      await supabase.from("club_members").insert({ club_id: club.id, user_id: userId });
    },
    onSuccess: () => {
      toast.success("Club created!");
      setName(""); setDesc("");
      qc.invalidateQueries({ queryKey: ["clubs"] });
      qc.invalidateQueries({ queryKey: ["my-memberships"] });
      qc.invalidateQueries({ queryKey: ["club-counts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const toggleJoin = useMutation({
    mutationFn: async ({ clubId, joined }: { clubId: string; joined: boolean }) => {
      if (!userId) throw new Error("Not signed in");
      if (joined) {
        const { error } = await supabase.from("club_members")
          .delete().eq("club_id", clubId).eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("club_members")
          .insert({ club_id: clubId, user_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-memberships"] });
      qc.invalidateQueries({ queryKey: ["club-counts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="min-h-screen bg-periwinkle font-rounded">
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <div className="rounded-3xl bg-butter p-6 pop-shadow tilt-l-sm">
          <div className="flex items-center gap-2 text-midnight">
            <Users className="h-5 w-5" />
            <p className="font-hand">find your people, share your shelves</p>
          </div>
          <h1 className="font-chunky text-4xl text-midnight md:text-5xl">READING CLUBS!</h1>
        </div>

        <div className="mt-6 rounded-3xl bg-white p-6 pop-shadow">
          <h2 className="font-chunky text-xl text-midnight">Start a club</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_2fr_auto]">
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Club name"
              className="rounded-full border-2 border-midnight/10 bg-periwinkle/20 px-4 py-2 text-sm outline-none focus:border-coral"
            />
            <input
              value={desc} onChange={(e) => setDesc(e.target.value)}
              placeholder="What will you read together?"
              className="rounded-full border-2 border-midnight/10 bg-periwinkle/20 px-4 py-2 text-sm outline-none focus:border-coral"
            />
            <button
              onClick={() => createClub.mutate()}
              disabled={createClub.isPending}
              className="inline-flex items-center justify-center gap-1 rounded-full bg-coral px-5 py-2 text-sm font-bold uppercase tracking-wider text-white hover:bg-coral-deep disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Create
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {isLoading && (
            <div className="flex items-center gap-2 font-hand text-coral">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading clubs…
            </div>
          )}
          {clubs?.length === 0 && (
            <p className="font-hand italic text-midnight/60">No clubs yet — be the first!</p>
          )}
          {clubs?.map((c) => {
            const joined = myMemberships?.has(c.id) ?? false;
            const memberCount = counts?.[c.id] ?? 0;
            return (
              <div key={c.id} className="rounded-2xl bg-white p-5 pop-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link to="/clubs/$clubId" params={{ clubId: c.id }} className="hover:underline">
                      <h3 className="font-chunky text-lg text-midnight">r/{c.name}</h3>
                    </Link>
                    <p className="mt-1 text-sm text-midnight/70">{c.description || "No description"}</p>
                    <p className="mt-2 font-hand text-xs text-coral">{memberCount} member{memberCount === 1 ? "" : "s"}</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {joined && (
                      <Link
                        to="/clubs/$clubId" params={{ clubId: c.id }}
                        className="shrink-0 inline-flex items-center gap-1 rounded-full bg-butter px-4 py-1.5 text-xs font-bold uppercase text-midnight hover:bg-coral hover:text-white"
                      >
                        Open
                      </Link>
                    )}
                    <button
                      onClick={() => toggleJoin.mutate({ clubId: c.id, joined })}
                      className={`shrink-0 inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider ${
                        joined
                          ? "bg-midnight/10 text-midnight hover:bg-midnight/20"
                          : "bg-coral text-white hover:bg-coral-deep"
                      }`}
                    >
                      {joined ? (<><LogOut className="h-3.5 w-3.5" /> Leave</>) : (<><Plus className="h-3.5 w-3.5" /> Join</>)}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
