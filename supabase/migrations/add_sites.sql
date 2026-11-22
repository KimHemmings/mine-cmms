-- The sites row already exists (code is required). Open it to signed-in users
-- and let a superintendent rename it for a pitch.

update public.sites
set name = 'Bowen Basin Open-Cut Operations'
where id = '00000000-0000-0000-0000-000000000001'
  and name = 'Primary Open-Cut Operation';

alter table public.sites enable row level security;
revoke all on public.sites from anon, public;
grant select, update on public.sites to authenticated;

drop policy if exists "Authenticated users can read the site" on public.sites;
create policy "Authenticated users can read the site"
  on public.sites for select to authenticated
  using (true);

drop policy if exists "Superintendents can rename the site" on public.sites;
create policy "Superintendents can rename the site"
  on public.sites for update to authenticated
  using (public.app_user_access_level() >= 4)
  with check (public.app_user_access_level() >= 4);
