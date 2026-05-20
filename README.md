# The Shelf — ElectroLibrary

A warm, candlelit library for your reading life. Build a personal shelf of every book you've loved, import your Goodreads CSV, upload `.epub` files and read them in-app, and follow friends to see what they're reading.

> Live demo: <https://electrolib.lovable.app>

---

## Features

- **The Shelf** — a wooden, multi-row library where every book is a 3D spine with hover lift and tooltips.
- **ePub reader** — upload `.epub` files, two-page spread, page-turn animations, live progress sync to the cloud.
- **Resume** — jump straight back to the exact CFI / page you left off.
- **Currently reading** — one-click move books in and out of your active stack.
- **Goodreads CSV import** — drop your `goodreads_library_export.csv` and the whole library walks home.
- **Friends feed** — follow other readers, watch their highlights and progress.
- **Dashboard** — currently reading, popular now, new series collection, reading goal ring, calendar, friends activity.
- **Themes** — Candlelight (light) and Midnight Study (dark).
- **Auth** — email + password and Google OAuth (via the Lovable broker).

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | TanStack Start v1 (Vite 7, React 19, SSR) |
| Styling | Tailwind v4 with semantic design tokens in `src/styles.css` |
| Backend | Lovable Cloud (Postgres, Auth, Storage, RLS) |
| ePub | `epubjs` |
| Routing | TanStack Router (file-based, `src/routes/`) |
| Data | `@tanstack/react-query` |
| Icons | `lucide-react` |
| Runtime | Cloudflare Workers (nodejs_compat) |

---

## Local development

```bash
bun install
bun run dev
```

Then open <http://localhost:5173>. The Lovable Cloud backend (database, auth, storage) is wired automatically via environment variables in `.env`.

### Useful scripts

```bash
bun run dev        # start the Vite dev server
bun run build      # production build
bun run preview    # preview the production build locally
bun run lint       # run ESLint
```

---

## Project structure

```
src/
  routes/                file-based routes
    __root.tsx           html shell, providers, fonts
    index.tsx            landing page
    auth.tsx             sign in / sign up
    _authenticated.tsx   sidebar layout for signed-in users
    _authenticated/
      dashboard.tsx      home / dashboard
      shelf.tsx          the library wall
      discover.tsx       Open Library search + add to shelf
      friends.tsx        follows + activity feed
      settings.tsx       theme + reading goal
      read.$bookId.tsx   ePub reader
  components/            shared UI (theme-provider, shadcn primitives)
  integrations/
    supabase/            auto-generated Lovable Cloud clients (DO NOT EDIT)
    lovable/             auth broker
  styles.css             design tokens + custom utilities
supabase/migrations/     database schema history
```

---

## Database

Tables (all RLS-protected):

- `profiles` — display name, avatar, reading goal, theme, currently-reading pointer.
- `books` — shared catalog (title, author, cover, ISBN, average rating, genre, description).
- `user_books` — a user's relationship to a book: shelf, rating, review, current page, `epub_path`, `reader_cfi`, `reader_percent`.
- `follows` — follower / followee edges for the friends feed.

Storage:

- `epubs` (private) — uploaded `.epub` files, scoped by user id.

---

## Deployment

The app is deployed on Lovable. Click **Publish** in the Lovable editor to ship a new build. The stable URLs are:

- Production: `https://electrolib.lovable.app`
- Preview: `https://project--cd1c0a00-0f66-4241-9436-a1d2a48076a6-dev.lovable.app`

---

## License

MIT — read freely, share freely.
