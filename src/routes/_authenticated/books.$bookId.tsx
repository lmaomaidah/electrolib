import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, BookOpen, Heart, Star, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/books/$bookId")({
  component: BookDetail,
  head: () => ({ meta: [{ title: "Book — The Shelf" }] }),
  errorComponent: ({ error }) => (
    <div className="p-10 font-serif">Couldn't load this book: {error.message}</div>
  ),
});

type Book = {
  id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  description: string | null;
  genre: string | null;
  isbn: string | null;
  avg_rating: number | null;
};
type UserBook = {
  id: string;
  shelf: string;
  rating: number | null;
  review: string | null;
  current_page: number | null;
  total_pages: number | null;
  is_favorite: boolean;
  epub_path: string | null;
};

function BookDetail() {
  const { bookId } = useParams({ from: "/_authenticated/books/$bookId" });
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: book, isLoading } = useQuery({
    queryKey: ["book", bookId],
    queryFn: async (): Promise<Book | null> => {
      const { data, error } = await supabase
        .from("books")
        .select("id,title,author,cover_url,description,genre,isbn,avg_rating")
        .eq("id", bookId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: ub } = useQuery({
    queryKey: ["user-book", bookId, userId],
    enabled: !!userId,
    queryFn: async (): Promise<UserBook | null> => {
      const { data } = await supabase
        .from("user_books")
        .select("id,shelf,rating,review,current_page,total_pages,is_favorite,epub_path")
        .eq("book_id", bookId)
        .eq("user_id", userId!)
        .maybeSingle();
      return data;
    },
  });

  const setShelf = useMutation({
    mutationFn: async (shelf: "want-to-read" | "currently-reading" | "read") => {
      if (!userId) throw new Error("Sign in first");
      if (ub) {
        const { error } = await supabase.from("user_books").update({ shelf }).eq("id", ub.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_books").insert({
          user_id: userId,
          book_id: bookId,
          shelf,
        });
        if (error) throw error;
      }
      if (shelf === "currently-reading") {
        await supabase.from("profiles").update({ currently_reading_id: bookId }).eq("id", userId);
      }
    },
    onSuccess: () => {
      toast.success("Shelf updated");
      qc.invalidateQueries({ queryKey: ["user-book", bookId] });
      qc.invalidateQueries({ queryKey: ["dashboard-books"] });
      qc.invalidateQueries({ queryKey: ["shelf"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const toggleFav = useMutation({
    mutationFn: async () => {
      if (!ub) throw new Error("Add to a shelf first");
      const { error } = await supabase
        .from("user_books")
        .update({ is_favorite: !ub.is_favorite })
        .eq("id", ub.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-book", bookId] }),
  });

  const rate = useMutation({
    mutationFn: async (rating: number) => {
      if (!ub) throw new Error("Add to a shelf first");
      const { error } = await supabase.from("user_books").update({ rating }).eq("id", ub.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-book", bookId] }),
  });

  const removeFromShelf = useMutation({
    mutationFn: async () => {
      if (!ub) return;
      const { error } = await supabase.from("user_books").delete().eq("id", ub.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed from your shelves");
      qc.invalidateQueries({ queryKey: ["user-book", bookId] });
      qc.invalidateQueries({ queryKey: ["dashboard-books"] });
      qc.invalidateQueries({ queryKey: ["shelf"] });
    },
  });

  if (isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center bg-periwinkle">
        <Loader2 className="h-6 w-6 animate-spin text-coral" />
      </div>
    );
  }
  if (!book) {
    return (
      <div className="min-h-screen bg-periwinkle font-rounded">
        <div className="mx-auto max-w-2xl px-6 py-16 text-center">
          <p className="font-chunky text-3xl text-coral">BOOK NOT FOUND</p>
          <Link to="/shelf" className="mt-4 inline-block font-hand text-white underline">Back to shelf</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-periwinkle font-rounded">
      <div className="mx-auto max-w-5xl px-6 py-10 pb-24">
        <Link to="/dashboard" className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 font-bold text-coral pop-shadow hover:bg-white">
          <ArrowLeft className="h-4 w-4" /> back
        </Link>

        <div className="mt-6 grid gap-8 md:grid-cols-[260px,1fr]">
          <div className="mx-auto w-full max-w-[260px]">
            <div className="aspect-[2/3] overflow-hidden rounded-2xl border-2 border-midnight/10 bg-white pop-shadow">
              {book.cover_url ? (
                <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center p-4 text-center font-chunky text-midnight">
                  {book.title}
                </div>
              )}
            </div>
            {ub?.epub_path && (
              <Link
                to="/read/$bookId" params={{ bookId: ub.id }}
                className="mt-4 flex items-center justify-center gap-2 rounded-full bg-coral px-4 py-2 font-bold uppercase tracking-wider text-white pop-shadow hover:bg-coral-deep"
              >
                <BookOpen className="h-4 w-4" /> Read now
              </Link>
            )}
          </div>

          <div className="rounded-3xl bg-white p-6 pop-shadow tilt-r-sm md:p-7">
            {book.genre && (
              <p className="font-hand text-coral">{book.genre}</p>
            )}
            <h1 className="font-chunky text-3xl text-midnight md:text-4xl">{book.title}</h1>
            <p className="mt-2 italic text-midnight/60">by {book.author ?? "Unknown"}</p>

            {book.avg_rating != null && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-butter px-3 py-1 font-bold text-midnight">
                <Star className="h-4 w-4 fill-midnight text-midnight" />
                {Number(book.avg_rating).toFixed(2)} avg
              </p>
            )}

            <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-midnight/85">
              {book.description ?? "No description on file. Add one from your CSV import or library."}
            </p>

            {book.isbn && (
              <p className="mt-4 font-hand text-sm text-midnight/55">ISBN: {book.isbn}</p>
            )}

            <div className="mt-6 rounded-2xl bg-periwinkle/20 p-5">
              <p className="font-chunky text-lg text-midnight">YOUR SHELF</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["want-to-read", "currently-reading", "read"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setShelf.mutate(s)}
                    disabled={setShelf.isPending}
                    className={`rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-wide transition ${
                      ub?.shelf === s
                        ? "bg-coral text-white pop-shadow"
                        : "bg-white text-midnight hover:bg-butter"
                    }`}
                  >
                    {s.replace("-", " ")}
                  </button>
                ))}
                {ub && (
                  <>
                    <button
                      onClick={() => toggleFav.mutate()}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold transition ${
                        ub.is_favorite ? "bg-coral text-white" : "bg-white text-midnight hover:bg-butter"
                      }`}
                    >
                      <Heart className={`h-4 w-4 ${ub.is_favorite ? "fill-current" : ""}`} />
                      favorite
                    </button>
                    <button
                      onClick={() => removeFromShelf.mutate()}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-midnight hover:bg-butter"
                    >
                      <Trash2 className="h-4 w-4" /> remove
                    </button>
                  </>
                )}
              </div>

              {ub && (
                <div className="mt-5">
                  <p className="font-hand text-sm text-coral">your rating</p>
                  <div className="mt-1 flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => rate.mutate(n)} className="p-0.5">
                        <Star
                          className={`h-6 w-6 ${
                            (ub.rating ?? 0) >= n ? "fill-coral text-coral" : "text-midnight/25"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <OtherReaders bookId={bookId} meId={userId} />
          </div>
        </div>
      </div>
    </div>
  );
}

function OtherReaders({ bookId, meId }: { bookId: string; meId: string | null }) {
  const { data = [] } = useQuery({
    queryKey: ["other-readers", bookId, meId],
    queryFn: async () => {
      let q = supabase
        .from("user_books")
        .select("id,shelf,rating,user_id,epub_path")
        .eq("book_id", bookId).limit(12);
      if (meId) q = q.neq("user_id", meId);
      const { data: rows } = await q;
      const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
      if (!ids.length) return [];
      const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", ids);
      const nameOf = (id: string) => profs?.find((p) => p.id === id)?.display_name ?? "Reader";
      return (rows ?? []).map((r) => ({ ...r, name: nameOf(r.user_id) }));
    },
  });
  if (data.length === 0) return null;
  const hasEpub = data.some((r) => r.epub_path);
  return (
    <div className="mt-5 rounded-2xl bg-butter/40 p-4">
      <div className="flex items-center justify-between">
        <p className="font-chunky text-sm text-midnight">WHO ELSE IS READING THIS</p>
        {hasEpub && (
          <span className="rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            free epub available
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {data.map((r) => (
          <Link key={r.id} to="/profiles/$userId" params={{ userId: r.user_id }}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs pop-shadow hover:bg-periwinkle/30">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-coral font-chunky text-[10px] text-white">
              {r.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="text-midnight">{r.name}</span>
            <span className="text-midnight/50">· {r.shelf.replace("-", " ")}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
