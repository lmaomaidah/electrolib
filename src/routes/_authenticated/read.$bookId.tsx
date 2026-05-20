import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, ArrowLeft, Upload, Loader2 } from "lucide-react";
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

function ReaderPage() {
  const { bookId } = Route.useParams();
  const navigate = useNavigate();
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<ReturnType<typeof ePub>["renderTo"] extends (...a: any[]) => infer R ? R : any>(null);
  const [ub, setUb] = useState<UB | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("user_books")
        .select("id,epub_path,reader_cfi,reader_percent,book:books(id,title,author)")
        .eq("id", bookId)
        .single();
      if (error) { toast.error(error.message); setLoading(false); return; }
      setUb(data as unknown as UB);
      setLoading(false);
    })();
  }, [bookId]);

  useEffect(() => {
    if (!ub?.epub_path || !viewerRef.current) return;
    let rendition: any;
    let book: any;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.storage.from("epubs").createSignedUrl(ub.epub_path!, 3600);
      if (error || !data) { toast.error("Could not load file"); return; }
      if (cancelled) return;

      book = ePub(data.signedUrl);
      rendition = book.renderTo(viewerRef.current!, {
        width: "100%", height: "100%", spread: "auto", flow: "paginated",
      });
      renditionRef.current = rendition;

      await book.ready;
      await rendition.display(ub.reader_cfi || undefined);

      await book.locations.generate(1600);
      const totalPages = book.locations.length();

      rendition.on("relocated", async (loc: any) => {
        const cfi = loc?.start?.cfi as string | undefined;
        const pct = typeof loc?.start?.percentage === "number" ? loc.start.percentage : null;
        if (pct != null) setProgress(Math.round(pct * 100));
        if (cfi) {
          let pageNum: number | null = null;
          try { pageNum = book.locations.locationFromCfi(cfi) as number; } catch { /* ignore */ }
          await supabase.from("user_books").update({
            reader_cfi: cfi,
            reader_percent: pct,
            current_page: pageNum,
            total_pages: totalPages || null,
            shelf: "currently-reading",
          }).eq("id", ub.id);
        }
      });
    })();

    return () => {
      cancelled = true;
      try { rendition?.destroy(); book?.destroy(); } catch { /* ignore */ }
    };
  }, [ub?.epub_path, ub?.id, ub?.reader_cfi]);

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
      toast.success("File uploaded — opening reader…");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally { setUploading(false); }
  }

  if (loading) return <div className="p-10 font-hand text-walnut">loading book…</div>;
  if (!ub) return <div className="p-10 font-hand text-walnut">Book not found.</div>;

  return (
    <div className="flex h-screen flex-col bg-aged">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate({ to: "/shelf" })} className="inline-flex items-center gap-1 font-serif text-sm text-walnut hover:text-mahogany">
          <ArrowLeft className="h-4 w-4" /> Shelf
        </button>
        <div className="text-center">
          <h1 className="font-display text-lg text-ink">{ub.book?.title}</h1>
          <p className="font-hand text-xs text-mahogany">{ub.book?.author}</p>
        </div>
        <div className="font-serif text-sm text-walnut/70 tabular-nums">{progress}%</div>
      </header>

      {!ub.epub_path ? (
        <UploadPanel onUpload={handleUpload} uploading={uploading} />
      ) : (
        <>
          <div className="relative flex-1 overflow-hidden bg-cream">
            <div ref={viewerRef} className="h-full w-full" />
            <button
              onClick={() => renditionRef.current?.prev()}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-walnut/60 p-3 text-aged hover:bg-walnut"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={() => renditionRef.current?.next()}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-walnut/60 p-3 text-aged hover:bg-walnut"
              aria-label="Next page"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
          <div className="h-1.5 bg-parchment">
            <div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }} />
          </div>
        </>
      )}
    </div>
  );
}

function UploadPanel({ onUpload, uploading }: { onUpload: (f: File) => void; uploading: boolean }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <label className="flex w-full max-w-md cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-walnut/30 bg-card p-12 text-center hover:bg-parchment/40">
        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-mahogany" />
            <span className="font-hand text-walnut">binding your manuscript…</span>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-mahogany" />
            <span className="font-display text-xl text-ink">Upload an .epub</span>
            <span className="font-serif text-sm text-muted-foreground">
              Drag and drop or click to choose. Your file stays private.
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
