import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Upload, Plus, X, Star, BookOpen, Play, BookmarkPlus, BookmarkMinus } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  reader_cfi: string | null;
  reader_percent: number | null;
  epub_path: string | null;
  book: {
    id: string; title: string; author: string | null; cover_url: string | null;
    description: string | null; genre: string | null; avg_rating: number | null;
  };
};

const SHELF_LABELS: Record<Shelf, string> = {
  "currently-reading": "Currently reading",
  "read": "Read",
  "want-to-read": "Want to read",
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
        .select("id,shelf,rating,review,is_favorite,spine_color,current_page,total_pages,date_read,reader_cfi,reader_percent,epub_path,book:books(id,title,author,cover_url,description,genre,avg_rating)")
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
    <div className="min-h-screen bg-periwinkle pb-24 font-rounded">
      {/* Header bar over the library */}
      <div className="sticky top-0 z-10 border-b-2 border-midnight/10 bg-periwinkle/95 px-6 py-5 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="rounded-2xl bg-coral px-5 py-3 pop-shadow tilt-l-sm">
            <h1 className="font-chunky text-2xl text-stroke-white text-shadow-pop md:text-3xl">THE SHELF!</h1>
            <p className="font-hand text-xs text-white/90">your library, your way</p>
          </div>
          <div className="flex items-center gap-2">
            <CsvImport userId={userId} />
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 rounded-full bg-coral px-4 py-2 text-sm font-bold uppercase tracking-wider text-white hover:bg-coral-deep"
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
          <TooltipProvider delayDuration={150}>
            <div className="space-y-6 pt-6">
              {(Object.keys(SHELF_LABELS) as Shelf[]).map((key) => {
                const items = grouped[key];
                if (items.length === 0) return null;
                return (
                  <ShelfSection
                    key={key} shelfKey={key} label={SHELF_LABELS[key]} books={items}
                    onOpen={setOpen} onFav={(r) => toggleFav.mutate(r)}
                  />
                );
              })}
            </div>
          </TooltipProvider>
        )}
      </div>

      {open && <BookModal row={open} onClose={() => setOpen(null)} onChange={() => qc.invalidateQueries({ queryKey: ["shelf"] })} />}
      {showAdd && userId && <AddBookModal userId={userId} onClose={() => setShowAdd(false)} onAdded={() => { qc.invalidateQueries({ queryKey: ["shelf"] }); qc.invalidateQueries({ queryKey: ["dashboard-books"] }); }} />}
    </div>
  );
}

/* compute thicker spines so vertical text never overflows */
function spineDims(title: string, index: number) {
  const len = title.length;
  // Width grows with title length so it never looks skinny under heavy text
  const w = Math.round(Math.max(30, Math.min(54, 28 + len * 0.7)));
  // Height grows with title length so vertical text has room
  const baseH = 160 + ((index * 7) % 28);
  const neededH = 60 + len * 7; // ~7px per char in vertical-rl at text-[10px]
  const h = Math.min(220, Math.max(baseH, neededH));
  return { w, h };
}

function chunkRows(books: Row[], maxWidth: number) {
  const out: Row[][] = [];
  let row: Row[] = [];
  let used = 0;
  const gap = 4;
  for (let i = 0; i < books.length; i++) {
    const { w } = spineDims(books[i].book.title, i);
    if (used + w + gap > maxWidth && row.length > 0) {
      out.push(row); row = []; used = 0;
    }
    row.push(books[i]);
    used += w + gap;
  }
  if (row.length) out.push(row);
  return out;
}

function ShelfSection({ shelfKey, label, books, onOpen, onFav }: {
  shelfKey: Shelf; label: string; books: Row[];
  onOpen: (r: Row) => void; onFav: (r: Row) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [maxW, setMaxW] = useState(900);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      // Subtract padding for wood-label tab on the left
      setMaxW(Math.max(200, entries[0].contentRect.width - 130));
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const rows = useMemo(() => chunkRows(books, maxW), [books, maxW]);

  return (
    <div ref={ref} className="relative">
      <div className="wood-label absolute -left-1 top-3 z-20 -rotate-3 px-3 py-1.5 shadow-lg">
        <span className="font-hand text-sm text-walnut">{label}</span>
      </div>
      <div className="space-y-1 pl-28">
        {rows.map((rowBooks, rIdx) => (
          <div key={rIdx} className="relative">
            <div className="shelf-glow absolute -top-4 left-0 right-0 h-10" />
            <div className="shelf-row-3d relative flex items-end gap-1 pb-1 pr-2">
              {rowBooks.map((r, i) => (
                <BookSpineEl
                  key={r.id} r={r}
                  index={rIdx * 100 + i}
                  shelfLabel={SHELF_LABELS[shelfKey]}
                  onOpen={() => onOpen(r)} onFav={() => onFav(r)}
                />
              ))}
            </div>
            <div className="shelf-plank h-5 rounded-b-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

function BookSpineEl({ r, index, shelfLabel, onOpen, onFav }: {
  r: Row; index: number; shelfLabel: string; onOpen: () => void; onFav: () => void;
}) {
  const color = r.spine_color ?? SPINE_COLORS[index % SPINE_COLORS.length];
  const text = isLight(color) ? "#1A1208" : "#FAF7F2";
  const { w, h } = spineDims(r.book.title, index);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onOpen}
          className="book-spine slide-in relative flex flex-shrink-0 cursor-pointer flex-col items-center justify-between py-3"
          style={{ width: w, height: h, backgroundColor: color, color: text, animationDelay: `${(index % 20) * 40}ms` }}
        >
          {r.is_favorite && (
            <span onClick={(e) => { e.stopPropagation(); onFav(); }} className="absolute -top-1 right-1">
              <Heart className="h-3.5 w-3.5 fill-rose text-rose" />
            </span>
          )}
          <span className="overflow-hidden px-1 text-center font-accent text-[10px] leading-tight tracking-wider [writing-mode:vertical-rl] rotate-180">
            {r.book.title.toUpperCase()}
          </span>
          <span className="line-clamp-1 px-1 font-serif text-[8px] opacity-80">{r.book.author ?? ""}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] bg-walnut text-aged">
        <div className="font-display text-sm">{r.book.title}</div>
        {r.book.author && <div className="font-serif text-xs italic opacity-80">{r.book.author}</div>}
        <div className="mt-1 font-hand text-[11px] text-gold">{shelfLabel}</div>
        {r.reader_percent != null && (
          <div className="mt-0.5 font-serif text-[11px] opacity-80">{Math.round(r.reader_percent * 100)}% read</div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function QuickReadingToggle({ row, onDone }: { row: Row; onDone: () => void }) {
  const isReading = row.shelf === "currently-reading";
  async function toggle() {
    const next: Shelf = isReading ? "want-to-read" : "currently-reading";
    const { error } = await supabase.from("user_books").update({ shelf: next }).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success(isReading ? "Removed from currently reading" : "Now in currently reading");
    onDone();
  }
  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-1 rounded-full border border-walnut/30 bg-aged px-4 py-2 font-serif text-sm text-walnut hover:bg-parchment"
    >
      {isReading
        ? (<><BookmarkMinus className="h-4 w-4" /> Stop reading</>)
        : (<><BookmarkPlus className="h-4 w-4" /> Mark currently reading</>)}
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
          <button onClick={remove} className="inline-flex items-center gap-1 font-serif text-sm text-destructive hover:underline">
            <X className="h-3.5 w-3.5" /> Remove from shelf
          </button>
          <div className="flex flex-wrap gap-2">
            <QuickReadingToggle row={row} onDone={onChange} />
            <Link
              to="/read/$bookId" params={{ bookId: row.id }}
              className="inline-flex items-center gap-1 rounded-full bg-gold px-5 py-2 font-serif text-sm text-ink hover:opacity-90"
            >
              {row.reader_cfi ? (<><Play className="h-4 w-4" /> Resume</>) : (<><BookOpen className="h-4 w-4" /> Open reader</>)}
            </Link>
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

type Stage = "idle" | "preview" | "importing" | "done";
type ParsedRow = {
  raw: Record<string, string>;
  title: string;
  author: string | null;
  shelf: Shelf;
  rating: number | null;
  avg: number | null;
  isbn: string | null;
  dateRead: string | null;
  review: string | null;
  reason?: string; // skip reason
};

const FIELD_MAP: { label: string; columns: string[] }[] = [
  { label: "Title", columns: ["Title"] },
  { label: "Author", columns: ["Author", "Author l-f"] },
  { label: "Shelf", columns: ["Exclusive Shelf", "Bookshelves"] },
  { label: "My rating", columns: ["My Rating"] },
  { label: "Avg rating", columns: ["Average Rating"] },
  { label: "ISBN", columns: ["ISBN13", "ISBN"] },
  { label: "Date read", columns: ["Date Read"] },
  { label: "Review", columns: ["My Review"] },
];

function CsvImport({ userId }: { userId: string | null }) {
  const ref = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [stage, setStage] = useState<Stage>("idle");
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<{ added: number; skipped: number; failed: number; errors: string[] }>({
    added: 0, skipped: 0, failed: 0, errors: [],
  });

  function reset() {
    setStage("idle"); setHeaders([]); setParsed([]);
    setProgress({ done: 0, total: 0 });
    setSummary({ added: 0, skipped: 0, failed: 0, errors: [] });
  }

  async function onFile(file: File) {
    if (!userId) return;
    try {
      const text = await file.text();
      const { headers: hs, rows } = parseCsv(text);
      if (rows.length === 0) {
        toast.error("This file is empty or unreadable.");
        return;
      }
      const mapped: ParsedRow[] = rows.map((r) => {
        const title = (r["Title"] || "").trim();
        const author = (r["Author"] || r["Author l-f"] || "").trim() || null;
        const exclusive = (r["Exclusive Shelf"] || "").toLowerCase().trim();
        const shelf: Shelf =
          exclusive === "read" ? "read"
          : exclusive === "currently-reading" ? "currently-reading"
          : "want-to-read";
        const rating = Number(r["My Rating"] || 0) || null;
        const avg = Number(r["Average Rating"] || 0) || null;
        const isbn = (r["ISBN13"] || r["ISBN"] || "").replace(/[="]/g, "").trim() || null;
        const dateRead = (r["Date Read"] || "").trim() || null;
        const review = (r["My Review"] || "").trim() || null;
        const reason = !title ? "Missing title" : undefined;
        return { raw: r, title, author, shelf, rating, avg, isbn, dateRead, review, reason };
      });
      setHeaders(hs);
      setParsed(mapped);
      setStage("preview");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read file");
    }
  }

  async function runImport() {
    if (!userId) return;
    const valid = parsed.filter((r) => !r.reason);
    setStage("importing");
    setProgress({ done: 0, total: valid.length });
    const errors: string[] = [];
    let added = 0, failed = 0;

    for (let i = 0; i < valid.length; i++) {
      const r = valid[i];
      try {
        const { data: book, error: bErr } = await supabase
          .from("books")
          .insert({ title: r.title, author: r.author, isbn: r.isbn, avg_rating: r.avg })
          .select("id").single();
        if (bErr || !book) throw bErr ?? new Error("book insert failed");
        const color = SPINE_COLORS[added % SPINE_COLORS.length];
        const { error: ubErr } = await supabase.from("user_books").insert({
          user_id: userId, book_id: book.id, shelf: r.shelf, rating: r.rating,
          review: r.review, date_read: r.dateRead, spine_color: color,
        });
        if (ubErr) throw ubErr;
        added++;
      } catch (e) {
        failed++;
        if (errors.length < 10) {
          errors.push(`"${r.title}" — ${e instanceof Error ? e.message : "unknown error"}`);
        }
      }
      setProgress({ done: i + 1, total: valid.length });
    }

    setSummary({ added, failed, skipped: parsed.length - valid.length, errors });
    setStage("done");
    qc.invalidateQueries({ queryKey: ["shelf"] });
    qc.invalidateQueries({ queryKey: ["dashboard-books"] });
  }

  const valid = parsed.filter((r) => !r.reason).length;
  const skipped = parsed.length - valid;

  return (
    <>
      <input
        ref={ref} type="file" accept=".csv,text/csv" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />
      <button
        onClick={() => ref.current?.click()}
        className="inline-flex items-center gap-2 rounded-full border border-walnut/30 bg-aged px-4 py-2 font-serif text-sm text-walnut transition hover:bg-parchment"
        title="Import a Goodreads CSV (goodreads_library_export.csv)"
      >
        <Upload className="h-4 w-4" /> Import CSV
      </button>

      {stage !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm" onClick={stage === "importing" ? undefined : reset}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-3xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h3 className="font-display text-2xl text-walnut">
                  {stage === "preview" ? "Review your import"
                    : stage === "importing" ? "Bringing your books home…"
                    : "Import complete"}
                </h3>
                <p className="font-hand text-sm text-mahogany">
                  {stage === "preview" ? "We've mapped your Goodreads columns to The Shelf."
                    : stage === "importing" ? "Please keep this window open."
                    : "Your library has grown."}
                </p>
              </div>
              {stage !== "importing" && (
                <button onClick={reset} className="rounded-full p-1.5 text-walnut/60 hover:bg-parchment">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
              {stage === "preview" && (
                <>
                  <div className="rounded-2xl border border-border bg-aged p-4">
                    <p className="font-hand text-sm text-walnut">Column mapping</p>
                    <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {FIELD_MAP.map((f) => {
                        const found = f.columns.find((c) => headers.includes(c));
                        return (
                          <div key={f.label} className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-serif text-walnut">{f.label}</span>
                            {found ? (
                              <span className="font-hand text-sage">→ {found}</span>
                            ) : (
                              <span className="font-hand text-walnut/40 italic">not found</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    <Pill tone="sage">{valid} ready to import</Pill>
                    {skipped > 0 && <Pill tone="rose">{skipped} will be skipped</Pill>}
                  </div>

                  <p className="mt-4 font-hand text-sm text-walnut">First {Math.min(5, parsed.length)} rows</p>
                  <div className="mt-2 overflow-hidden rounded-xl border border-border">
                    <table className="w-full text-left font-serif text-sm">
                      <thead className="bg-parchment text-walnut">
                        <tr>
                          <th className="px-3 py-2">Title</th>
                          <th className="px-3 py-2">Author</th>
                          <th className="px-3 py-2">Shelf</th>
                          <th className="px-3 py-2">★</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.slice(0, 5).map((r, i) => (
                          <tr key={i} className={`border-t border-border ${r.reason ? "bg-rose/10" : ""}`}>
                            <td className="px-3 py-2">{r.title || <em className="text-rose">missing</em>}</td>
                            <td className="px-3 py-2 text-muted-foreground">{r.author ?? "—"}</td>
                            <td className="px-3 py-2 font-hand text-mahogany capitalize">{r.shelf.replace("-", " ")}</td>
                            <td className="px-3 py-2">{r.rating ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {skipped > 0 && (
                    <details className="mt-4">
                      <summary className="cursor-pointer font-hand text-sm text-mahogany">
                        Why {skipped} {skipped === 1 ? "row was" : "rows were"} skipped
                      </summary>
                      <ul className="mt-2 space-y-1 font-serif text-sm text-muted-foreground">
                        {parsed.filter((r) => r.reason).slice(0, 8).map((r, i) => (
                          <li key={i}>Row {i + 1}: {r.reason}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              )}

              {stage === "importing" && (
                <div className="py-8">
                  <div className="flex items-baseline justify-between font-hand text-mahogany">
                    <span>shelving {progress.done} of {progress.total}…</span>
                    <span>{Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%</span>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-parchment">
                    <div
                      className="h-full rounded-full bg-mahogany transition-all"
                      style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
                    />
                  </div>
                  <p className="mt-6 text-center font-serif italic text-sm text-muted-foreground">
                    Lining up the spines, dusting the jackets…
                  </p>
                </div>
              )}

              {stage === "done" && (
                <div className="py-2">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <Stat label="Added" value={summary.added} tone="sage" />
                    <Stat label="Skipped" value={summary.skipped} tone="muted" />
                    <Stat label="Failed" value={summary.failed} tone={summary.failed > 0 ? "rose" : "muted"} />
                  </div>
                  {summary.errors.length > 0 && (
                    <div className="mt-5 rounded-xl border border-rose/30 bg-rose/10 p-4">
                      <p className="font-hand text-sm text-walnut">A few couldn't be added:</p>
                      <ul className="mt-2 space-y-1 font-serif text-sm text-muted-foreground">
                        {summary.errors.map((e, i) => <li key={i}>• {e}</li>)}
                      </ul>
                    </div>
                  )}
                  <p className="mt-6 text-center font-display text-2xl text-walnut">
                    {summary.added > 0 ? "Welcome home." : "Nothing was added."}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border bg-aged/60 px-6 py-4">
              {stage === "preview" && (
                <>
                  <button onClick={reset} className="font-serif text-sm text-walnut/70 hover:text-walnut">Cancel</button>
                  <button
                    onClick={runImport} disabled={valid === 0}
                    className="rounded-full bg-mahogany px-5 py-2 font-serif text-sm text-aged hover:bg-walnut disabled:opacity-50"
                  >
                    Import {valid} {valid === 1 ? "book" : "books"}
                  </button>
                </>
              )}
              {stage === "importing" && (
                <span className="ml-auto font-hand text-sm text-muted-foreground">working…</span>
              )}
              {stage === "done" && (
                <button onClick={reset} className="ml-auto rounded-full bg-mahogany px-5 py-2 font-serif text-sm text-aged hover:bg-walnut">
                  Open my shelf
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "sage" | "rose" | "muted" }) {
  const cls = tone === "sage" ? "bg-sage/20 text-walnut"
    : tone === "rose" ? "bg-rose/25 text-walnut"
    : "bg-parchment text-walnut/70";
  return <span className={`rounded-full px-3 py-1 font-hand text-xs ${cls}`}>{children}</span>;
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "sage" | "rose" | "muted" }) {
  const color = tone === "sage" ? "text-sage" : tone === "rose" ? "text-rose" : "text-walnut/60";
  return (
    <div className="rounded-2xl border border-border bg-aged py-4">
      <div className={`font-display text-4xl ${color}`}>{value}</div>
      <div className="mt-1 font-hand text-xs text-walnut">{label}</div>
    </div>
  );
}

/* ─────────── helpers ─────────── */
function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
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
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].map((h) => h.trim());
  const rows = lines.slice(1).filter((l) => l.length === headers.length).map((l) =>
    Object.fromEntries(headers.map((h, i) => [h, (l[i] ?? "").trim()]))
  );
  return { headers, rows };
}

function isLight(hex: string): boolean {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16); const g = parseInt(h.slice(2, 4), 16); const b = parseInt(h.slice(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) > 160;
}

// unused import guard
export const _icons = BookOpen;
