-- Production supervisors record who is passed out on a machine, and who is on it this shift.
begin;

create table if not exists public.operator_passouts (
  id uuid primary key default gen_random_uuid(),
  crew_member_id uuid not null references public.crew_members (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  expires_on date not null,
  unique (crew_member_id, asset_id)
);

create table if not exists public.shift_machine_operators (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shift_records (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  crew_member_id uuid not null references public.crew_members (id) on delete cascade,
  unique (shift_id, asset_id)
);

create index if not exists operator_passouts_asset_idx on public.operator_passouts (asset_id);
create index if not exists shift_machine_operators_shift_idx on public.shift_machine_operators (shift_id);

alter table public.operator_passouts enable row level security;
alter table public.shift_machine_operators enable row level security;
revoke all on public.operator_passouts, public.shift_machine_operators from anon, public;
grant select, insert, update, delete on public.operator_passouts, public.shift_machine_operators to authenticated;

create policy operator_passouts_select on public.operator_passouts
  for select to authenticated
  using ((select public.app_user_role()) in ('management', 'training', 'production'));
create policy operator_passouts_insert on public.operator_passouts
  for insert to authenticated
  with check ((select public.app_user_role()) in ('training', 'production'));
create policy operator_passouts_update on public.operator_passouts
  for update to authenticated
  using ((select public.app_user_role()) in ('training', 'production'))
  with check ((select public.app_user_role()) in ('training', 'production'));
create policy operator_passouts_delete on public.operator_passouts
  for delete to authenticated
  using ((select public.app_user_role()) in ('training', 'production'));

create policy shift_machine_operators_select on public.shift_machine_operators
  for select to authenticated
  using ((select public.app_user_role()) in ('management', 'training', 'production'));
create policy shift_machine_operators_insert on public.shift_machine_operators
  for insert to authenticated
  with check ((select public.app_user_role()) = 'production');
create policy shift_machine_operators_update on public.shift_machine_operators
  for update to authenticated
  using ((select public.app_user_role()) = 'production')
  with check ((select public.app_user_role()) = 'production');
create policy shift_machine_operators_delete on public.shift_machine_operators
  for delete to authenticated
  using ((select public.app_user_role()) = 'production');

update public.crew_members
set department = 'Production', trade = 'Operator'
where display_name in (
  'Mark Campbell', 'Steve Parker', 'Ryan Dent', 'Sean O''Connor', 'Jess Brennan', 'John Dode'
);

insert into public.operator_passouts (crew_member_id, asset_id, expires_on)
select c.id, a.id, current_date + v.days
from (values
  ('Mark Campbell', 'DT-041', 400),
  ('Mark Campbell', 'DT-042', 400),
  ('Mark Campbell', 'EX-201', 180),
  ('Steve Parker', 'DT-046', 200),
  ('Steve Parker', 'DT-048', -1),
  ('Ryan Dent', 'SH-301', 10),
  ('Ryan Dent', 'WL-050', 300),
  ('Sean O''Connor', 'DT-044', 250),
  ('Sean O''Connor', 'WT-021', 90),
  ('Jess Brennan', 'DT-041', -5)
) as v(person, fleet, days)
join public.crew_members c on c.display_name = v.person
join public.assets a on a.fleet_id = v.fleet
on conflict (crew_member_id, asset_id) do update set expires_on = excluded.expires_on;

update public.crew_authorisations ca
set expires_on = current_date - 3
from public.crew_members c, public.authorisations a
where ca.crew_member_id = c.id
  and ca.authorisation_id = a.id
  and c.display_name = 'John Dode'
  and a.name = 'Hot work';

insert into public.shift_machine_operators (shift_id, asset_id, crew_member_id)
select s.id, a.id, c.id
from public.shift_records s
join public.assets a on a.fleet_id = 'DT-041'
join public.crew_members c on c.display_name = 'Mark Campbell'
where s.status = 'ACTIVE'
on conflict (shift_id, asset_id) do update set crew_member_id = excluded.crew_member_id;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'operator_passouts'
  ) then
    alter publication supabase_realtime add table public.operator_passouts;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shift_machine_operators'
  ) then
    alter publication supabase_realtime add table public.shift_machine_operators;
  end if;
end $$;

commit;
