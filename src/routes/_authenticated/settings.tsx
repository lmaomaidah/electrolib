import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/theme-provider";
import { Sun, Moon, ExternalLink, Settings as SettingsIcon, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — ElectroLibrary" }] }),
});

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [goal, setGoal] = useState(12);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setEmail(u.user.email ?? "");
      const { data } = await supabase.from("profiles").select("display_name,reading_goal").eq("id", u.user.id).single();
      setDisplayName(data?.display_name ?? "");
      setGoal(data?.reading_goal ?? 12);
      setLoading(false);
    })();
  }, []);

  async function save() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("profiles").update({
      display_name: displayName, reading_goal: goal, theme,
    }).eq("id", u.user.id);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
  }

  if (loading) return <div className="p-10 font-hand text-coral">opening your ledger…</div>;

  return (
    <div className="min-h-screen bg-periwinkle font-rounded">
      <div className="mx-auto max-w-2xl px-4 py-10 md:px-8">
        <div className="rounded-3xl bg-coral p-6 pop-shadow text-white tilt-r-sm">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            <p className="font-hand text-white/90">your library, your rules</p>
          </div>
          <h1 className="font-chunky text-4xl text-stroke-white text-shadow-pop md:text-5xl">SETTINGS!</h1>
        </div>

        <section className="mt-6 space-y-4 rounded-3xl bg-white p-6 pop-shadow">
          <h2 className="font-chunky text-2xl text-midnight">PROFILE</h2>
          <Field label="Email">
            <input value={email} disabled className="setting-input opacity-60" />
          </Field>
          <Field label="Display name">
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="setting-input" maxLength={80} />
          </Field>
          <Field label="Reading goal (books this year)">
            <input type="number" min={1} max={365} value={goal}
              onChange={(e) => setGoal(Number(e.target.value) || 1)} className="setting-input w-32" />
          </Field>
        </section>

        <section className="mt-6 rounded-3xl bg-butter p-6 pop-shadow tilt-l-sm">
          <h2 className="font-chunky text-2xl text-midnight">APPEARANCE</h2>
          <div className="mt-4 flex gap-3">
            <ThemeBtn active={theme === "light"} onClick={() => setTheme("light")} icon={<Sun className="h-4 w-4" />} label="Candlelight" />
            <ThemeBtn active={theme === "dark"} onClick={() => setTheme("dark")} icon={<Moon className="h-4 w-4" />} label="Midnight study" />
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-6 pop-shadow">
          <h2 className="font-chunky text-2xl text-midnight">IMPORT LIBRARY</h2>
          <p className="mt-2 font-rounded text-sm text-midnight/70">
            Already keep a Goodreads library? Export it as CSV then import from the Shelf page.
          </p>
          <a href="https://www.goodreads.com/review/import" target="_blank" rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 font-bold text-coral hover:underline">
            Open Goodreads export <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </section>

        <section className="mt-6 rounded-3xl border-2 border-coral/40 bg-white p-6 pop-shadow">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-coral" />
            <h2 className="font-chunky text-2xl text-midnight">DANGER ZONE</h2>
          </div>
          <p className="mt-2 text-sm text-midnight/70">
            Wipe every book off your shelf. Reviews, ratings, progress — all gone. Cannot be undone.
          </p>
          <DeleteShelfButton />
        </section>

        <button onClick={save}
          className="mt-6 rounded-full bg-coral px-6 py-2.5 font-bold uppercase tracking-wider text-white pop-shadow hover:bg-coral-deep">
          Save settings →
        </button>

        <style>{`
          .setting-input {
            width: 100%; background: #fff; border: 2px solid color-mix(in oklab, var(--periwinkle) 40%, transparent);
            border-radius: 9999px; padding: 0.6rem 1rem; font-family: var(--font-rounded);
            color: var(--midnight); outline: none; transition: border-color 200ms;
          }
          .setting-input:focus { border-color: var(--coral); }
        `}</style>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-hand text-sm text-coral">{label}</span>
      {children}
    </label>
  );
}

function ThemeBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-bold transition ${
        active ? "border-coral bg-coral text-white" : "border-midnight/15 bg-white text-midnight hover:bg-periwinkle/15"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function DeleteShelfButton() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  async function wipe() {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("user_books").delete().eq("user_id", u.user.id);
      if (error) throw error;
      toast.success("Your shelf has been cleared");
      setConfirming(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not clear shelf");
    } finally { setBusy(false); }
  }
  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)}
        className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-coral bg-white px-5 py-2 text-sm font-bold text-coral hover:bg-coral hover:text-white">
        <Trash2 className="h-4 w-4" /> Delete entire shelf
      </button>
    );
  }
  return (
    <div className="mt-4 rounded-2xl border-2 border-coral bg-coral/5 p-4">
      <p className="font-bold text-midnight">Are you absolutely sure?</p>
      <p className="mt-1 text-sm text-midnight/70">Every book, rating, review and progress marker will be permanently deleted.</p>
      <div className="mt-3 flex gap-2">
        <button onClick={wipe} disabled={busy}
          className="rounded-full bg-coral px-4 py-1.5 text-sm font-bold text-white hover:bg-coral-deep disabled:opacity-60">
          {busy ? "Wiping…" : "Yes, wipe it all"}
        </button>
        <button onClick={() => setConfirming(false)}
          className="rounded-full border-2 border-midnight/20 bg-white px-4 py-1.5 text-sm font-bold text-midnight">
          Cancel
        </button>
      </div>
    </div>
  );
}
