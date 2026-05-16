import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Upload, Plus, X, Star, BookOpen } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/shelf")({
  component: ShelfPage,
  head: () => ({ meta: [{ title: "The Shelf — your library" }] }),
});

type Shelf = "read" | "currently-reading" | "want-to-read";
type Row = {
  id: string;
  shelf: Shelf;
  rating: number | null;
  review: string | null;
  is_favorite: boolean;
  spine_color: string | null;
  current_page: number | null;
  total_pages: number | null;
  date_read: string | null;
  book: {
    id: string; title: string; author: string | null; cover_url: string | null;
    description: string | null; genre: string | null; avg_rating: number | null;
  };
};

const SHELF_ORDER: { key: Shelf; label: string }[] = [
  { key: "currently-reading", label: "Currently reading" },
  { key: "read", label: "Read" },
  { key: "want-to-read", label: "Want to read" },
];

const SPINE_COLORS = ["#5C3D2E", "#8B4513", "#1A1208", "#C9A84C", "#7A9E7E", "#C4A4A4", "#3d2817", "#6b4226"];

function ShelfPage() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState<Row | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["shelf", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("user_books")
        .select("id,shelf,rating,review,is_favorite,spine_color,current_page,total_pages,date_read,book:books(id,title,author,cover_url,description,genre,avg_rating)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const grouped = useMemo(() => {
    const m: Record<Shelf, Row[]> = { "currently-reading": [], read: [], "want-to-read": [] };
    rows.forEach((r) => m[r.shelf]?.push(r));
    return m;
  }, [rows]);

  const toggleFav = useMutation({
    mutationFn: async (r: Row) => {
      const { error } = await supabase.from("user_books").update({ is_favorite: !r.is_favorite }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shelf"] }),
  });

  return (
    <div className="min-h-screen pb-24">
      {/* Header bar over the library */}
      <div className="sticky top-0 z-10 border-b border-walnut/20 bg-gradient-to-b from-aged to-cream/80 px-6 py-5 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="font-display text-3xl text-walnut md:text-4xl">The Shelf</h1>
            <p className="font-hand text-sm text-mahogany">your library, candlelit</p>
          </div>
          <div className="flex items-center gap-2">
            <CsvImport userId={userId} />
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 rounded-full bg-mahogany px-4 py-2 font-serif text-sm text-aged transition hover:bg-walnut"
            >
              <Plus className="h-4 w-4" /> Add a book
            </button>
          </div>
        </div>
      </div>

      {/* Library room */}
      <div className="shelf-backboard mx-auto mt-6 max-w-7xl px-3 pb-10 md:px-8">
        {isLoading ? (
          <div className="py-32 text-center font-hand text-aged">building your shelf…</div>
        ) : rows.length === 0 ? (
          <EmptyLibrary onAdd={() => setShowAdd(true)} />
        ) : (
          <div className="space-y-3 pt-6">
            {SHELF_ORDER.map(({ key, label }) => {
              const items = grouped[key];
              if (items.length === 0) return null;
              return (
                <ShelfRow key={key} label={label} books={items} onOpen={setOpen} onFav={(r) => toggleFav.mutate(r)} />
              );
            })}
          </div>
        )}
      </div>

      {open && <BookModal row={open} onClose={() => setOpen(null)} onChange={() => qc.invalidateQueries({ queryKey: ["shelf"] })} />}
      {showAdd && userId && <AddBookModal userId={userId} onClose={() => setShowAdd(false)} onAdded={() => { qc.invalidateQueries({ queryKey: ["shelf"] }); qc.invalidateQueries({ queryKey: ["dashboard-books"] }); }} />}
    </div>
  );
}

function ShelfRow({ label, books, onOpen, onFav }: {
  label: string; books: Row[];
  onOpen: (r: Row) => void; onFav: (r: Row) => void;
}) {
  return (
    <div className="relative">
      <div className="shelf-glow absolute -top-4 left-0 right-0 h-10" />
      <div className="relative flex items-end gap-1 overflow-x-auto px-12 pb-1 md:overflow-visible">
        {/* Wood label tab */}
        <div className="wood-label absolute left-0 top-1/2 z-10 -translate-y-1/2 -rotate-3 px-3 py-1.5">
          <span className="font-hand text-sm text-walnut">{label}</span>
        </div>

        {books.map((r, i) => (
          <BookSpineEl key={r.id} r={r} index={i} onOpen={() => onOpen(r)} onFav={() => onFav(r)} />
        ))}
      </div>
      <div className="shelf-plank h-5" />
    </div>
  );
}

function BookSpineEl({ r, index, onOpen, onFav }: { r: Row; index: number; onOpen: () => void; onFav: () => void }) {
  const color = r.spine_color ?? SPINE_COLORS[index % SPINE_COLORS.length];
  const text = isLight(color) ? "#1A1208" : "#FAF7F2";
  const w = 24 + ((r.book.title.length * 1.3) % 18);
  const h = 150 + ((index * 7) % 30);

  return (
    <button
      onClick={onOpen}
      className="book-spine slide-in relative flex flex-shrink-0 cursor-pointer flex-col items-center justify-between py-3"
      style={{ width: w, height: h, backgroundColor: color, color: text, animationDelay: `${index * 40}ms` }}
      title={`${r.book.title} — ${r.book.author ?? ""}`}
    >
      {r.is_favorite && (
        <span onClick={(e) => { e.stopPropagation(); onFav(); }} className="absolute -top-1 right-1">
          <Heart className="h-3.5 w-3.5 fill-rose text-rose" />
        </span>
      )}
      <span className="line-clamp-3 px-1 text-center font-accent text-[10px] leading-tight tracking-wider [writing-mode:vertical-rl] rotate-180">
        {r.book.title.toUpperCase()}
      </span>
      <span className="line-clamp-1 px-1 font-serif text-[8px] opacity-80">{r.book.author ?? ""}</span>
    </button>
  );
}

function EmptyLibrary({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="px-6 py-24 text-center">
      <p className="font-display text-3xl text-aged">An empty shelf.</p>
      <p className="mx-auto mt-3 max-w-md font-hand text-aged/70">
        Every library begins with one spine. Add a book, or import your Goodreads CSV to bring your whole collection home.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button onClick={onAdd} className="rounded-full bg-gold px-5 py-2 font-serif text-sm text-ink hover:opacity-90">
          Add your first book
        </button>
      </div>
    </div>
  );
}

/* ─────────── Book modal ─────────── */
function BookModal({ row, onClose, onChange }: { row: Row; onClose: () => void; onChange: () => void }) {
  const [shelf, setShelf] = useState<Shelf>(row.shelf);
  const [rating, setRating] = useState<number>(row.rating ?? 0);
  const [review, setReview] = useState<string>(row.review ?? "");
  const [page, setPage] = useState<number>(row.current_page ?? 0);
  const [total, setTotal] = useState<number>(row.total_pages ?? 0);

  async function save() {
    const { error } = await supabase.from("user_books").update({
      shelf, rating: rating || null, review: review || null,
      current_page: page, total_pages: total || null,
    }).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onChange(); onClose();
  }

  async function remove() {
    if (!confirm("Remove this book from your shelf?")) return;
    const { error } = await supabase.from("user_books").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    onChange(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 backdrop-blur-sm md:items-center" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-card p-6 shadow-2xl md:rounded-3xl md:p-8"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "slide-up 400ms cubic-bezier(.2,.8,.2,1)" }}
      >
        <div className="flex items-start justify-between">
          <span className="font-hand text-sm text-mahogany capitalize">{row.shelf.replace("-", " ")}</span>
          <button onClick={onClose} className="rounded-full p-1.5 text-walnut/60 hover:bg-parchment">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid gap-6 md:grid-cols-[auto,1fr]">
          <div className="book-spine mx-auto h-56 w-40 rounded-md md:h-72 md:w-48" style={{ backgroundColor: row.spine_color ?? "#5C3D2E" }}>
            {row.book.cover_url ? (
              <img src={row.book.cover_url} alt={row.book.title} className="h-full w-full rounded-md object-cover" />
            ) : (
              <div className="flex h-full flex-col justify-between p-4 text-aged">
                <span className="font-display text-lg leading-tight">{row.book.title}</span>
                <span className="font-serif text-xs opacity-80">{row.book.author}</span>
              </div>
            )}
          </div>

          <div>
            <h2 className="font-display text-3xl text-ink">{row.book.title}</h2>
            <p className="mt-1 font-serif italic text-muted-foreground">by {row.book.author ?? "Unknown"}</p>
            {row.book.genre && <span className="mt-2 inline-block rounded-full bg-parchment px-3 py-0.5 font-hand text-xs text-walnut">{row.book.genre}</span>}
            {row.book.avg_rating && (
              <p className="mt-2 font-serif text-sm text-muted-foreground">Goodreads avg ★ {Number(row.book.avg_rating).toFixed(2)}</p>
            )}
            {row.book.description && (
              <p className="mt-3 max-h-32 overflow-y-auto font-serif text-sm leading-relaxed text-foreground/85">{row.book.description}</p>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Block label="Shelf">
            <select value={shelf} onChange={(e) => setShelf(e.target.value as Shelf)} className="modal-input">
              <option value="want-to-read">Want to read</option>
              <option value="currently-reading">Currently reading</option>
              <option value="read">Read</option>
            </select>
          </Block>
          <Block label="Your rating">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n === rating ? 0 : n)}>
                  <Star className={`h-6 w-6 ${n <= rating ? "fill-gold text-gold" : "text-walnut/30"}`} />
                </button>
              ))}
            </div>
          </Block>
          <Block label="Current page">
            <input type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} className="modal-input" />
          </Block>
          <Block label="Total pages">
            <input type="number" min={0} value={total} onChange={(e) => setTotal(Number(e.target.value))} className="modal-input" />
          </Block>
        </div>

        <Block label="Your review">
          <textarea
            value={review} onChange={(e) => setReview(e.target.value)} rows={4} maxLength={2000}
            placeholder="What stayed with you?" className="modal-input resize-none"
          />
        </Block>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button onClick={remove} className="font-serif text-sm text-destructive hover:underline">Remove from shelf</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-full border border-border px-5 py-2 font-serif text-sm text-walnut hover:bg-parchment">Cancel</button>
            <button onClick={save} className="rounded-full bg-mahogany px-5 py-2 font-serif text-sm text-aged hover:bg-walnut">Save</button>
          </div>
        </div>

        <style>{`
          @keyframes slide-up { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
          .modal-input {
            width: 100%; background: var(--color-aged); border: 1px solid var(--color-border);
            border-radius: 0.5rem; padding: 0.6rem 0.85rem; font-family: var(--font-serif);
            color: var(--color-foreground); outline: none; transition: border-color 200ms;
          }
          .modal-input:focus { border-color: var(--color-gold); }
        `}</style>
      </div>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block first:mt-0 md:mt-0">
      <span className="mb-1.5 block font-hand text-sm text-walnut">{label}</span>
      {children}
    </label>
  );
}

/* ─────────── Add book ─────────── */
function AddBookModal({ userId, onClose, onAdded }: { userId: string; onClose: () => void; onAdded: () => void }) {
  const [title, setTitle] = useState(""); const [author, setAuthor] = useState("");
  const [genre, setGenre] = useState(""); const [shelf, setShelf] = useState<Shelf>("want-to-read");
  const [loading, setLoading] = useState(false);

  async function add() {
    if (!title.trim()) return toast.error("Title is required");
    setLoading(true);
    try {
      const { data: book, error: bErr } = await supabase
        .from("books").insert({ title: title.trim(), author: author.trim() || null, genre: genre.trim() || null })
        .select("id").single();
      if (bErr) throw bErr;
      const color = SPINE_COLORS[Math.floor(Math.random() * SPINE_COLORS.length)];
      const { error: ubErr } = await supabase.from("user_books").insert({
        user_id: userId, book_id: book.id, shelf, spine_color: color,
      });
      if (ubErr) throw ubErr;
      toast.success("Added to your shelf");
      onAdded(); onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add book");
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl text-walnut">Add a book</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-walnut/60" /></button>
        </div>
        <div className="mt-4 space-y-3">
          <Block label="Title"><input className="modal-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} /></Block>
          <Block label="Author"><input className="modal-input" value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={200} /></Block>
          <Block label="Genre"><input className="modal-input" value={genre} onChange={(e) => setGenre(e.target.value)} maxLength={80} /></Block>
          <Block label="Shelf">
            <select value={shelf} onChange={(e) => setShelf(e.target.value as Shelf)} className="modal-input">
              <option value="want-to-read">Want to read</option>
              <option value="currently-reading">Currently reading</option>
              <option value="read">Read</option>
            </select>
          </Block>
        </div>
        <button onClick={add} disabled={loading} className="mt-5 w-full rounded-full bg-mahogany py-2.5 font-serif text-aged hover:bg-walnut disabled:opacity-60">
          {loading ? "Adding…" : "Place on the shelf"}
        </button>
        <style>{`
          .modal-input {
            width: 100%; background: var(--color-aged); border: 1px solid var(--color-border);
            border-radius: 0.5rem; padding: 0.6rem 0.85rem; font-family: var(--font-serif);
            color: var(--color-foreground); outline: none;
          }
          .modal-input:focus { border-color: var(--color-gold); }
        `}</style>
      </div>
    </div>
  );
}

/* ─────────── CSV Import (Goodreads) ─────────── */
function CsvImport({ userId }: { userId: string | null }) {
  const ref = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function handle(file: File) {
    if (!userId) return;
    setBusy(true);
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) { toast.error("No rows found"); setBusy(false); return; }

    let added = 0;
    try {
      for (const r of rows) {
        const title = r["Title"]; if (!title) continue;
        const author = r["Author"] || r["Author l-f"] || null;
        const exclusive = (r["Exclusive Shelf"] || "").toLowerCase();
        const shelf: Shelf = exclusive === "read" ? "read"
          : exclusive === "currently-reading" ? "currently-reading" : "want-to-read";
        const myRating = Number(r["My Rating"] || 0) || null;
        const avg = Number(r["Average Rating"] || 0) || null;
        const isbn = (r["ISBN13"] || r["ISBN"] || "").replace(/[="]/g, "") || null;
        const dateRead = r["Date Read"] || null;
        const review = r["My Review"] || null;

        const { data: book, error: bErr } = await supabase
          .from("books").insert({ title, author, isbn, avg_rating: avg }).select("id").single();
        if (bErr || !book) continue;
        const color = SPINE_COLORS[added % SPINE_COLORS.length];
        const { error: ubErr } = await supabase.from("user_books").insert({
          user_id: userId, book_id: book.id, shelf, rating: myRating, review, date_read: dateRead, spine_color: color,
        });
        if (!ubErr) added++;
      }
      toast.success(`Imported ${added} ${added === 1 ? "book" : "books"}`);
      qc.invalidateQueries({ queryKey: ["shelf"] });
      qc.invalidateQueries({ queryKey: ["dashboard-books"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally { setBusy(false); }
  }

  return (
    <>
      <input
        ref={ref} type="file" accept=".csv,text/csv" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = ""; }}
      />
      <button
        onClick={() => ref.current?.click()} disabled={busy}
        className="inline-flex items-center gap-2 rounded-full border border-walnut/30 bg-aged px-4 py-2 font-serif text-sm text-walnut transition hover:bg-parchment disabled:opacity-60"
        title="Import a Goodreads CSV (goodreads_library_export.csv)"
      >
        <Upload className="h-4 w-4" /> {busy ? "Importing…" : "Import CSV"}
      </button>
    </>
  );
}

/* ─────────── helpers ─────────── */
function parseCsv(text: string): Record<string, string>[] {
  const lines: string[][] = [];
  let cur: string[] = []; let cell = ""; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else cell += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { cur.push(cell); cell = ""; }
      else if (ch === "\n") { cur.push(cell); lines.push(cur); cur = []; cell = ""; }
      else if (ch === "\r") {/* skip */}
      else cell += ch;
    }
  }
  if (cell.length > 0 || cur.length > 0) { cur.push(cell); lines.push(cur); }
  if (lines.length < 2) return [];
  const header = lines[0];
  return lines.slice(1).filter((l) => l.length === header.length).map((l) =>
    Object.fromEntries(header.map((h, i) => [h.trim(), (l[i] ?? "").trim()]))
  );
}

function isLight(hex: string): boolean {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16); const g = parseInt(h.slice(2, 4), 16); const b = parseInt(h.slice(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) > 160;
}

// unused import guard
export const _icons = BookOpen;
