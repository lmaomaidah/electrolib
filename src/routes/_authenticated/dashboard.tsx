import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Bell, Search, BookOpen, Highlighter, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — ElectroLibrary" }] }),
});

type Profile = { display_name: string | null; avatar_url: string | null; reading_goal: number | null };
type UserBook = {
  id: string; shelf: string; current_page: number; total_pages: number | null; spine_color: string | null;
  book: { id: string; title: string; author: string | null; cover_url: string | null; description: string | null };
};

function Dashboard() {
  const navigate = useNavigate();
  const [searchQ, setSearchQ] = useState("");
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
    <div className="min-h-screen bg-periwinkle font-rounded">
      <div className="mx-auto max-w-7xl px-4 py-8 pb-24 md:px-8 md:py-10">
        {/* Top bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = searchQ.trim();
            navigate({ to: "/discover", search: q ? { q } : undefined });
          }}
          className="flex items-center justify-between gap-3"
        >
          <div className="flex flex-1 max-w-md items-center gap-2 rounded-full border-2 border-white/50 bg-white px-4 py-2 pop-shadow">
            <Search className="h-4 w-4 text-midnight/50" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search a book, author, vibe…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-midnight/40"
            />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="grid h-10 w-10 place-items-center rounded-full bg-white/80 text-coral pop-shadow hover:bg-white"><Bell className="h-4 w-4" /></button>
            <div className="flex items-center gap-2 rounded-full bg-coral px-3 py-1.5 pop-shadow">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-butter font-chunky text-midnight text-sm">
                {name[0]?.toUpperCase()}
              </div>
              <span className="hidden text-sm font-bold text-white sm:block">{name}</span>
            </div>
          </div>
        </form>

        {/* Hero greeting */}
        <div className="mt-8 rounded-3xl bg-coral p-6 pop-shadow text-white tilt-l-sm md:p-8">
          <p className="font-hand text-white/90">Happy reading,</p>
          <h1 className="font-chunky text-[clamp(2.25rem,7vw,4.5rem)] leading-[0.9] text-stroke-white text-shadow-pop">
            {name.toUpperCase()}!
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/85">
            {books.length === 0
              ? "Your shelves are waiting. Add your first book to begin a beautiful little library."
              : `You have ${books.length} ${books.length === 1 ? "book" : "books"} on your shelves. Keep the story going.`}
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr,1fr]">
          <section>
            {current ? <CurrentlyReading b={current} /> : <EmptyCurrent />}

            <h2 className="mt-10 font-chunky text-2xl text-midnight">POPULAR NOW</h2>
            {popular.length > 0 ? (
              <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
                {popular.map((b) => <BookCover key={b.id} b={b} />)}
              </div>
            ) : (
              <p className="mt-4 text-sm text-midnight/70">
                Nothing here yet — head to your <Link to="/shelf" className="font-bold text-coral underline">shelf</Link> to add a book.
              </p>
            )}

            <div className="mt-10 flex items-baseline justify-between">
              <h2 className="font-chunky text-2xl text-midnight">YOUR COLLECTIONS</h2>
              <Link to="/shelf" className="font-hand text-sm text-coral hover:underline">see all →</Link>
            </div>
            {books.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
                {books.slice(0, 3).map((b) => <SeriesCard key={`series-${b.id}`} b={b} />)}
              </div>
            ) : (
              <p className="mt-4 text-sm italic text-midnight/60">
                Your collections will appear here as your library grows.
              </p>
            )}
          </section>

          <aside className="space-y-5">
            <div className="rounded-3xl bg-butter p-5 pop-shadow tilt-r-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-chunky text-xl text-midnight">READING GOAL</h3>
                <span className="font-hand text-sm text-coral">{profile?.reading_goal ?? 12} books</span>
              </div>
              <ProgressRing read={books.filter((b) => b.shelf === "read").length} goal={profile?.reading_goal ?? 12} />
            </div>

            <ReadingSchedule />
            <FriendsFeed />

            <Link
              to="/shelf"
              className="group flex items-center justify-between rounded-3xl bg-midnight p-5 text-white pop-shadow transition hover:bg-midnight/90"
            >
              <div>
                <p className="font-chunky text-xl">VISIT YOUR SHELF</p>
                <p className="font-hand text-sm text-white/70">see every spine, find a new chapter</p>
              </div>
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}

function SeriesCard({ b }: { b: UserBook }) {
  return (
    <Link
      to="/books/$bookId"
      params={{ bookId: b.book.id }}
      className="group overflow-hidden rounded-2xl bg-white pop-shadow transition hover:-translate-y-1"
    >
      <div
        className="flex h-32 items-end p-3"
        style={{ background: `linear-gradient(135deg, ${b.spine_color ?? "#5C3D2E"}, #2d1d14)` }}
      >
        <span className="font-chunky text-lg leading-tight text-white drop-shadow">{b.book.title}</span>
      </div>
      <div className="p-3">
        <p className="font-hand text-xs text-coral">collection</p>
        <p className="line-clamp-1 text-sm text-midnight">{b.book.author ?? "Various authors"}</p>
      </div>
    </Link>
  );
}

function ReadingSchedule() {
  const today = new Date();
  const month = today.toLocaleString("en-US", { month: "long" });
  const year = today.getFullYear();
  const days = useMemo(() => {
    const first = new Date(year, today.getMonth(), 1);
    const last = new Date(year, today.getMonth() + 1, 0);
    const startPad = first.getDay();
    return { startPad, total: last.getDate(), today: today.getDate() };
  }, [today, year]);

  return (
    <div className="rounded-3xl bg-white p-5 pop-shadow">
      <div className="flex items-center justify-between">
        <h3 className="font-chunky text-xl text-midnight">SCHEDULE</h3>
        <span className="font-hand text-sm text-coral">{month} {year}</span>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <span key={i} className="font-bold text-[10px] uppercase tracking-wide text-midnight/50">{d}</span>
        ))}
        {Array.from({ length: days.startPad }).map((_, i) => <span key={`pad-${i}`} />)}
        {Array.from({ length: days.total }).map((_, i) => {
          const day = i + 1;
          const isToday = day === days.today;
          const hasSession = [3, 8, 12, 17, 22, 25].includes(day);
          return (
            <span
              key={day}
              className={`grid h-7 place-items-center rounded-full text-xs font-bold ${
                isToday
                  ? "bg-coral text-white pop-shadow"
                  : hasSession
                  ? "bg-butter text-midnight"
                  : "text-midnight/55 hover:bg-periwinkle/30"
              }`}
            >
              {day}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function FriendsFeed() {
  const items = [
    { name: "Eliza", color: "#E8433A", icon: Highlighter, action: "highlighted in", book: "The Bell Jar", note: "\u201cI felt like a horse in a circus.\u201d" },
    { name: "Marcus", color: "#7A9E7E", icon: BookOpen, action: "is reading", book: "Pachinko", note: "halfway through, ch. 14" },
    { name: "Junia", color: "#8FB6E3", icon: MessageCircle, action: "reviewed", book: "Stoner", note: "\u201cQuiet, devastating, perfect.\u201d" },
  ];
  return (
    <div className="rounded-3xl bg-white p-5 pop-shadow">
      <div className="flex items-center justify-between">
        <h3 className="font-chunky text-xl text-midnight">FRIEND FEED</h3>
        <span className="font-hand text-xs text-coral">today</span>
      </div>
      <ul className="mt-3 space-y-3">
        {items.map((f) => (
          <li key={f.name} className="flex gap-3">
            <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full font-chunky text-white text-sm pop-shadow" style={{ backgroundColor: f.color }}>
              {f.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-midnight">
                <span className="font-bold">{f.name}</span>
                <span className="text-midnight/60"> {f.action} </span>
                <span className="italic">{f.book}</span>
              </p>
              <p className="mt-0.5 flex items-start gap-1 font-hand text-xs text-coral">
                <f.icon className="h-3 w-3 flex-shrink-0 translate-y-0.5" />
                <span className="line-clamp-2">{f.note}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CurrentlyReading({ b }: { b: UserBook }) {
  const total = b.total_pages ?? 300;
  const pct = Math.min(100, Math.round(((b.current_page ?? 0) / total) * 100));
  return (
    <div className="grid gap-6 rounded-3xl bg-white p-6 pop-shadow md:grid-cols-[auto,1fr] md:p-7">
      <div
        className="mx-auto h-48 w-32 flex-shrink-0 overflow-hidden rounded-md border-2 border-midnight/10 md:h-60 md:w-40"
        style={{ backgroundColor: b.spine_color ?? "#5C3D2E" }}
      >
        {b.book.cover_url ? (
          <img src={b.book.cover_url} alt={b.book.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col justify-between p-3 text-white">
            <span className="font-chunky text-sm leading-tight">{b.book.title}</span>
            <span className="text-xs opacity-80">{b.book.author}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col justify-center">
        <span className="font-hand text-sm text-coral">currently reading</span>
        <Link to="/books/$bookId" params={{ bookId: b.book.id }} className="mt-1 block font-chunky text-3xl text-midnight hover:text-coral">{b.book.title}</Link>
        <p className="mt-1 text-sm italic text-midnight/60">by {b.book.author ?? "Unknown"}</p>
        {b.book.description && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-midnight/80">{b.book.description}</p>}
        <div className="mt-5">
          <div className="flex items-baseline justify-between font-hand text-sm">
            <span className="text-coral">{b.current_page ?? 0} / {total} pages</span>
            <span className="text-midnight/60">{pct}%</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-periwinkle/30">
            <div className="h-full rounded-full bg-coral transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <Link
          to="/read/$bookId" params={{ bookId: b.id }}
          className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-coral px-5 py-2 text-sm font-bold uppercase tracking-wider text-white pop-shadow hover:bg-coral-deep"
        >
          Open reader →
        </Link>
      </div>
    </div>
  );
}

function EmptyCurrent() {
  return (
    <div className="rounded-3xl border-2 border-dashed border-white/60 bg-white/40 p-10 text-center">
      <p className="font-chunky text-2xl text-midnight">NOTHING ON THE NIGHTSTAND</p>
      <p className="mt-2 text-sm text-midnight/70">Add a book to your shelf and mark it as currently reading.</p>
      <Link to="/shelf" className="mt-5 inline-flex rounded-full bg-coral px-5 py-2 font-bold text-white pop-shadow hover:bg-coral-deep">
        Open my shelf →
      </Link>
    </div>
  );
}

function BookCover({ b }: { b: UserBook }) {
  return (
    <Link
      to="/books/$bookId"
      params={{ bookId: b.book.id }}
      className="group flex w-32 flex-shrink-0 flex-col"
    >
      <div
        className="flex h-44 w-32 flex-col justify-between overflow-hidden rounded-md border-2 border-midnight/10 p-3 pop-shadow transition group-hover:-translate-y-1"
        style={{ backgroundColor: b.spine_color ?? "#5C3D2E", color: "#FAF7F2" }}
      >
        {b.book.cover_url ? (
          <img src={b.book.cover_url} alt={b.book.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <>
            <span className="font-chunky text-sm leading-tight">{b.book.title}</span>
            <span className="text-[10px] opacity-80">{b.book.author}</span>
          </>
        )}
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-bold text-midnight">{b.book.title}</p>
      <p className="text-xs italic text-midnight/60">{b.book.author}</p>
    </Link>
  );
}

function ProgressRing({ read, goal }: { read: number; goal: number }) {
  const pct = Math.min(100, Math.round((read / Math.max(goal, 1)) * 100));
  const r = 38; const c = 2 * Math.PI * r;
  return (
    <div className="mt-3 flex items-center gap-4">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="10" />
        <circle cx="48" cy="48" r={r} fill="none" stroke="#E8433A" strokeWidth="10"
          strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} strokeLinecap="round"
          transform="rotate(-90 48 48)" />
        <text x="48" y="55" textAnchor="middle" style={{ fontFamily: "Bagel Fat One", fill: "#1a1a2e", fontSize: 22 }}>{read}</text>
      </svg>
      <div className="text-sm text-midnight/75">
        <p>{read} of {goal} books read this year</p>
        <p className="mt-1 font-hand text-coral">{pct}% of your goal</p>
      </div>
    </div>
  );
}
