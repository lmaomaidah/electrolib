import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/discover")({
  component: DiscoverPage,
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

const SPINE_COLORS = ["#5C3D2E", "#8B4513", "#1A1208", "#C9A84C", "#7A9E7E", "#C4A4A4", "#3d2817", "#6b4226"];

function DiscoverPage() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
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

      const cover = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null;
      const { data: book, error: bErr } = await supabase.from("books").insert({
        title: doc.title,
        author: doc.author_name?.[0] ?? null,
        cover_url: cover,
        isbn: doc.isbn?.[0] ?? null,
        genre: doc.subject?.[0] ?? null,
      }).select("id").single();
      if (bErr) throw bErr;

      const color = SPINE_COLORS[Math.floor(Math.random() * SPINE_COLORS.length)];
      const { error: ubErr } = await supabase.from("user_books").insert({
        user_id: uid, book_id: book.id, shelf: "want-to-read", spine_color: color,
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
    <div className="min-h-screen px-4 py-8 md:px-10 md:py-12">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-display text-4xl text-walnut md:text-5xl">Discover</h1>
        <p className="font-hand text-mahogany">stories the world is reading right now</p>

        <form
          onSubmit={(e) => { e.preventDefault(); setSubmitted(q.trim()); }}
          className="mt-6 flex gap-2 rounded-full border border-border bg-card p-2 shadow-sm"
        >
          <Search className="ml-3 mt-2 h-5 w-5 text-walnut/60" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title, author, or subject…"
            className="flex-1 bg-transparent px-2 py-2 font-serif text-base outline-none"
          />
          <button className="rounded-full bg-mahogany px-5 py-2 font-serif text-aged hover:bg-walnut">
            Search
          </button>
        </form>

        <div className="mt-8">
          {isFetching && (
            <div className="flex items-center gap-2 font-hand text-walnut/70">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching the library of the world…
            </div>
          )}
          {!isFetching && submitted && data && data.length === 0 && (
            <p className="font-serif italic text-muted-foreground">No books matched.</p>
          )}

          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {data?.map((doc) => {
              const cover = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null;
              return (
                <div key={doc.key} className="group rounded-lg bg-card p-3 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                  <div className="aspect-[2/3] overflow-hidden rounded bg-parchment">
                    {cover ? (
                      <img src={cover} alt={doc.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center p-3 text-center font-display text-sm text-walnut">
                        {doc.title}
                      </div>
                    )}
                  </div>
                  <h3 className="mt-2 line-clamp-2 font-display text-sm text-ink">{doc.title}</h3>
                  <p className="line-clamp-1 font-serif text-xs italic text-muted-foreground">
                    {doc.author_name?.[0] ?? "Unknown"}
                  </p>
                  <button
                    onClick={() => addBook.mutate(doc)}
                    disabled={addBook.isPending}
                    className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-full bg-walnut px-3 py-1.5 font-serif text-xs text-aged hover:bg-mahogany disabled:opacity-60"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add to shelf
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
