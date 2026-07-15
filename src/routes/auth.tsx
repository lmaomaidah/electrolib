import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { BookMarked, Mail, ArrowRight, CheckCircle2, Library } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" && s.next.startsWith("/") ? s.next : "",
  }),
  head: () => ({ meta: [{ title: "Sign in — ElectroLibrary" }] }),
});

function AuthPage() {
  const { next } = Route.useSearch();
  const { next } = Route.useSearch();
  const dest = next || "/dashboard";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<"google" | "magic" | "password" | null>(null);
  const [sent, setSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) window.location.href = dest;
    });
  }, [dest]);

  async function signInGoogle() {
    setLoading("google");
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}${dest}`,
      });
      if (result.error) throw result.error;
      if (!result.redirected) window.location.href = dest;
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
        options: { emailRedirectTo: `${window.location.origin}${dest}` },
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
      const { error: inErr } = await supabase.auth.signInWithPassword({ email, password });
      if (inErr) {
        const { error: upErr } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}${dest}`,
            data: { display_name: email.split("@")[0] },
          },
        });
        if (upErr) throw upErr;
        toast.success("Welcome! Check your email to confirm.");
        return;
      }
      window.location.href = dest;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-periwinkle font-rounded">
      <div className="pointer-events-none absolute inset-0">
        {[
          { left: "8%", top: "10%", size: 70 },
          { left: "75%", top: "12%", size: 90 },
          { left: "30%", top: "75%", size: 60 },
          { left: "82%", top: "70%", size: 80 },
        ].map((c, i) => (
          <div key={i} className="bob-slow absolute rounded-full bg-white/70 blur-[2px]"
            style={{ left: c.left, top: c.top, width: c.size, height: c.size * 0.6, animationDelay: `${i * 0.6}s` }} />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
        <Link to="/" className="inline-flex w-fit items-center gap-2 rounded-full bg-coral px-4 py-1.5 font-chunky text-sm text-white pop-shadow">
          <Library className="h-4 w-4" /> ELECTROLIBRARY
        </Link>

        <div className="my-auto rounded-3xl bg-white p-8 pop-shadow tilt-l-sm">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-butter">
                <CheckCircle2 className="h-7 w-7 text-midnight" />
              </div>
              <h1 className="font-chunky text-3xl text-coral">CHECK YOUR EMAIL!</h1>
              <p className="mt-3 font-rounded text-sm text-midnight/75">
                We sent a sign-in link to <span className="font-bold text-midnight">{email}</span>.
              </p>
              <button onClick={() => { setSent(false); setEmail(""); }}
                className="mt-6 font-hand text-sm text-coral hover:underline">
                use a different email
              </button>
            </div>
          ) : (
            <>
              <p className="font-hand text-coral">Welcome back to</p>
              <h1 className="font-chunky text-4xl text-coral text-stroke-white leading-none">YOUR LIBRARY!</h1>
              <p className="mt-3 font-rounded text-sm text-midnight/70">
                Pick how you'd like to sign in.
              </p>

              <button
                onClick={signInGoogle}
                disabled={loading !== null}
                className="mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-coral py-3 font-bold text-white pop-shadow transition hover:bg-coral-deep disabled:opacity-60"
              >
                <GoogleIcon />
                {loading === "google" ? "Opening Google…" : "Continue with Google"}
              </button>

              <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-midnight/50">
                <span className="h-px flex-1 bg-midnight/15" /> or <span className="h-px flex-1 bg-midnight/15" />
              </div>

              <form onSubmit={sendMagicLink}>
                <label className="block">
                  <span className="mb-1.5 block font-hand text-sm text-coral">Email me a sign-in link</span>
                  <div className="flex items-stretch gap-2">
                    <div className="flex flex-1 items-center gap-2 rounded-full border-2 border-periwinkle/40 bg-white px-4">
                      <Mail className="h-4 w-4 text-midnight/50" />
                      <input
                        type="email" required value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@library.com"
                        maxLength={255}
                        className="flex-1 bg-transparent py-2.5 font-rounded text-sm outline-none"
                      />
                    </div>
                    <button
                      type="submit" disabled={loading !== null || !email}
                      className="grid h-11 w-11 place-items-center rounded-full bg-butter text-midnight pop-shadow transition hover:bg-white disabled:opacity-60"
                      title="Send magic link"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </label>
              </form>

              <div className="mt-5 text-center">
                {!showPassword ? (
                  <button onClick={() => setShowPassword(true)}
                    className="font-hand text-xs text-midnight/60 hover:text-coral">
                    prefer a password? sign in with one
                  </button>
                ) : (
                  <form onSubmit={signInWithPassword} className="mt-2 space-y-2 text-left">
                    <input
                      type="password" required value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password (min 6 chars)"
                      minLength={6} maxLength={72}
                      className="w-full rounded-full border-2 border-periwinkle/40 bg-white px-4 py-2.5 font-rounded text-sm outline-none focus:border-coral"
                    />
                    <button
                      type="submit" disabled={loading !== null || !email || !password}
                      className="w-full rounded-full bg-midnight py-2.5 font-bold text-white disabled:opacity-60"
                    >
                      {loading === "password" ? "One moment…" : "Sign in / create account"}
                    </button>
                    <button type="button" onClick={() => setShowPassword(false)}
                      className="block w-full text-center font-hand text-xs text-midnight/60 hover:text-coral">
                      back to magic link
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center font-hand text-sm text-white/90">
          a loud, friendly little library
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#fff" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" opacity=".95"/>
      <path fill="#fff" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18z" opacity=".8"/>
      <path fill="#fff" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.94H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.06l3.01-2.34z" opacity=".7"/>
      <path fill="#fff" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z" opacity=".9"/>
    </svg>
  );
}
