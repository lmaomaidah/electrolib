
drop policy "Authenticated can insert books" on public.books;
create policy "Authenticated can insert books"
  on public.books for insert to authenticated with check (auth.uid() is not null);
