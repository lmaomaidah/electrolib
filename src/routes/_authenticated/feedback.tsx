import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Star, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/feedback")({
  component: FeedbackPage,
  head: () => ({ meta: [{ title: "Feedback — ElectroLibrary" }] }),
});

type Feedback = {
  id: string; message: string; rating: number | null;
  resolved: boolean; created_at: string;
};

function FeedbackPage() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");
  const [rating, setRating] = useState(0);

  const { data: mine } = useQuery({
    queryKey: ["my-feedback"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Feedback[];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      if (!msg.trim()) throw new Error("Write something first");
      const { error } = await supabase.from("feedback").insert({
        user_id: u.user.id, message: msg.trim(), rating: rating || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thanks for your feedback!");
      setMsg(""); setRating(0);
      qc.invalidateQueries({ queryKey: ["my-feedback"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="min-h-screen bg-periwinkle font-rounded">
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
        <div className="rounded-3xl bg-coral p-6 pop-shadow text-white tilt-r-sm">
          <div className="flex items-center gap-2"><MessageSquare className="h-5 w-5" />
            <p className="font-hand text-white/90">tell us what you love (or don't)</p>
          </div>
          <h1 className="font-chunky text-4xl text-stroke-white text-shadow-pop md:text-5xl">FEEDBACK!</h1>
        </div>

        <div className="mt-6 rounded-3xl bg-white p-6 pop-shadow">
          <p className="font-chunky text-midnight">Rate ElectroLibrary</p>
          <div className="mt-2 flex gap-1">
            {[1,2,3,4,5].map((n) => (
              <button key={n} onClick={() => setRating(n === rating ? 0 : n)}>
                <Star className={`h-7 w-7 ${n <= rating ? "fill-coral text-coral" : "text-midnight/30"}`} />
              </button>
            ))}
          </div>
          <textarea
            value={msg} onChange={(e) => setMsg(e.target.value)}
            placeholder="Your query, idea, or bug report…"
            rows={5}
            className="mt-4 w-full rounded-2xl border-2 border-midnight/10 bg-periwinkle/20 px-4 py-3 text-sm outline-none focus:border-coral"
          />
          <button
            onClick={() => submit.mutate()}
            disabled={submit.isPending}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-coral px-5 py-2 text-sm font-bold uppercase tracking-wider text-white hover:bg-coral-deep disabled:opacity-60"
          >
            <Send className="h-4 w-4" /> Send
          </button>
        </div>

        <div className="mt-8">
          <h2 className="font-chunky text-xl text-midnight">Your submissions</h2>
          <div className="mt-3 space-y-3">
            {mine?.length === 0 && <p className="font-hand italic text-midnight/60">Nothing yet.</p>}
            {mine?.map((f) => (
              <div key={f.id} className="rounded-2xl bg-white p-4 pop-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {[1,2,3,4,5].map((n) => (
                      <Star key={n} className={`h-4 w-4 ${f.rating && n <= f.rating ? "fill-coral text-coral" : "text-midnight/20"}`} />
                    ))}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${f.resolved ? "bg-mint/30 text-midnight" : "bg-butter text-midnight"}`}>
                    {f.resolved ? "Resolved" : "Open"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-midnight">{f.message}</p>
                <p className="mt-1 text-xs text-midnight/50">{new Date(f.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
