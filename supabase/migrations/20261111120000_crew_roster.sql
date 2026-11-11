-- Crew roster: managed crew list, who is on each shift, and crew assigned to each work order.
begin;

create table if not exists public.crew_members (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(trim(display_name)) > 0),
  employee_id text unique,
  trade text not null default 'Fitter',
  panel text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.shift_crew (
  shift_id uuid not null references public.shift_records(id) on delete cascade,
  crew_member_id uuid not null references public.crew_members(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (shift_id, crew_member_id)
);
create index if not exists shift_crew_member_idx on public.shift_crew(crew_member_id);

create table if not exists public.work_order_assignments (
  work_order_id uuid not null references public.machine_work_orders(id) on delete cascade,
  crew_member_id uuid not null references public.crew_members(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (work_order_id, crew_member_id)
);
create index if not exists work_order_assignments_member_idx on public.work_order_assignments(crew_member_id);

alter table public.crew_members enable row level security;
alter table public.shift_crew enable row level security;
alter table public.work_order_assignments enable row level security;

revoke all on public.crew_members from anon;
revoke all on public.shift_crew from anon;
revoke all on public.work_order_assignments from anon;

-- Everyone active can read the crew (the job picker needs it); only management maintains it.
create policy crew_members_select on public.crew_members
  for select to authenticated using (public.app_user_role() is not null);
create policy crew_members_insert on public.crew_members
  for insert to authenticated with check (public.app_user_role() = 'management');
create policy crew_members_update on public.crew_members
  for update to authenticated
  using (public.app_user_role() = 'management')
  with check (public.app_user_role() = 'management');

create policy shift_crew_select on public.shift_crew
  for select to authenticated using (public.app_user_role() is not null);
create policy shift_crew_insert on public.shift_crew
  for insert to authenticated with check (public.app_user_role() = 'management');
create policy shift_crew_delete on public.shift_crew
  for delete to authenticated using (public.app_user_role() = 'management');

-- Fitters can add work orders, so any active user may set the crew on a job.
create policy work_order_assignments_select on public.work_order_assignments
  for select to authenticated using (public.app_user_role() is not null);
create policy work_order_assignments_insert on public.work_order_assignments
  for insert to authenticated with check (public.app_user_role() is not null);
create policy work_order_assignments_delete on public.work_order_assignments
  for delete to authenticated using (public.app_user_role() is not null);

-- machine_work_orders.fitter_assigned stays the display text used by the handover, SAP notes and AI summary.
create or replace function public.refresh_work_order_fitters(p_work_order_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.machine_work_orders wo
  set fitter_assigned = coalesce(
    (select string_agg(c.display_name, ', ' order by c.display_name)
       from public.work_order_assignments a
       join public.crew_members c on c.id = a.crew_member_id
      where a.work_order_id = p_work_order_id),
    'Unassigned')
  where wo.id = p_work_order_id;
$$;

create or replace function public.sync_work_order_fitters()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_work_order_fitters(coalesce(new.work_order_id, old.work_order_id));
  return null;
end;
$$;

drop trigger if exists work_order_assignments_sync on public.work_order_assignments;
create trigger work_order_assignments_sync
  after insert or delete on public.work_order_assignments
  for each row execute function public.sync_work_order_fitters();

create or replace function public.sync_renamed_crew_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wo uuid;
begin
  for v_wo in
    select a.work_order_id
    from public.work_order_assignments a
    join public.machine_work_orders wo on wo.id = a.work_order_id
    where a.crew_member_id = new.id and wo.status = 'OPEN'
  loop
    perform public.refresh_work_order_fitters(v_wo);
  end loop;
  return null;
end;
$$;

drop trigger if exists crew_members_rename_sync on public.crew_members;
create trigger crew_members_rename_sync
  after update of display_name on public.crew_members
  for each row
  when (old.display_name is distinct from new.display_name)
  execute function public.sync_renamed_crew_member();

-- Replace a job's crew in one transaction (runs as the caller, so RLS applies).
create or replace function public.set_work_order_crew(p_work_order_id uuid, p_crew_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.work_order_assignments
  where work_order_id = p_work_order_id
    and crew_member_id <> all (coalesce(p_crew_ids, '{}'));

  insert into public.work_order_assignments (work_order_id, crew_member_id)
  select p_work_order_id, unnest(coalesce(p_crew_ids, '{}'))
  on conflict do nothing;

  -- Clears free-text names left over from before the crew roster existed.
  if coalesce(array_length(p_crew_ids, 1), 0) = 0 then
    update public.machine_work_orders
    set fitter_assigned = 'Unassigned'
    where id = p_work_order_id;
  end if;
end;
$$;

revoke execute on function public.refresh_work_order_fitters(uuid) from public, anon, authenticated;
revoke execute on function public.sync_work_order_fitters() from public, anon, authenticated;
revoke execute on function public.sync_renamed_crew_member() from public, anon, authenticated;
revoke execute on function public.set_work_order_crew(uuid, uuid[]) from public, anon;
grant execute on function public.set_work_order_crew(uuid, uuid[]) to authenticated;

alter publication supabase_realtime add table public.crew_members, public.shift_crew;

commit;
