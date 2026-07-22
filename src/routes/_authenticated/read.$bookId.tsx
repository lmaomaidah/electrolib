import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ChevronLeft, ChevronRight, ArrowLeft, Upload, Loader2,
  List, Type, Sun, Moon, Coffee, Minus, Plus, X,
} from "lucide-react";
import { toast } from "sonner";
import ePub from "epubjs";

export const Route = createFileRoute("/_authenticated/read/$bookId")({
  component: ReaderPage,
  head: () => ({ meta: [{ title: "Reader — ElectroLibrary" }] }),
});

type UB = {
  id: string;
  epub_path: string | null;
  reader_cfi: string | null;
  reader_percent: number | null;
  book: { id: string; title: string; author: string | null } | null;
};

type Theme = "light" | "sepia" | "dark";
const THEMES: Record<Theme, { body: string; bg: string; color: string; link: string }> = {
  light: { body: "bg-white", bg: "#ffffff", color: "#1a1a2e", link: "#e85d3a" },
  sepia: { body: "bg-[#f4ecd8]", bg: "#f4ecd8", color: "#3d2e1f", link: "#a0522d" },
  dark: { body: "bg-[#1a1a2e]", bg: "#1a1a2e", color: "#e8e8f0", link: "#f5c842" },
};

function ReaderPage() {
  const { bookId } = Route.useParams();
  const navigate = useNavigate();
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const bookRef = useRef<any>(null);
  const [ub, setUb] = useState<UB | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("reader-theme") as Theme) ?? "light");
  const [fontSize, setFontSize] = useState<number>(() => Number(localStorage.getItem("reader-font-size")) || 100);
  const [toc, setToc] = useState<{ label: string; href: string }[]>([]);
  const [showToc, setShowToc] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("user_books")
        .select("id,epub_path,reader_cfi,reader_percent,book:books(id,title,author)")
        .eq("id", bookId)
        .single();
      if (error) { toast.error(error.message); setLoading(false); return; }
      let row = data as unknown as UB;
      // Auto-pull shared epub uploaded by another reader
      if (!row.epub_path && row.book?.id) {
        const { data: shared } = await supabase.rpc("get_shared_epub_path", { _book_id: row.book.id });
        if (shared) {
          await supabase.from("user_books").update({ epub_path: shared }).eq("id", row.id);
          row = { ...row, epub_path: shared };
          toast.success("Loaded shared edition from another reader");
        }
      }
      setUb(row);
      setLoading(false);
    })();
  }, [bookId]);

  useEffect(() => {
    if (!ub?.epub_path || !viewerRef.current) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.storage.from("epubs").createSignedUrl(ub.epub_path!, 3600);
      if (error || !data) { toast.error("Could not load file"); return; }
      if (cancelled) return;

      const book = ePub(data.signedUrl);
      bookRef.current = book;
      const rendition = book.renderTo(viewerRef.current!, {
        width: "100%", height: "100%", spread: "auto", flow: "paginated",
      });
      renditionRef.current = rendition;

      applyTheme(rendition, theme, fontSize);

      await book.ready;
      await rendition.display(ub.reader_cfi || undefined);

      // Load TOC
      try {
        const nav = await book.loaded.navigation;
        const flat: { label: string; href: string }[] = [];
        const walk = (items: any[]) => items.forEach((it) => {
          flat.push({ label: it.label?.trim() ?? "Chapter", href: it.href });
          if (it.subitems?.length) walk(it.subitems);
        });
        walk(nav.toc ?? []);
        setToc(flat);
      } catch { /* ignore */ }

      await book.locations.generate(1600);
      const totalPages = book.locations.length();

      rendition.on("relocated", async (loc: any) => {
        const cfi = loc?.start?.cfi as string | undefined;
        const pct = typeof loc?.start?.percentage === "number" ? loc.start.percentage : null;
        if (pct != null) setProgress(Math.round(pct * 100));
        if (cfi) {
          let pageNum: number | null = null;
          try { pageNum = book.locations.locationFromCfi(cfi) as unknown as number; } catch { /* ignore */ }
          await supabase.from("user_books").update({
            reader_cfi: cfi,
            reader_percent: pct,
            current_page: pageNum,
            total_pages: totalPages || null,
            shelf: "currently-reading",
          }).eq("id", ub.id);
          // Auto-log a reading session today (upsert per-book per-day)
          try {
            const { data: u } = await supabase.auth.getUser();
            if (u.user && ub.book?.id) {
              const today = new Date().toISOString().slice(0, 10);
              const { data: existing } = await supabase
                .from("reading_log")
                .select("id")
                .eq("user_id", u.user.id).eq("log_date", today).eq("book_id", ub.book.id)
                .maybeSingle();
              if (existing) {
                await supabase.from("reading_log").update({ pages: pageNum ?? null }).eq("id", existing.id);
              } else {
                await supabase.from("reading_log").insert({
                  user_id: u.user.id, book_id: ub.book.id, log_date: today, pages: pageNum ?? null,
                });
              }
            }
          } catch { /* ignore */ }
        }
      });
    })();

    return () => {
      cancelled = true;
      try { renditionRef.current?.destroy(); bookRef.current?.destroy(); } catch { /* ignore */ }
    };
  }, [ub?.epub_path, ub?.id, ub?.reader_cfi]);

  // Re-apply theme/font without remounting
  useEffect(() => {
    if (renditionRef.current) applyTheme(renditionRef.current, theme, fontSize);
    localStorage.setItem("reader-theme", theme);
    localStorage.setItem("reader-font-size", String(fontSize));
  }, [theme, fontSize]);

  // Keyboard navigation
  const next = useCallback(() => renditionRef.current?.next(), []);
  const prev = useCallback(() => renditionRef.current?.prev(), []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  async function handleUpload(file: File) {
    if (!ub) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const path = `${u.user.id}/${ub.id}-${Date.now()}.epub`;
      const { error: upErr } = await supabase.storage.from("epubs").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("user_books").update({ epub_path: path, shelf: "currently-reading" }).eq("id", ub.id);
      if (dbErr) throw dbErr;
      setUb({ ...ub, epub_path: path });
      toast.success("Uploaded — others can now read this edition too!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally { setUploading(false); }
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-periwinkle font-rounded text-midnight">loading your book…</div>;
  if (!ub) return <div className="grid min-h-screen place-items-center bg-periwinkle font-rounded text-midnight">Book not found.</div>;

  const t = THEMES[theme];

  return (
    <div className={`flex h-screen flex-col font-rounded ${t.body} transition-colors`}>
      {/* Header */}
      <header className="flex items-center justify-between border-b-2 border-midnight/10 bg-periwinkle px-3 py-2.5 text-white">
        <button onClick={() => navigate({ to: "/shelf" })} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-white/25">
          <ArrowLeft className="h-3.5 w-3.5" /> Shelf
        </button>
        <div className="min-w-0 px-2 text-center">
          <h1 className="line-clamp-1 font-chunky text-sm md:text-base">{ub.book?.title}</h1>
          <p className="line-clamp-1 font-hand text-[10px] text-white/85">{ub.book?.author}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowToc((v) => !v)} title="Contents" className="rounded-full bg-white/15 p-1.5 hover:bg-white/25">
            <List className="h-4 w-4" />
          </button>
          <div className="hidden items-center gap-1 rounded-full bg-white/15 p-1 md:flex">
            <button onClick={() => setFontSize((s) => Math.max(70, s - 10))} className="rounded-full px-1 hover:bg-white/20" title="Smaller text">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <Type className="h-3.5 w-3.5" />
            <span className="px-1 text-[10px] font-bold tabular-nums">{fontSize}%</span>
            <button onClick={() => setFontSize((s) => Math.min(180, s + 10))} className="rounded-full px-1 hover:bg-white/20" title="Larger text">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-0.5 rounded-full bg-white/15 p-1">
            <ThemeBtn active={theme === "light"} onClick={() => setTheme("light")} title="Light"><Sun className="h-3.5 w-3.5" /></ThemeBtn>
            <ThemeBtn active={theme === "sepia"} onClick={() => setTheme("sepia")} title="Sepia"><Coffee className="h-3.5 w-3.5" /></ThemeBtn>
            <ThemeBtn active={theme === "dark"} onClick={() => setTheme("dark")} title="Dark"><Moon className="h-3.5 w-3.5" /></ThemeBtn>
          </div>
          <span className="ml-1 hidden rounded-full bg-coral px-2.5 py-1 text-[10px] font-bold tabular-nums text-white md:inline">{progress}%</span>
        </div>
      </header>

      {!ub.epub_path ? (
        <UploadPanel onUpload={handleUpload} uploading={uploading} />
      ) : (
        <div className="relative flex flex-1 overflow-hidden" style={{ backgroundColor: t.bg }}>
          {/* TOC drawer */}
          {showToc && (
            <aside className="absolute left-0 top-0 z-20 h-full w-72 max-w-[80%] overflow-y-auto border-r-2 border-midnight/10 bg-white p-4 pop-shadow">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-chunky text-midnight">CONTENTS</h2>
                <button onClick={() => setShowToc(false)} className="rounded-full p-1 hover:bg-periwinkle/30">
                  <X className="h-4 w-4 text-midnight" />
                </button>
              </div>
              {toc.length === 0 && <p className="font-hand text-sm text-midnight/60">No contents found.</p>}
              <ul className="space-y-1">
                {toc.map((it, i) => (
                  <li key={i}>
                    <button
                      onClick={() => { renditionRef.current?.display(it.href); setShowToc(false); }}
                      className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-midnight hover:bg-periwinkle/30"
                    >
                      {it.label}
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
          )}

          <div ref={viewerRef} className="h-full w-full" />

          {/* Tap zones + buttons */}
          <button onClick={prev} aria-label="Previous page"
            className="absolute left-0 top-0 h-full w-16 cursor-w-resize bg-transparent group">
            <span className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-midnight/10 text-midnight opacity-0 transition group-hover:opacity-100">
              <ChevronLeft className="h-5 w-5" />
            </span>
          </button>
          <button onClick={next} aria-label="Next page"
            className="absolute right-0 top-0 h-full w-16 cursor-e-resize bg-transparent group">
            <span className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-midnight/10 text-midnight opacity-0 transition group-hover:opacity-100">
              <ChevronRight className="h-5 w-5" />
            </span>
          </button>
        </div>
      )}

      {/* Progress */}
      <div className="h-1.5 bg-periwinkle/20">
        <div className="h-full bg-coral transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function applyTheme(rendition: any, theme: Theme, fontSize: number) {
  const t = THEMES[theme];
  try {
    rendition.themes.override("color", t.color, true);
    rendition.themes.override("background", t.bg, true);
    rendition.themes.fontSize(`${fontSize}%`);
    rendition.themes.default({
      body: { color: t.color, background: t.bg, "line-height": "1.6", padding: "0 1rem" },
      a: { color: t.link },
      "p, li, div, span": { color: t.color },
    });
  } catch { /* ignore */ }
}

function ThemeBtn({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title}
      className={`rounded-full p-1.5 transition ${active ? "bg-coral text-white" : "text-white/85 hover:bg-white/20"}`}>
      {children}
    </button>
  );
}

function UploadPanel({ onUpload, uploading }: { onUpload: (f: File) => void; uploading: boolean }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-periwinkle/30 p-8">
      <label className="flex w-full max-w-md cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-4 border-dashed border-midnight/20 bg-white p-12 text-center pop-shadow hover:bg-butter/30">
        {uploading ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-coral" />
            <span className="font-hand text-midnight">uploading your book…</span>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-coral" />
            <span className="font-chunky text-xl text-midnight">Upload an .epub</span>
            <span className="text-sm text-midnight/65">
              Click or drop a file. Anyone else who adds this book will be able to read it too — sharing is caring!
            </span>
          </>
        )}
        <input
          type="file" accept=".epub,application/epub+zip" className="hidden"
          onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
        />
      </label>
    </div>
  );
}
