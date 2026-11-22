-- Site words the workshop wants kept as spoken on site.
-- Live rows are added over time. The app also ships a built-in list.

begin;

create table if not exists public.site_glossary (
  id uuid primary key default gen_random_uuid(),
  term text not null unique check (length(trim(term)) between 2 and 80),
  spoken_alias text check (spoken_alias is null or length(trim(spoken_alias)) between 2 and 120),
  source text not null default 'auto' check (source in ('auto', 'manual')),
  created_at timestamptz not null default now()
);

create unique index if not exists site_glossary_term_lower_idx
  on public.site_glossary (lower(term));

alter table public.site_glossary enable row level security;

revoke all on public.site_glossary from anon, public;
grant select, insert, update, delete on public.site_glossary to authenticated;

create policy site_glossary_select on public.site_glossary
  for select to authenticated
  using (true);

create policy site_glossary_insert on public.site_glossary
  for insert to authenticated
  with check (true);

create policy site_glossary_update on public.site_glossary
  for update to authenticated
  using (true)
  with check (true);

create policy site_glossary_delete on public.site_glossary
  for delete to authenticated
  using (true);

commit;
