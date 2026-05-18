import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { BookMarked, Mail, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — The Shelf" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<"google" | "magic" | "password" | null>(null);
  const [sent, setSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function signInGoogle() {
    setLoading("google");
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/dashboard`,
      });
      if (result.error) throw result.error;
      if (!result.redirected) navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(null);
    }
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading("magic");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send link");
    } finally {
      setLoading(null);
    }
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading("password");
    try {
      // Try sign in first; if user doesn't exist, sign up.
      const { error: inErr } = await supabase.auth.signInWithPassword({ email, password });
      if (inErr) {
        const { error: upErr } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: email.split("@")[0] },
          },
        });
        if (upErr) throw upErr;
        toast.success("Welcome! Check your email to confirm.");
        return;
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(null);
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
          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-sage/20">
                <CheckCircle2 className="h-7 w-7 text-sage" />
              </div>
              <h1 className="font-display text-3xl text-walnut">Check your email</h1>
              <p className="mt-3 font-serif text-sm text-muted-foreground">
                We sent a sign-in link to <span className="font-medium text-walnut">{email}</span>.
                Tap it to open your shelf.
              </p>
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="mt-6 font-hand text-sm text-mahogany hover:underline"
              >
                use a different email
              </button>
            </div>
          ) : (
            <>
              <h1 className="font-display text-3xl text-walnut">Step into your library</h1>
              <p className="mt-2 font-serif text-sm text-muted-foreground">
                No passwords, no fuss. Pick a way in.
              </p>

              {/* Google */}
              <button
                onClick={signInGoogle}
                disabled={loading !== null}
                className="mt-6 flex w-full items-center justify-center gap-3 rounded-full border border-border bg-aged py-3 font-serif text-walnut transition hover:bg-parchment disabled:opacity-60"
              >
                <GoogleIcon />
                {loading === "google" ? "Opening Google…" : "Continue with Google"}
              </button>

              <div className="my-5 flex items-center gap-3 text-xs font-hand text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>

              {/* Magic link */}
              <form onSubmit={sendMagicLink}>
                <label className="block">
                  <span className="mb-1.5 block font-hand text-sm text-walnut">Email me a sign-in link</span>
                  <div className="flex items-stretch gap-2">
                    <div className="flex flex-1 items-center gap-2 rounded-full border border-border bg-aged px-4">
                      <Mail className="h-4 w-4 text-walnut/50" />
                      <input
                        type="email" required value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@library.com"
                        maxLength={255}
                        className="flex-1 bg-transparent py-2.5 font-serif text-sm outline-none"
                      />
                    </div>
                    <button
                      type="submit" disabled={loading !== null || !email}
                      className="grid h-11 w-11 place-items-center rounded-full bg-mahogany text-aged transition hover:bg-walnut disabled:opacity-60"
                      title="Send magic link"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </label>
              </form>

              {/* Password fallback */}
              <div className="mt-5 text-center">
                {!showPassword ? (
                  <button
                    onClick={() => setShowPassword(true)}
                    className="font-hand text-xs text-muted-foreground hover:text-mahogany"
                  >
                    prefer a password? sign in with one
                  </button>
                ) : (
                  <form onSubmit={signInWithPassword} className="mt-2 space-y-2 text-left">
                    <input
                      type="password" required value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password (min 6 chars)"
                      minLength={6} maxLength={72}
                      className="w-full rounded-full border border-border bg-aged px-4 py-2.5 font-serif text-sm outline-none focus:border-gold"
                    />
                    <button
                      type="submit" disabled={loading !== null || !email || !password}
                      className="w-full rounded-full bg-walnut py-2.5 font-serif text-sm text-aged disabled:opacity-60"
                    >
                      {loading === "password" ? "One moment…" : "Sign in / create account"}
                    </button>
                    <button
                      type="button" onClick={() => setShowPassword(false)}
                      className="block w-full text-center font-hand text-xs text-muted-foreground hover:text-mahogany"
                    >
                      back to magic link
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center font-hand text-sm text-muted-foreground">
          your stories, beautifully shelved
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.94H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.06l3.01-2.34z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
