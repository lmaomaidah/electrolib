import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/theme-provider";
import { Sun, Moon, ExternalLink } from "lucide-react";
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

  if (loading) return <div className="p-10 font-hand text-walnut">opening your ledger…</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:px-8">
      <h1 className="font-display text-4xl text-walnut">Settings</h1>
      <p className="font-hand text-mahogany">how your library looks and reads</p>

      <section className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl text-ink">Profile</h2>
        <Field label="Email">
          <input value={email} disabled className="setting-input opacity-60" />
        </Field>
        <Field label="Display name">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="setting-input" maxLength={80} />
        </Field>
        <Field label="Reading goal (books this year)">
          <input type="number" min={1} max={365} value={goal} onChange={(e) => setGoal(Number(e.target.value) || 1)} className="setting-input w-32" />
        </Field>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl text-ink">Appearance</h2>
        <div className="mt-4 flex gap-3">
          <ThemeBtn active={theme === "light"} onClick={() => setTheme("light")} icon={<Sun className="h-4 w-4" />} label="Candlelight" />
          <ThemeBtn active={theme === "dark"} onClick={() => setTheme("dark")} icon={<Moon className="h-4 w-4" />} label="Midnight study" />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl text-ink">Import library</h2>
        <p className="mt-2 font-serif text-sm text-muted-foreground">
          Already keep a Goodreads library? Export it as CSV then import from the Shelf page.
        </p>
        <a
          href="https://www.goodreads.com/review/import"
          target="_blank" rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 font-serif text-sm text-mahogany hover:underline"
        >
          Open Goodreads export <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </section>

      <button onClick={save} className="mt-6 rounded-full bg-mahogany px-6 py-2.5 font-serif text-aged hover:bg-walnut">
        Save settings
      </button>

      <style>{`
        .setting-input {
          width: 100%; background: var(--color-aged); border: 1px solid var(--color-border);
          border-radius: 0.5rem; padding: 0.6rem 0.85rem; font-family: var(--font-serif);
          color: var(--color-foreground); outline: none;
        }
        .setting-input:focus { border-color: var(--color-gold); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-hand text-sm text-walnut">{label}</span>
      {children}
    </label>
  );
}

function ThemeBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border px-4 py-2 font-serif text-sm transition ${
        active ? "border-gold bg-gold/20 text-ink" : "border-border bg-aged text-walnut hover:bg-parchment"
      }`}
    >
      {icon} {label}
    </button>
  );
}
