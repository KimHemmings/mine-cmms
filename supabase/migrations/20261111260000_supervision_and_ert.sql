-- Who is still in training, and which tickets mark a trainer assessor or an ERT member.
begin;

create table if not exists public.crew_supervision (
  crew_member_id uuid primary key references public.crew_members (id) on delete cascade,
  level text not null check (level in ('close', 'minimal')),
  skill text not null check (length(trim(skill)) between 1 and 80),
  assessor_id uuid references public.crew_members (id) on delete set null,
  check (assessor_id is null or assessor_id <> crew_member_id)
);

alter table public.crew_supervision enable row level security;
revoke all on public.crew_supervision from anon, public;
grant select, insert, update, delete on public.crew_supervision to authenticated;

create policy crew_supervision_select on public.crew_supervision
  for select to authenticated
  using ((select public.app_user_role()) in ('management', 'training', 'production'));
create policy crew_supervision_insert on public.crew_supervision
  for insert to authenticated
  with check ((select public.app_user_role()) = 'training');
create policy crew_supervision_update on public.crew_supervision
  for update to authenticated
  using ((select public.app_user_role()) = 'training')
  with check ((select public.app_user_role()) = 'training');
create policy crew_supervision_delete on public.crew_supervision
  for delete to authenticated
  using ((select public.app_user_role()) = 'training');

create or replace function public.require_trainer_assessor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assessor_id is null or not exists (
    select 1
    from public.crew_authorisations ca
    join public.authorisations a on a.id = ca.authorisation_id
    where ca.crew_member_id = new.assessor_id
      and a.name = 'Trainer assessor'
      and ca.expires_on >= current_date
  ) then
    raise exception 'Name a current trainer assessor';
  end if;
  return new;
end;
$$;

drop trigger if exists crew_supervision_assessor on public.crew_supervision;
create trigger crew_supervision_assessor
  before insert or update on public.crew_supervision
  for each row execute function public.require_trainer_assessor();

revoke execute on function public.require_trainer_assessor() from public, anon, authenticated;

insert into public.authorisations (name, sort_order, kind)
values ('Trainer assessor', 30, 'AUTHORISATION'), ('ERT', 31, 'AUTHORISATION')
on conflict (name) do nothing;

insert into public.crew_authorisations (crew_member_id, authorisation_id, expires_on)
select c.id, a.id, current_date + 400
from public.crew_members c
join public.authorisations a on a.name = 'Trainer assessor'
where c.display_name in ('Steve Parker', 'Tom Walsh', 'Mark Campbell', 'Hannah Brooks')
   or c.id in (
     select id from public.crew_members
     where trade = 'Leading Hand' and department = 'Workshop' and active
     order by display_name
     limit 1
   )
on conflict (crew_member_id, authorisation_id) do nothing;

insert into public.crew_authorisations (crew_member_id, authorisation_id, expires_on)
select c.id, a.id, current_date + 400
from public.crew_members c
join public.authorisations a on a.name = 'ERT'
where c.display_name in (
  'Dan Hughes', 'Carla Mendes', 'Sean O''Connor', 'Jess Brennan', 'John Dode', 'Aaron Price', 'Lucy Nguyen'
)
on conflict (crew_member_id, authorisation_id) do nothing;

insert into public.crew_supervision (crew_member_id, level, skill, assessor_id)
select trainee.id, v.level, v.skill, assessor.id
from (values
  ('Mia Kovacs', 'close', 'Haul truck', 'Steve Parker'),
  ('Erin Blake', 'minimal', 'Blast drill', 'Tom Walsh'),
  ('Amy Chen', 'minimal', 'Haul truck', 'Steve Parker')
) as v(trainee, level, skill, assessor_name)
join public.crew_members trainee on trainee.display_name = v.trainee
join public.crew_members assessor on assessor.display_name = v.assessor_name
on conflict (crew_member_id) do update
  set level = excluded.level, skill = excluded.skill, assessor_id = excluded.assessor_id;

insert into public.crew_supervision (crew_member_id, level, skill, assessor_id)
select apprentice.id, 'close', 'Fitting trade', lead.id
from public.crew_members apprentice
join lateral (
  select id from public.crew_members
  where trade = 'Leading Hand' and department = 'Workshop' and active
  order by display_name
  limit 1
) lead on true
where apprentice.trade = 'Apprentice' and apprentice.active
on conflict (crew_member_id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crew_supervision'
  ) then
    alter publication supabase_realtime add table public.crew_supervision;
  end if;
end $$;

commit;
