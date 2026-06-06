import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, Loader2, Compass } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/_authenticated/discover")({
  component: DiscoverPage,
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Discover — find your next read" }] }),
});

type OLDoc = {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
  isbn?: string[];
  subject?: string[];
};

const SPINE_COLORS = ["#E8433A", "#F5C842", "#7A9E7E", "#8FB6E3", "#C4A4A4", "#3d2817", "#5C3D2E", "#8B4513"];

function DiscoverPage() {
  const { q: urlQ } = Route.useSearch();
  const [q, setQ] = useState(urlQ ?? "");
  const [submitted, setSubmitted] = useState(urlQ ?? "");
  useEffect(() => {
    if (urlQ && urlQ !== submitted) { setQ(urlQ); setSubmitted(urlQ); }
  }, [urlQ]);
  const qc = useQueryClient();

  const { data, isFetching } = useQuery({
    queryKey: ["openlib", submitted],
    enabled: !!submitted,
    queryFn: async () => {
      const r = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(submitted)}&limit=24`);
      if (!r.ok) throw new Error("Open Library search failed");
      const j = await r.json();
      return (j.docs ?? []) as OLDoc[];
    },
  });

  const addBook = useMutation({
    mutationFn: async (doc: OLDoc) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");

      const cover = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : "";
      // Dedupe books across users via shared canonical row
      const { data: bookId, error: bErr } = await supabase.rpc("find_or_create_book", {
        _title: doc.title,
        _author: doc.author_name?.[0] ?? "",
        _cover_url: cover,
        _isbn: doc.isbn?.[0] ?? "",
        _genre: doc.subject?.[0] ?? "",
      });
      if (bErr) throw bErr;

      const color = SPINE_COLORS[Math.floor(Math.random() * SPINE_COLORS.length)];
      // Inherit any shared epub path uploaded by another reader
      const { data: shared } = await supabase.rpc("get_shared_epub_path", { _book_id: bookId });

      const { error: ubErr } = await supabase.from("user_books").insert({
        user_id: uid, book_id: bookId, shelf: "want-to-read",
        spine_color: color, epub_path: shared ?? null,
      });
      if (ubErr) throw ubErr;
    },
    onSuccess: () => {
      toast.success("Added to your shelf");
      qc.invalidateQueries({ queryKey: ["shelf"] });
      qc.invalidateQueries({ queryKey: ["dashboard-books"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add"),
  });

  return (
    <div className="min-h-screen bg-periwinkle font-rounded">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        <div className="rounded-3xl bg-coral p-6 pop-shadow text-white tilt-r-sm">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5" />
            <p className="font-hand text-white/90">stories the world is reading right now</p>
          </div>
          <h1 className="font-chunky text-4xl text-stroke-white text-shadow-pop md:text-5xl">DISCOVER!</h1>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); setSubmitted(q.trim()); }}
          className="mt-6 flex items-stretch gap-2 rounded-full bg-white p-2 pop-shadow"
        >
          <div className="ml-2 grid place-items-center">
            <Search className="h-5 w-5 text-midnight/50" />
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title, author, or subject…"
            className="flex-1 bg-transparent px-2 py-2 text-sm outline-none"
          />
          <button className="rounded-full bg-coral px-5 py-2 text-sm font-bold uppercase tracking-wider text-white hover:bg-coral-deep">
            Search
          </button>
        </form>

        <div className="mt-8">
          {isFetching && (
            <div className="flex items-center gap-2 font-hand text-coral">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching the library of the world…
            </div>
          )}
          {!isFetching && submitted && data && data.length === 0 && (
            <p className="font-hand italic text-midnight/60">No books matched.</p>
          )}

          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {data?.map((doc) => {
              const cover = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null;
              return (
                <div key={doc.key} className="group rounded-2xl bg-white p-3 pop-shadow transition hover:-translate-y-1">
                  <div className="aspect-[2/3] overflow-hidden rounded bg-periwinkle/20">
                    {cover ? (
                      <img src={cover} alt={doc.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center p-3 text-center font-chunky text-sm text-midnight">
                        {doc.title}
                      </div>
                    )}
                  </div>
                  <h3 className="mt-2 line-clamp-2 font-chunky text-sm text-midnight">{doc.title}</h3>
                  <p className="line-clamp-1 text-xs italic text-midnight/60">
                    {doc.author_name?.[0] ?? "Unknown"}
                  </p>
                  <button
                    onClick={() => addBook.mutate(doc)}
                    disabled={addBook.isPending}
                    className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-full bg-coral px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-coral-deep disabled:opacity-60"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
