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
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-mahogany" />
      </div>
    );
  }
  if (!book) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="font-display text-3xl text-walnut">Book not found</p>
        <Link to="/shelf" className="mt-4 inline-block font-hand text-mahogany underline">Back to shelf</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 pb-24">
      <Link to="/dashboard" className="inline-flex items-center gap-1 font-hand text-mahogany hover:underline">
        <ArrowLeft className="h-4 w-4" /> back
      </Link>

      <div className="mt-6 grid gap-10 md:grid-cols-[260px,1fr]">
        <div className="mx-auto w-full max-w-[260px]">
          <div className="aspect-[2/3] overflow-hidden rounded-lg bg-parchment shadow-xl shadow-walnut/20">
            {book.cover_url ? (
              <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center p-4 text-center font-display text-walnut">
                {book.title}
              </div>
            )}
          </div>
          {ub?.epub_path && (
            <Link
              to="/read/$bookId"
              params={{ bookId: book.id }}
              className="mt-4 flex items-center justify-center gap-2 rounded-full bg-mahogany px-4 py-2 font-serif text-aged hover:bg-walnut"
            >
              <BookOpen className="h-4 w-4" /> Read now
            </Link>
          )}
        </div>

        <div>
          {book.genre && (
            <p className="font-hand text-mahogany">{book.genre}</p>
          )}
          <h1 className="font-display text-4xl text-ink md:text-5xl">{book.title}</h1>
          <p className="mt-2 font-serif italic text-muted-foreground">by {book.author ?? "Unknown"}</p>

          {book.avg_rating != null && (
            <p className="mt-2 flex items-center gap-1 font-hand text-walnut">
              <Star className="h-4 w-4 fill-gold text-gold" />
              {Number(book.avg_rating).toFixed(2)} average rating
            </p>
          )}

          <p className="mt-6 whitespace-pre-line font-serif leading-relaxed text-foreground/85">
            {book.description ?? "No description on file. Add one from your CSV import or library."}
          </p>

          {book.isbn && (
            <p className="mt-4 font-hand text-sm text-muted-foreground">ISBN: {book.isbn}</p>
          )}

          {/* Actions */}
          <div className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="font-display text-lg text-walnut">Your shelf</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["want-to-read", "currently-reading", "read"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setShelf.mutate(s)}
                  disabled={setShelf.isPending}
                  className={`rounded-full px-4 py-1.5 font-serif text-sm transition ${
                    ub?.shelf === s
                      ? "bg-mahogany text-aged"
                      : "border border-border bg-parchment text-walnut hover:bg-aged"
                  }`}
                >
                  {s.replace("-", " ")}
                </button>
              ))}
              {ub && (
                <>
                  <button
                    onClick={() => toggleFav.mutate()}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-serif text-sm transition ${
                      ub.is_favorite
                        ? "bg-coral text-aged"
                        : "border border-border bg-parchment text-walnut hover:bg-aged"
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${ub.is_favorite ? "fill-current" : ""}`} />
                    favorite
                  </button>
                  <button
                    onClick={() => removeFromShelf.mutate()}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-parchment px-3 py-1.5 font-serif text-sm text-walnut hover:bg-aged"
                  >
                    <Trash2 className="h-4 w-4" /> remove
                  </button>
                </>
              )}
            </div>

            {ub && (
              <div className="mt-5">
                <p className="font-hand text-sm text-mahogany">your rating</p>
                <div className="mt-1 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => rate.mutate(n)} className="p-0.5">
                      <Star
                        className={`h-5 w-5 ${
                          (ub.rating ?? 0) >= n ? "fill-gold text-gold" : "text-walnut/30"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
