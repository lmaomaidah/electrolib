import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Bell, Search, BookOpen, Highlighter, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — The Shelf" }] }),
});

type Profile = { display_name: string | null; avatar_url: string | null; reading_goal: number | null };
type UserBook = {
  id: string; shelf: string; current_page: number; total_pages: number | null; spine_color: string | null;
  book: { id: string; title: string; author: string | null; cover_url: string | null; description: string | null };
};

function Dashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Profile | null> => {
      const { data } = await supabase.from("profiles").select("display_name,avatar_url,reading_goal").eq("id", userId!).maybeSingle();
      return data;
    },
  });

  const { data: books = [] } = useQuery({
    queryKey: ["dashboard-books", userId],
    enabled: !!userId,
    queryFn: async (): Promise<UserBook[]> => {
      const { data } = await supabase
        .from("user_books")
        .select("id,shelf,current_page,total_pages,spine_color,book:books(id,title,author,cover_url,description)")
        .eq("user_id", userId!)
        .order("updated_at", { ascending: false })
        .limit(20);
      return (data ?? []) as unknown as UserBook[];
    },
  });

  const current = books.find((b) => b.shelf === "currently-reading") ?? books[0];
  const popular = books.filter((b) => b.id !== current?.id).slice(0, 8);
  const name = profile?.display_name ?? "reader";

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 pb-24 md:py-12">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 rounded-full border border-border bg-aged px-4 py-2.5 max-w-md">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search book name, author, edition…"
            className="flex-1 bg-transparent font-serif text-sm outline-none placeholder:text-muted-foreground/70"
          />
        </div>
        <div className="flex items-center gap-3">
          <button className="rounded-full p-2 text-walnut/70 hover:bg-aged"><Bell className="h-5 w-5" /></button>
          <div className="flex items-center gap-2 rounded-full border border-border bg-aged px-3 py-1.5">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-mahogany font-display text-aged text-sm">
              {name[0]?.toUpperCase()}
            </div>
            <span className="hidden font-serif text-sm text-walnut sm:block">{name}</span>
          </div>
        </div>
      </div>

      {/* Greeting */}
      <div className="mt-10 grid gap-10 lg:grid-cols-[1.5fr,1fr]">
        <section>
          <h1 className="font-display text-5xl text-ink md:text-6xl">
            Happy reading,
            <br />
            <span className="text-mahogany">{name}</span>
          </h1>
          <p className="mt-4 max-w-xl font-serif text-muted-foreground">
            {books.length === 0
              ? "Your shelves are waiting. Add your first book to begin a beautiful little library."
              : `You have ${books.length} ${books.length === 1 ? "book" : "books"} on your shelves. Keep the story going.`}
          </p>

          {current ? <CurrentlyReading b={current} /> : <EmptyCurrent />}

          {/* Popular now */}
          <h2 className="mt-12 font-display text-2xl text-walnut">Recent additions</h2>
          {popular.length > 0 ? (
            <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
              {popular.map((b) => (
                <BookCover key={b.id} b={b} />
              ))}
            </div>
          ) : (
            <p className="mt-4 font-serif text-sm text-muted-foreground">
              Nothing here yet — head to your <Link to="/shelf" className="text-mahogany underline">shelf</Link> to add a book.
            </p>
          )}
        </section>

        {/* Right rail */}
        <aside className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-walnut">Reading goal</h3>
              <span className="font-hand text-sm text-mahogany">{profile?.reading_goal ?? 12} books</span>
            </div>
            <ProgressRing read={books.filter((b) => b.shelf === "read").length} goal={profile?.reading_goal ?? 12} />
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="font-display text-lg text-walnut">A note from the library</h3>
            <p className="mt-2 font-serif text-sm italic leading-relaxed text-muted-foreground">
              “We read to know we're not alone.”
            </p>
            <p className="mt-1 font-hand text-sm text-mahogany">— C.S. Lewis</p>
          </div>

          <Link
            to="/shelf"
            className="group flex items-center justify-between rounded-2xl bg-mahogany p-5 text-aged shadow-md transition hover:bg-walnut"
          >
            <div>
              <p className="font-display text-xl">Visit your shelf</p>
              <p className="font-hand text-sm opacity-80">see every spine, find a new chapter</p>
            </div>
            <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
          </Link>
        </aside>
      </div>
    </div>
  );
}

function CurrentlyReading({ b }: { b: UserBook }) {
  const total = b.total_pages ?? 300;
  const pct = Math.min(100, Math.round((b.current_page / total) * 100));
  return (
    <div className="mt-8 grid gap-6 rounded-3xl border border-border bg-card p-6 shadow-lg shadow-walnut/5 md:grid-cols-[auto,1fr]">
      <div
        className="book-spine mx-auto h-48 w-32 flex-shrink-0 rounded-md md:h-60 md:w-40"
        style={{ backgroundColor: b.spine_color ?? "#5C3D2E" }}
      >
        {b.book.cover_url ? (
          <img src={b.book.cover_url} alt={b.book.title} className="h-full w-full rounded-md object-cover" />
        ) : (
          <div className="flex h-full flex-col justify-between p-3 text-aged">
            <span className="font-display text-sm leading-tight">{b.book.title}</span>
            <span className="font-serif text-xs opacity-80">{b.book.author}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col justify-center">
        <span className="font-hand text-sm text-mahogany">currently reading</span>
        <h2 className="mt-1 font-display text-3xl text-ink">{b.book.title}</h2>
        <p className="mt-1 font-serif text-sm text-muted-foreground">by {b.book.author ?? "Unknown"}</p>
        {b.book.description && (
          <p className="mt-3 line-clamp-3 font-serif text-sm leading-relaxed text-foreground/80">{b.book.description}</p>
        )}
        <div className="mt-5">
          <div className="flex items-baseline justify-between font-hand text-sm">
            <span className="text-mahogany">{b.current_page} / {total} pages</span>
            <span className="text-muted-foreground">{pct}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-parchment">
            <div className="h-full rounded-full bg-mahogany transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyCurrent() {
  return (
    <div className="mt-8 rounded-3xl border border-dashed border-walnut/30 bg-aged p-10 text-center">
      <p className="font-display text-2xl text-walnut">Nothing on the nightstand</p>
      <p className="mt-2 font-serif text-sm text-muted-foreground">
        Add a book to your shelf and mark it as currently reading.
      </p>
      <Link to="/shelf" className="mt-5 inline-flex rounded-full bg-mahogany px-5 py-2 font-serif text-sm text-aged hover:bg-walnut">
        Open my shelf
      </Link>
    </div>
  );
}

function BookCover({ b }: { b: UserBook }) {
  return (
    <Link
      to="/shelf"
      className="group flex w-32 flex-shrink-0 flex-col"
    >
      <div
        className="book-spine flex h-44 w-32 flex-col justify-between rounded-md p-3 transition group-hover:-translate-y-1"
        style={{ backgroundColor: b.spine_color ?? "#5C3D2E", color: "#FAF7F2" }}
      >
        {b.book.cover_url ? (
          <img src={b.book.cover_url} alt={b.book.title} className="h-full w-full rounded object-cover" />
        ) : (
          <>
            <span className="font-display text-sm leading-tight">{b.book.title}</span>
            <span className="font-serif text-[10px] opacity-80">{b.book.author}</span>
          </>
        )}
      </div>
      <p className="mt-2 line-clamp-1 font-serif text-sm text-walnut">{b.book.title}</p>
      <p className="font-serif text-xs italic text-muted-foreground">{b.book.author}</p>
    </Link>
  );
}

function ProgressRing({ read, goal }: { read: number; goal: number }) {
  const pct = Math.min(100, Math.round((read / Math.max(goal, 1)) * 100));
  const r = 38; const c = 2 * Math.PI * r;
  return (
    <div className="mt-3 flex items-center gap-4">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--color-parchment)" strokeWidth="8" />
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--color-mahogany)" strokeWidth="8"
          strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} strokeLinecap="round"
          transform="rotate(-90 48 48)" />
        <text x="48" y="54" textAnchor="middle" className="font-display" style={{ fontFamily: "Henny Penny", fill: "var(--color-walnut)", fontSize: 22 }}>{read}</text>
      </svg>
      <div className="font-serif text-sm text-muted-foreground">
        <p>{read} of {goal} books read this year</p>
        <p className="mt-1 font-hand text-mahogany">{pct}% of your goal</p>
      </div>
    </div>
  );
}
