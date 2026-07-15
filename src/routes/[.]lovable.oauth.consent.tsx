import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BookMarked, Check, X } from "lucide-react";

type OAuthClient = { name?: string; client_name?: string; redirect_uri?: string };
type OAuthDetails = {
  client?: OAuthClient;
  scope?: string;
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
};

// Beta namespace — narrow local typing so we don't grep node_modules.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
};
function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen grid place-items-center bg-periwinkle p-6 font-rounded">
      <div className="max-w-md rounded-3xl bg-white p-8 pop-shadow">
        <h1 className="font-chunky text-2xl text-coral">Authorization error</h1>
        <p className="mt-2 text-sm text-midnight/70">{String((error as Error)?.message ?? error)}</p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.client_name ?? details?.client?.name ?? "an app";
  const scopes = details?.scopes ?? (details?.scope ? details.scope.split(" ") : []);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauthApi().approveAuthorization(authorization_id)
      : await oauthApi().denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("No redirect returned by the authorization server."); return; }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen grid place-items-center bg-periwinkle p-6 font-rounded">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 pop-shadow tilt-l-sm">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-coral px-3 py-1 font-chunky text-xs text-white">
          <BookMarked className="h-3.5 w-3.5" /> ELECTROLIBRARY
        </div>
        <h1 className="font-chunky text-3xl text-coral leading-tight">
          Connect {clientName}
        </h1>
        <p className="mt-3 text-sm text-midnight/75">
          This lets <span className="font-bold text-midnight">{clientName}</span> use ElectroLibrary as you —
          reading through your shelves and updating your books on your behalf.
        </p>

        {scopes.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-midnight/70">
            {scopes.map((s) => (
              <li key={s} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-coral" /> {s}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-xs text-midnight/50">
          This does not bypass ElectroLibrary's permissions — your data is still protected.
        </p>

        {error && <p role="alert" className="mt-3 text-sm text-coral">{error}</p>}

        <div className="mt-6 flex gap-3">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 rounded-full bg-coral py-3 font-bold text-white pop-shadow hover:bg-coral-deep disabled:opacity-60"
          >
            {busy ? "One moment…" : "Approve"}
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex items-center gap-1 rounded-full bg-white border-2 border-midnight/20 px-5 py-3 font-bold text-midnight hover:border-coral disabled:opacity-60"
          >
            <X className="h-4 w-4" /> Deny
          </button>
        </div>
      </div>
    </main>
  );
}
