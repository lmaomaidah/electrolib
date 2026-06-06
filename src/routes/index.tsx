import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BookOpen, BookMarked, Calendar, Users, Search, ChevronLeft, ChevronRight,
  Github, Linkedin, ArrowRight, Star, ChevronDown, Library,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "ElectroLibrary — your loud, friendly public library" },
      { name: "description", content: "Browse books, join clubs, and find your next great read. A bright, chaotic, friendly little corner of the internet for readers." },
    ],
  }),
});

const NAV: { label: string; to: string }[] = [
  { label: "Home", to: "/" },
  { label: "Discover", to: "/discover" },
  { label: "Shelf", to: "/shelf" },
  { label: "Clubs", to: "/clubs" },
  { label: "Friends", to: "/friends" },
];

function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden font-rounded">
      {/* ───── Top blue section ───── */}
      <section className="relative bg-periwinkle pb-24">
        {/* clouds */}
        <Clouds />

        {/* navbar */}
        <header className="relative z-20 mx-auto max-w-6xl px-4 pt-5">
          <nav className="flex items-center justify-between rounded-full bg-coral px-3 py-2 pop-shadow">
            <Link to="/" className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 font-chunky text-white text-sm">
              <Library className="h-4 w-4" />
              EL
            </Link>
            <ul className="hidden items-center gap-1 md:flex">
              {NAV.map((n, i) => (
                <li key={n.label}>
                  <Link
                    to={n.to}
                    className={`flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-semibold text-white/95 transition hover:bg-white/15 ${
                      i === 0 ? "bg-white/20" : ""
                    }`}
                  >
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to="/auth"
              className="rounded-full bg-white px-4 py-1.5 text-sm font-bold text-coral hover:bg-butter"
            >
              Sign in
            </Link>
          </nav>
        </header>

        {/* Social sidebar */}
        <aside className="absolute left-3 top-44 z-20 hidden flex-col items-center gap-3 md:flex">
          <div className="rounded-full border-2 border-white/60 bg-coral px-2 py-3 text-[10px] font-bold tracking-[0.25em] text-white [writing-mode:vertical-rl] rotate-180">
            FOLLOW US
          </div>
          <a href="https://github.com/lmaomaidah" target="_blank" rel="noreferrer noopener" aria-label="GitHub" className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-coral pop-shadow hover:scale-110 transition">
            <Github className="h-4 w-4" />
          </a>
          <a href="https://linkedin.com/in/maidahjunaid" target="_blank" rel="noreferrer noopener" aria-label="LinkedIn" className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-coral pop-shadow hover:scale-110 transition">
            <Linkedin className="h-4 w-4" />
          </a>
        </aside>

        {/* Hero */}
        <div className="relative z-10 mx-auto mt-14 max-w-5xl px-4 text-center">
          <p className="font-hand text-lg text-white/90">Welcome to</p>
          <h1
            className="font-chunky text-[clamp(2.75rem,9vw,7.5rem)] leading-[0.9] text-coral text-stroke-white text-shadow-pop"
            style={{ filter: "drop-shadow(0 6px 0 rgba(0,0,0,0.15))" }}
          >
            <span className="block">ELECTRO</span>
            <span className="block">LIBRARY!</span>
          </h1>
          <p className="mt-2 font-bold uppercase tracking-widest text-white/85 text-xs">
            A loud, friendly little library · est. 2025
          </p>
        </div>

        {/* Three cards */}
        <div className="relative z-10 mx-auto mt-10 max-w-5xl px-12">
          <CardArrow side="left" />
          <CardArrow side="right" />
          <div className="grid gap-5 md:grid-cols-3">
            <Link to="/discover" className="block">
              <FeatureCard tilt="tilt-l-sm" label="BROWSE" title="BROWSE BOOKS" emoji={<BookStack />} body="Search 12,000+ titles. Filter by genre, mood, or what your neighbor just returned." />
            </Link>
            <Link to="/friends" className="block">
              <FeatureCard tilt="" label="JOIN" title="JOIN A CLUB" emoji={<ClubScene />} body="Weekly meetups for mystery lovers, poetry rookies, and everyone in between." />
            </Link>
            <Link to="/dashboard" className="block">
              <FeatureCard tilt="tilt-r-sm" label="EXPLORE" title="EXPLORE EVENTS" emoji={<EventScene />} body="Author talks, kids' story hour, late-night silent reading nights." />
            </Link>
          </div>
        </div>

        {/* Mid section */}
        <div className="relative z-10 mx-auto mt-20 grid max-w-5xl gap-8 px-6 md:grid-cols-2">
          <div className="self-center">
            <p className="font-hand text-coral text-sm">The library in a sentence...</p>
            <p className="mt-2 font-chunky text-2xl italic leading-tight text-white md:text-3xl">
              "A loud, friendly building full of free stories — open to absolutely everyone."
            </p>
          </div>
          <div className="relative">
            <div className="rounded-3xl bg-teal p-6 pop-shadow text-white">
              <h3 className="font-chunky text-3xl">WELCOME!</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/85">
                Hello! I'm the head librarian. Whether you're a five-a-week reader or
                haven't cracked a spine since high school — there's a shelf here with
                your name on it.
              </p>
              <Link
                to="/auth"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-butter px-4 py-2 text-sm font-bold text-midnight hover:bg-white"
              >
                Get my card <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Big illustrated scene + contact card */}
        <div className="relative z-10 mx-auto mt-16 max-w-5xl px-6">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-b from-periwinkle-deep to-periwinkle pop-shadow">
            <LibraryScene />
            <div className="absolute -bottom-4 right-4 w-80 max-w-[85%] rounded-2xl bg-white p-5 pop-shadow tilt-r-sm md:right-8">
              <EpubRequestForm />
            </div>
          </div>
          <p className="ml-4 mt-8 font-bold uppercase tracking-wider text-white/80 text-xs">
            Wait! Have you ever heard of…
          </p>
        </div>
      </section>

      {/* ───── Giant brand break ───── */}
      <section className="relative bg-periwinkle pb-2">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="font-chunky text-center text-[clamp(3rem,11vw,9rem)] leading-[0.85] text-shadow-pop">
            <span className="block text-coral text-stroke-white">ELECTRO</span>
            <span className="block">
              <span className="text-butter text-stroke-white">LIB</span>
              <span className="text-white text-stroke-ink">RARY</span>
              <span className="text-coral text-stroke-white">!</span>
            </span>
          </h2>
          <p className="mt-2 text-center font-hand text-lg text-coral">New arrivals every week!</p>
        </div>
      </section>

      {/* ───── Dark section ───── */}
      <section className="relative bg-midnight px-6 py-20">
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-2 md:items-center">
          {/* floor-plan illustration */}
          <div className="rounded-3xl border-2 border-white/10 bg-gradient-to-br from-coral/30 to-periwinkle/20 p-6 tilt-l-sm">
            <FloorPlan />
          </div>

          {/* what's yours */}
          <div>
            <h2 className="font-chunky text-5xl text-butter leading-none text-shadow-pop md:text-6xl">
              WHAT'S<br />YOURS?
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-butter">Choose your librarian</p>
                <p className="mt-1.5 text-sm leading-relaxed text-white/75">
                  Match with a real human guide. Tell us what you loved last — we'll tell you what to read next.
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-butter">OUR RATING</p>
                <p className="mt-1.5 flex items-center gap-1 font-chunky text-2xl text-white">
                  5 STARS!
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="h-4 w-4 fill-butter text-butter" />
                  ))}
                </p>
                <Link to="/auth" className="mt-3 inline-block rounded-full bg-coral px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-coral-deep">
                  Join now
                </Link>
              </div>
            </div>

            <div className="mt-8">
              <p className="font-chunky text-xl text-coral">READ AT YOUR OWN PACE!</p>
              <p className="mt-1 text-sm text-white/65">Meet a few of our regulars.</p>
              <div className="mt-3 flex -space-x-2">
                {["#E8433A", "#F5C842", "#8FB6E3", "#7d9b76", "#C4A4A4"].map((c, i) => (
                  <div key={i} className="grid h-10 w-10 place-items-center rounded-full border-2 border-midnight font-chunky text-xs text-white pop-shadow" style={{ backgroundColor: c }}>
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Cast of readers */}
        <div className="relative mx-auto mt-24 max-w-5xl">
          <div className="absolute inset-x-0 -top-3 mx-auto h-3 w-40 rounded-full bg-coral/40 blur-xl" />
          <div className="flex items-end justify-center gap-4 md:gap-8">
            <Reader color="#F5C842" hat="#fff" name="MAE" delay="0s" />
            <Reader color="#E8433A" hat="#fff" name="JUN" delay="0.6s" big />
            <Reader color="#7A9E7E" hat="#fff" name="ARI" delay="1.2s" />
          </div>
          <div className="mt-2 h-3 rounded-full bg-coral/30" />
          <div className="mt-10 text-center">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-coral px-7 py-3 font-chunky text-white text-lg pop-shadow hover:bg-coral-deep transition"
            >
              EXPLORE CATALOGUE <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>

        {/* Footer image strip */}
        <div className="mx-auto mt-20 grid max-w-5xl grid-cols-3 gap-3">
          {[
            { bg: "bg-coral", el: <div className="font-chunky text-white text-2xl text-center leading-tight">EL<br/>LIB</div> },
            { bg: "bg-periwinkle-deep", el: <FloorThumb /> },
            { bg: "bg-butter", el: <ReadingCornerThumb /> },
          ].map((t, i) => (
            <div key={i} className={`grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl border-2 border-white/10 ${t.bg}`}>
              {t.el}
            </div>
          ))}
        </div>
      </section>

      {/* Footer bar */}
      <footer className="flex items-center justify-between bg-coral px-6 py-3">
        <span className="text-xs font-bold uppercase tracking-wider text-white">
          Powered by ElectroLibrary
        </span>
        <BookMarked className="h-4 w-4 text-white" />
      </footer>
    </div>
  );
}

/* ───────── Bits & illustrations ───────── */

function Clouds() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {[
        { left: "8%", top: "12%", size: 60, d: "0s" },
        { left: "78%", top: "8%", size: 90, d: "1.2s" },
        { left: "28%", top: "4%", size: 50, d: "2s" },
        { left: "62%", top: "22%", size: 70, d: "3s" },
      ].map((c, i) => (
        <div
          key={i}
          className="bob-slow absolute rounded-full bg-white/70 blur-[2px]"
          style={{
            left: c.left, top: c.top, width: c.size, height: c.size * 0.6,
            animationDelay: c.d,
          }}
        />
      ))}
    </div>
  );
}

function CardArrow({ side }: { side: "left" | "right" }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      className={`absolute top-1/2 z-10 hidden -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-white pop-shadow text-coral hover:bg-butter md:grid ${
        side === "left" ? "left-1" : "right-1"
      }`}
      aria-label={side}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

function FeatureCard({
  tilt, label, title, body, emoji,
}: { tilt: string; label: string; title: string; body: string; emoji: React.ReactNode }) {
  return (
    <div className={`group rounded-3xl bg-white p-5 pop-shadow transition hover:-translate-y-1 ${tilt}`}>
      <div className="grid h-32 place-items-center rounded-2xl bg-periwinkle/30">
        <div className="bob">{emoji}</div>
      </div>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-coral">{label}</p>
      <h3 className="font-chunky text-xl text-midnight">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-midnight/65">{body}</p>
    </div>
  );
}

function BookStack() {
  return (
    <div className="flex items-end gap-1">
      {[
        { c: "#E8433A", h: 56, w: 14 },
        { c: "#F5C842", h: 70, w: 16 },
        { c: "#7A9E7E", h: 48, w: 14 },
        { c: "#8FB6E3", h: 64, w: 15 },
      ].map((b, i) => (
        <div key={i} className="rounded-sm border-2 border-midnight pop-shadow" style={{ height: b.h, width: b.w, backgroundColor: b.c }} />
      ))}
    </div>
  );
}

function ClubScene() {
  return (
    <div className="flex items-end gap-1">
      {["#E8433A", "#F5C842", "#7A9E7E"].map((c, i) => (
        <div key={i} className="flex flex-col items-center">
          <div className="h-6 w-6 rounded-full border-2 border-midnight" style={{ backgroundColor: c }} />
          <div className="-mt-1 h-8 w-8 rounded-t-2xl border-2 border-midnight bg-white" />
        </div>
      ))}
    </div>
  );
}

function EventScene() {
  return (
    <div className="relative">
      <Calendar className="h-16 w-16 text-coral" strokeWidth={2.5} />
      <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-butter font-chunky text-xs text-midnight border-2 border-midnight">
        12
      </span>
    </div>
  );
}

function LibraryScene() {
  return (
    <svg viewBox="0 0 600 260" className="block w-full">
      {/* floor */}
      <rect x="0" y="200" width="600" height="60" fill="#3d2817" />
      <rect x="0" y="200" width="600" height="6" fill="#5C3D2E" />
      {/* shelves */}
      {[60, 180, 300, 420].map((x, i) => (
        <g key={i}>
          <rect x={x} y="80" width="100" height="120" fill="#5C3D2E" rx="4" />
          {[90, 115, 140, 165].map((sy) => (
            <g key={sy}>
              <rect x={x + 5} y={sy} width="90" height="22" fill="#3d2817" />
              {Array.from({ length: 9 }).map((_, b) => (
                <rect
                  key={b} x={x + 8 + b * 10} y={sy + 2} width="9" height="18"
                  fill={["#E8433A", "#F5C842", "#7A9E7E", "#8FB6E3", "#C4A4A4"][(i + b) % 5]}
                />
              ))}
            </g>
          ))}
        </g>
      ))}
      {/* librarian */}
      <g transform="translate(280,150)">
        <circle cx="0" cy="-10" r="14" fill="#F5C842" stroke="#111" strokeWidth="2" />
        <rect x="-14" y="4" width="28" height="36" rx="6" fill="#E8433A" stroke="#111" strokeWidth="2" />
        <rect x="-8" y="40" width="16" height="14" fill="#3d2817" />
      </g>
      {/* lamp */}
      <circle cx="540" cy="60" r="18" fill="#F5C842" opacity="0.7" />
    </svg>
  );
}

function FloorPlan() {
  return (
    <svg viewBox="0 0 240 180" className="block w-full">
      <rect x="4" y="4" width="232" height="172" fill="none" stroke="#fff" strokeWidth="2" rx="8" />
      {[20, 50, 80, 110, 140].map((y) => (
        <rect key={y} x="20" y={y} width="80" height="14" fill="#E8433A" opacity="0.8" />
      ))}
      <rect x="130" y="20" width="90" height="60" fill="#F5C842" opacity="0.7" rx="4" />
      <text x="175" y="55" textAnchor="middle" className="font-chunky" fill="#111" fontSize="12">READING</text>
      <rect x="130" y="100" width="40" height="40" fill="#7A9E7E" opacity="0.7" rx="4" />
      <rect x="180" y="100" width="40" height="40" fill="#8FB6E3" opacity="0.7" rx="4" />
      <circle cx="60" cy="155" r="8" fill="#fff" />
      <text x="60" y="158" textAnchor="middle" fill="#111" fontSize="9" fontWeight="700">YOU</text>
    </svg>
  );
}

function Reader({ color, hat, name, delay, big }: { color: string; hat: string; name: string; delay: string; big?: boolean }) {
  const h = big ? 220 : 180;
  return (
    <div className="bob flex flex-col items-center" style={{ animationDelay: delay }}>
      <div className="relative" style={{ width: h * 0.8, height: h }}>
        {/* hat */}
        <div className="absolute left-1/2 top-0 h-7 w-16 -translate-x-1/2 rounded-t-full border-2 border-midnight" style={{ backgroundColor: hat }} />
        <div className="absolute left-1/2 top-5 h-3 w-20 -translate-x-1/2 rounded-full border-2 border-midnight" style={{ backgroundColor: hat }} />
        {/* head */}
        <div className="absolute left-1/2 top-7 h-16 w-16 -translate-x-1/2 rounded-full border-2 border-midnight bg-[#f4d6b8]">
          <div className="absolute left-3 top-6 h-1.5 w-1.5 rounded-full bg-midnight" />
          <div className="absolute right-3 top-6 h-1.5 w-1.5 rounded-full bg-midnight" />
          <div className="absolute left-1/2 top-10 h-1 w-3 -translate-x-1/2 rounded-full bg-coral" />
        </div>
        {/* body */}
        <div className="absolute bottom-0 left-1/2 h-24 w-24 -translate-x-1/2 rounded-t-3xl border-2 border-midnight" style={{ backgroundColor: color }} />
        {/* book in hand */}
        <div className="absolute bottom-2 left-1/2 h-10 w-14 -translate-x-1/2 rounded-sm border-2 border-midnight bg-white">
          <div className="mx-auto mt-1 h-0.5 w-8 rounded bg-midnight/40" />
          <div className="mx-auto mt-1 h-0.5 w-8 rounded bg-midnight/40" />
          <div className="mx-auto mt-1 h-0.5 w-6 rounded bg-midnight/40" />
        </div>
      </div>
      <span className="mt-2 font-chunky text-xs text-white">{name}</span>
    </div>
  );
}

function FloorThumb() {
  return (
    <div className="grid grid-cols-4 gap-1 p-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="h-4 rounded-sm" style={{ backgroundColor: ["#E8433A", "#F5C842", "#fff"][i % 3] }} />
      ))}
    </div>
  );
}

function ReadingCornerThumb() {
  return (
    <div className="flex flex-col items-center">
      <BookOpen className="h-10 w-10 text-midnight" strokeWidth={2.5} />
      <span className="mt-1 font-chunky text-[10px] text-midnight">COZY CORNER</span>
    </div>
  );
}
