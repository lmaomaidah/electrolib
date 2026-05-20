import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Sparkles, BookMarked, Flame, Bookmark, type LucideIcon } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "The Shelf — Your stories, beautifully shelved" },
      { name: "description", content: "A warm, literary home for your reading life. Build your personal library, track your progress, and let every book find its place on the shelf." },
    ],
  }),
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Floating book particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className="float-particle absolute h-6 w-4 rounded-sm opacity-40"
            style={{
              left: `${(i * 7.3) % 100}%`,
              backgroundColor: ["#8B4513", "#5C3D2E", "#C9A84C", "#7A9E7E", "#C4A4A4"][i % 5],
              animationDelay: `${i * 1.6}s`,
              animationDuration: `${18 + (i % 5) * 3}s`,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-8">
        <Link to="/" className="flex items-center gap-2">
          <BookMarked className="h-6 w-6 text-walnut" />
          <span className="font-display text-2xl text-walnut">The Shelf</span>
        </Link>
        <Link
          to="/auth"
          className="rounded-full border border-walnut/30 bg-aged px-5 py-2 text-sm font-serif text-walnut transition hover:bg-walnut hover:text-aged"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <main className="relative z-10 mx-auto grid max-w-7xl gap-12 px-6 pb-24 pt-12 md:grid-cols-2 md:gap-8 md:pt-20">
        <div className="flex flex-col justify-center">
          <span className="font-hand text-lg text-mahogany">— a quiet corner for readers —</span>
          <h1 className="mt-4 text-5xl leading-[1.05] text-ink md:text-7xl">
            Your stories,
            <br />
            <span className="text-mahogany">beautifully shelved.</span>
          </h1>
          <p className="mt-6 max-w-md font-serif text-lg leading-relaxed text-muted-foreground">
            Build a candlelit library of every book you've loved. Track your progress,
            keep your reviews, and watch your shelf grow — one spine at a time.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              to="/auth"
              className="group inline-flex items-center gap-2 rounded-full bg-mahogany px-7 py-3.5 font-serif text-aged shadow-lg shadow-mahogany/30 transition hover:-translate-y-0.5 hover:bg-walnut hover:shadow-xl"
            >
              <Sparkles className="h-4 w-4" />
              Start your library
            </Link>
            <span className="font-hand text-sm text-muted-foreground">
              free · import your Goodreads CSV
            </span>
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-6 text-sm font-serif text-muted-foreground">
            <Feature icon={BookOpen} text="Track progress" />
            <Feature icon={Flame} text="Warm reader UI" />
            <Feature icon={Bookmark} text="Personal reviews" />
          </div>
        </div>

        {/* Illustrated shelf */}
        <div className="relative flex items-end justify-center">
          <div className="relative w-full max-w-md">
            <div className="shelf-backboard rounded-t-3xl px-6 pt-10">
              {[0, 1].map((row) => (
                <div key={row} className="relative">
                  <div className="shelf-glow absolute -top-6 left-0 right-0 h-12" />
                  <div className="flex items-end justify-center gap-1.5 px-3 pb-1">
                    {sampleBooks(row).map((b, i) => (
                      <div
                        key={i}
                        className="book-spine flex flex-col items-center justify-between py-3"
                        style={{
                          width: b.w,
                          height: b.h,
                          backgroundColor: b.color,
                          color: b.text,
                        }}
                      >
                        <span className="font-accent text-[10px] tracking-wider [writing-mode:vertical-rl] rotate-180 opacity-90">
                          {b.title}
                        </span>
                        <span className="font-serif text-[8px] opacity-70">{b.author}</span>
                      </div>
                    ))}
                  </div>
                  <div className="shelf-plank h-5" />
                </div>
              ))}
            </div>
            <div className="absolute -bottom-3 left-3 right-3 h-3 rounded-b-2xl bg-black/30 blur-md" />
          </div>
        </div>
      </main>

      {/* Feature cards */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-20">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: BookMarked, title: "Every shelf, your way", body: "Currently reading, read, want-to-read. Drag a book between shelves with a click." },
            { icon: BookOpen, title: "A reader that feels like paper", body: "Upload an .epub and read in a warm, two-page spread. Progress saves itself." },
            { icon: Sparkles, title: "Import from Goodreads", body: "Drop your CSV and we'll bind every spine onto your shelf — no fuss." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="group relative overflow-hidden rounded-3xl border border-walnut/15 bg-aged/80 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gold/20 blur-2xl transition group-hover:bg-gold/30" />
              <span className="inline-grid h-11 w-11 place-items-center rounded-2xl bg-mahogany text-aged shadow-md">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-2xl text-walnut">{title}</h3>
              <p className="mt-2 font-serif text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quote footer */}
      <footer className="relative z-10 mx-auto max-w-3xl px-6 pb-20 text-center">
        <div className="mx-auto mb-6 h-px w-24 bg-walnut/20" />
        <p className="font-serif italic text-xl leading-relaxed text-walnut">
          &ldquo;A room without books is like a body without a soul.&rdquo;
        </p>
        <p className="mt-2 font-hand text-mahogany">— Cicero</p>
      </footer>
    </div>
  );
}

function Feature({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-parchment text-mahogany shadow-sm">
        <Icon className="h-4 w-4" />
      </span>
      <span>{text}</span>
    </div>
  );
}

function sampleBooks(row: number) {
  const a = [
    { title: "MOBY DICK", author: "Melville", color: "#5C3D2E", text: "#C9A84C", w: 26, h: 150 },
    { title: "PRIDE & PREJUDICE", author: "Austen", color: "#C4A4A4", text: "#1A1208", w: 22, h: 140 },
    { title: "WUTHERING HEIGHTS", author: "Brontë", color: "#1A1208", text: "#C9A84C", w: 18, h: 158 },
    { title: "DUNE", author: "Herbert", color: "#C9A84C", text: "#1A1208", w: 32, h: 152 },
    { title: "1984", author: "Orwell", color: "#7A9E7E", text: "#FAF7F2", w: 20, h: 145 },
    { title: "GATSBY", author: "Fitzgerald", color: "#8B4513", text: "#FAF7F2", w: 24, h: 150 },
  ];
  const b = [
    { title: "BELOVED", author: "Morrison", color: "#7A9E7E", text: "#FAF7F2", w: 22, h: 148 },
    { title: "JANE EYRE", author: "Brontë", color: "#5C3D2E", text: "#FAF7F2", w: 28, h: 156 },
    { title: "LITTLE WOMEN", author: "Alcott", color: "#C9A84C", text: "#1A1208", w: 30, h: 142 },
    { title: "EAST OF EDEN", author: "Steinbeck", color: "#1A1208", text: "#C9A84C", w: 26, h: 152 },
    { title: "MIDDLEMARCH", author: "Eliot", color: "#C4A4A4", text: "#1A1208", w: 20, h: 150 },
    { title: "DRACULA", author: "Stoker", color: "#8B4513", text: "#C9A84C", w: 24, h: 158 },
  ];
  return row === 0 ? a : b;
}
