import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BookMarked, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — The Shelf" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "magic">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Welcome! Check your email to verify your account.");
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        toast.success("Magic link sent — check your inbox.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-gold/15 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-mahogany/15 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <Link to="/" className="flex items-center gap-2">
          <BookMarked className="h-5 w-5 text-walnut" />
          <span className="font-display text-xl text-walnut">The Shelf</span>
        </Link>

        <div className="my-auto rounded-3xl border border-border bg-card p-8 shadow-xl shadow-walnut/10">
          <h1 className="font-display text-3xl text-walnut">
            {mode === "signup" ? "Begin your library" : mode === "magic" ? "Magic link" : "Welcome back"}
          </h1>
          <p className="mt-2 font-serif text-sm text-muted-foreground">
            {mode === "signup"
              ? "A few details, then we'll pull up your reading chair."
              : mode === "magic"
              ? "We'll send a one-tap sign-in link to your email."
              : "Sign in to return to your shelf."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <Field label="Display name">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Harvey"
                  className="input"
                  maxLength={60}
                />
              </Field>
            )}
            <Field label="Email">
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@library.com"
                className="input"
                maxLength={255}
              />
            </Field>
            {mode !== "magic" && (
              <Field label="Password">
                <input
                  type="password" required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input"
                  minLength={6} maxLength={72}
                />
              </Field>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full rounded-full bg-mahogany py-3 font-serif text-aged transition hover:bg-walnut disabled:opacity-60"
            >
              {loading ? "One moment…" : mode === "signup" ? "Create my shelf" : mode === "magic" ? "Send magic link" : "Sign in"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs font-serif text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          <button
            onClick={() => setMode(mode === "magic" ? "signin" : "magic")}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-aged py-2.5 font-serif text-sm text-walnut transition hover:bg-parchment"
          >
            <Mail className="h-4 w-4" />
            {mode === "magic" ? "Use password instead" : "Email me a magic link"}
          </button>

          <p className="mt-6 text-center font-serif text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
            <button
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="font-medium text-mahogany underline-offset-2 hover:underline"
            >
              {mode === "signup" ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>

        <p className="mt-6 text-center font-hand text-sm text-muted-foreground">
          your stories, beautifully shelved
        </p>
      </div>

      <style>{`
        .input {
          width: 100%;
          background: var(--color-aged);
          border: 1px solid var(--color-border);
          border-radius: 0.5rem;
          padding: 0.65rem 0.85rem;
          font-family: var(--font-serif);
          color: var(--color-foreground);
          outline: none;
          transition: border-color 200ms, box-shadow 200ms;
        }
        .input:focus { border-color: var(--color-gold); box-shadow: 0 0 0 3px oklch(0.74 0.13 85 / 0.2); }
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
