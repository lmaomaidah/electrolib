# The Shelf — Feature & Polish Pass

Big batch of upgrades. I'll ship in 4 slices so each is verifiable. Say "go" to start slice 1, or tell me to reorder / drop items.

## Slice 1 — Landing + Contact + Friends scroll fix
- **Landing header nav**: replace decorative links with real clickable buttons — `Shelf`, `Discover`, `Clubs`, `Friends`, `Reader`, `Sign in`. Smooth-scroll anchors for `#features` / `#contact` too.
- **Contact form**: new section on landing that posts to a new `epub_requests` table (title, author, message, optional email). Admin sees these in the admin panel. Copy tells users "request specific ePubs here — admin will source them."
- **Friends page**: both "Find readers" and "Friend activity" columns get proper scroll containers with sticky headers so they never balloon.

## Slice 2 — Realistic shelf + Book info redesign + Delete shelf + Shared ePubs
- **Shelf UI**: rebuild wooden shelf — real wood-grain gradient planks with end brackets, brass-tone bookends, ambient shadow under each shelf row, spines with cloth/leather variants, gilded titles, subtle wear. Still on periwinkle wall + coral theme. Realistic but stylized.
- **Book info page**: editorial redesign — big cover with shadow, tilted metadata card, description in serif column, shelf/rating/review controls in a sidebar, "Who else has this" strip.
- **Delete full shelf**: destructive button in Settings + Shelf toolbar with confirm dialog → wipes all `user_books` for current user.
- **Shared ePubs via Discover**: when any user uploads an ePub for a book, any other user who adds that book to their shelf inherits access (already partially via `get_shared_epub_path` — surface it clearly with a "Free ePub available" badge on Discover + Book detail).

## Slice 3 — ePub reader upgrade + Calendar + Analytics + Ratings
- **ePub reader**: fix loading, add persistent progress bar, keyboard arrows, tap zones, chapter jump menu, bookmark, font family + size + line-height controls, sepia/light/dark, remember position per book, "resume from Shelf" reliability.
- **Interactive calendar**: replace static widget with a real calendar where users click a date to log "read today" or attach a book. Shows streaks + which book on which day (`reading_log` table).
- **Analytics — user side**: on dashboard, show personal avg rating + interactive chart with daily/weekly/monthly/yearly toggle (pages read + books finished).
- **Analytics — admin side**: fix avg rating calc (was mixing feedback rating with book ratings). Add filters, top readers table, top books, retention over time, and drill-down tooltips.

## Slice 4 — Clubs like subreddits + Profile comments/activity + Admin user mgmt
- **Clubs → subreddit-style**: each club page gets a feed of posts (title + body + optional book link), upvotes, threaded comments, sort by hot/new/top. Club creator is auto-moderator. Admin or creator can promote members to moderator. Mods can pin, remove posts, remove members. Styled on-theme (coral accents, chunky headers, periwinkle cards) — prettier than reddit.
- **Profile page**: friends can comment on each other's walls (already have `profile_comments` — surface it properly), plus an activity timeline (books added, finished, rated, reviewed). Others can reply to any activity item.
- **Admin user management**: in admin panel, list all users with actions — promote/demote admin, promote/demote moderator (per club), delete user (removes profile + cascades their data).

## Technical notes
- New tables: `epub_requests`, `reading_log`, `club_posts`, `club_post_comments`, `club_post_votes`. Each with proper GRANTs + RLS.
- Extend `club_members.role` with `moderator`.
- Reader upgrade stays on `epubjs`, adds proper cleanup + `ResizeObserver` for responsive rendition.
- Calendar uses existing shadcn `Calendar` with custom day renderers.
- All new UI uses existing periwinkle/coral/butter/midnight tokens — no new palette.

Total: ~15 new/edited routes, 5 migrations, 1 new storage-free feature (requests). No new external services.
