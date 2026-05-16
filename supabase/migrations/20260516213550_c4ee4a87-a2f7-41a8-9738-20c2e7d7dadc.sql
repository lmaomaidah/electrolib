
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  reading_goal int default 12,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- Books catalog
create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  cover_url text,
  description text,
  isbn text,
  genre text,
  avg_rating numeric,
  created_at timestamptz not null default now()
);

alter table public.books enable row level security;

create policy "Books viewable by authenticated"
  on public.books for select to authenticated using (true);

create policy "Authenticated can insert books"
  on public.books for insert to authenticated with check (true);

-- Shelf labels
create type public.shelf_label as enum ('read', 'currently-reading', 'want-to-read');

create table public.user_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  shelf public.shelf_label not null default 'want-to-read',
  rating int check (rating between 0 and 5),
  review text,
  current_page int default 0,
  total_pages int,
  date_read date,
  is_favorite boolean not null default false,
  spine_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id)
);

alter table public.user_books enable row level security;

create policy "Users view own shelf"
  on public.user_books for select to authenticated using (auth.uid() = user_id);

create policy "Users insert own shelf"
  on public.user_books for insert to authenticated with check (auth.uid() = user_id);

create policy "Users update own shelf"
  on public.user_books for update to authenticated using (auth.uid() = user_id);

create policy "Users delete own shelf"
  on public.user_books for delete to authenticated using (auth.uid() = user_id);

create index on public.user_books (user_id, shelf);

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger set_user_books_updated_at before update on public.user_books
  for each row execute procedure public.set_updated_at();

create trigger set_profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
