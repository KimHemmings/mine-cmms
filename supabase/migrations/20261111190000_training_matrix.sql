-- Training authorisations. Training edits the matrix. Supervisors and production can read it.
begin;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('fitter', 'management', 'training', 'production'));

create table if not exists public.authorisations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  sort_order integer not null default 0
);

create table if not exists public.crew_authorisations (
  id uuid primary key default gen_random_uuid(),
  crew_member_id uuid not null references public.crew_members (id) on delete cascade,
  authorisation_id uuid not null references public.authorisations (id) on delete cascade,
  expires_on date not null,
  unique (crew_member_id, authorisation_id)
);

create index if not exists crew_authorisations_member_idx
  on public.crew_authorisations (crew_member_id);

alter table public.authorisations enable row level security;
alter table public.crew_authorisations enable row level security;
revoke all on public.authorisations, public.crew_authorisations from anon, public;
grant select, insert, update, delete on public.authorisations, public.crew_authorisations to authenticated;

create policy authorisations_select on public.authorisations
  for select to authenticated
  using ((select public.app_user_role()) in ('management', 'training', 'production'));
create policy authorisations_insert on public.authorisations
  for insert to authenticated
  with check ((select public.app_user_role()) = 'training');
create policy authorisations_update on public.authorisations
  for update to authenticated
  using ((select public.app_user_role()) = 'training')
  with check ((select public.app_user_role()) = 'training');
create policy authorisations_delete on public.authorisations
  for delete to authenticated
  using ((select public.app_user_role()) = 'training');

create policy crew_authorisations_select on public.crew_authorisations
  for select to authenticated
  using ((select public.app_user_role()) in ('management', 'training', 'production'));
create policy crew_authorisations_insert on public.crew_authorisations
  for insert to authenticated
  with check ((select public.app_user_role()) = 'training');
create policy crew_authorisations_update on public.crew_authorisations
  for update to authenticated
  using ((select public.app_user_role()) = 'training')
  with check ((select public.app_user_role()) = 'training');
create policy crew_authorisations_delete on public.crew_authorisations
  for delete to authenticated
  using ((select public.app_user_role()) = 'training');

-- Training and production can read the board. They cannot change jobs, machines, or notes.
do $$
declare t text;
begin
  foreach t in array array[
    'assets', 'machine_work_orders', 'work_order_parts', 'defect_watchlist',
    'asset_history_notes', 'downtime_logs', 'outstanding_parts', 'specials_on_order',
    'work_order_assignments'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_workshop_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_workshop_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_workshop_delete', t);
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated with check ((select public.app_user_role()) in (''fitter'', ''management''))',
      t || '_workshop_insert', t);
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated using ((select public.app_user_role()) in (''fitter'', ''management'')) with check ((select public.app_user_role()) in (''fitter'', ''management''))',
      t || '_workshop_update', t);
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using ((select public.app_user_role()) in (''fitter'', ''management''))',
      t || '_workshop_delete', t);
  end loop;
end $$;

insert into public.authorisations (name, sort_order) values
  ('Truck operation', 1),
  ('High voltage', 2),
  ('Working at heights', 3),
  ('Hot work', 4),
  ('Confined space', 5)
on conflict (name) do nothing;

-- Sample holdings so the traffic lights and the matrix can be clicked through.
insert into public.crew_authorisations (crew_member_id, authorisation_id, expires_on)
select c.id, a.id, current_date + 400
from public.crew_members c
join public.authorisations a on a.name = 'Truck operation'
where c.active
on conflict (crew_member_id, authorisation_id) do nothing;

insert into public.crew_authorisations (crew_member_id, authorisation_id, expires_on)
select c.id, a.id, current_date + 180
from public.crew_members c
join public.authorisations a on a.name in ('High voltage', 'Working at heights', 'Hot work')
where c.active and c.trade <> 'Apprentice'
on conflict (crew_member_id, authorisation_id) do nothing;

insert into public.crew_authorisations (crew_member_id, authorisation_id, expires_on)
select c.id, a.id, current_date - 1
from public.crew_members c
join public.authorisations a on a.name = 'High voltage'
where c.display_name = 'Dave Kelly'
on conflict (crew_member_id, authorisation_id) do update set expires_on = excluded.expires_on;

insert into public.crew_authorisations (crew_member_id, authorisation_id, expires_on)
select c.id, a.id, current_date + 12
from public.crew_members c
join public.authorisations a on a.name = 'Working at heights'
where c.display_name = 'Pete Lawson'
on conflict (crew_member_id, authorisation_id) do update set expires_on = excluded.expires_on;

insert into public.crew_authorisations (crew_member_id, authorisation_id, expires_on)
select c.id, a.id, current_date - 4
from public.crew_members c
join public.authorisations a on a.name = 'Confined space'
where c.display_name = 'Emma Reid'
on conflict (crew_member_id, authorisation_id) do update set expires_on = excluded.expires_on;

insert into public.crew_authorisations (crew_member_id, authorisation_id, expires_on)
select c.id, a.id, current_date + 18
from public.crew_members c
join public.authorisations a on a.name = 'Working at heights'
where c.display_name = 'Bill Turner'
on conflict (crew_member_id, authorisation_id) do update set expires_on = excluded.expires_on;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'authorisations'
  ) then
    alter publication supabase_realtime add table public.authorisations;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crew_authorisations'
  ) then
    alter publication supabase_realtime add table public.crew_authorisations;
  end if;
end $$;

commit;
