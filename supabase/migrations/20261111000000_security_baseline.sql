-- Security baseline: user profiles and roles, Row Level Security, audit stamping,
-- and atomic shift rollover. Safe to re-run.

begin;

-- ---------------------------------------------------------------------------
-- 1. Profiles: one row per auth user, holding display name, employee ID and role.
--    Users cannot edit their own profile; superintendents manage it in the dashboard.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  employee_id text,
  role text not null default 'fitter' check (role in ('fitter', 'management')),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, display_name)
select id, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- Security definer so policies can read the caller's role without recursing into profiles RLS.
create or replace function public.app_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.app_user_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce(employee_id, '') <> '' then display_name || ' (#' || employee_id || ')'
    else display_name
  end
  from public.profiles
  where id = auth.uid() and active
$$;

revoke execute on function public.app_user_role() from public, anon;
revoke execute on function public.app_user_name() from public, anon;
grant execute on function public.app_user_role() to authenticated;
grant execute on function public.app_user_name() to authenticated;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.app_user_role() = 'management');

-- ---------------------------------------------------------------------------
-- 2. Row Level Security on operational tables.
--    Policies are OR'd together, so any pre-existing permissive policy would
--    override these. All existing policies on these tables are dropped first.
-- ---------------------------------------------------------------------------
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('assets', 'machine_work_orders', 'work_order_parts',
                        'asset_history_notes', 'defect_watchlist', 'shift_records',
                        'downtime_logs', 'outstanding_parts', 'specials_on_order')
  loop
    execute format('drop policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['assets', 'machine_work_orders', 'work_order_parts',
                           'asset_history_notes', 'defect_watchlist', 'shift_records',
                           'downtime_logs', 'outstanding_parts', 'specials_on_order']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.app_user_role() is not null)',
      t || '_select', t);
  end loop;

  foreach t in array array['assets', 'machine_work_orders', 'work_order_parts', 'defect_watchlist',
                           'downtime_logs', 'outstanding_parts', 'specials_on_order']
  loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.app_user_role() is not null)',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.app_user_role() is not null) with check (public.app_user_role() is not null)',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.app_user_role() = ''management'')',
      t || '_delete', t);
  end loop;
end;
$$;

-- History notes are an append-only audit log: insert and read only, no update or delete.
create policy asset_history_notes_insert on public.asset_history_notes
  for insert to authenticated
  with check (public.app_user_role() is not null);

-- Shift records are written by management (handover notes) and by rollover_shift().
create policy shift_records_insert on public.shift_records
  for insert to authenticated
  with check (public.app_user_role() = 'management');
create policy shift_records_update on public.shift_records
  for update to authenticated
  using (public.app_user_role() = 'management')
  with check (public.app_user_role() = 'management');

-- ---------------------------------------------------------------------------
-- 3. Audit stamping: names come from the signed-in user's profile, not the client.
--    auth.uid() is null for dashboard/service-role writes, which keep supplied values.
-- ---------------------------------------------------------------------------
alter table public.asset_history_notes
  add column if not exists created_by uuid references auth.users (id) on delete set null;

create or replace function public.stamp_history_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
    new.fitter_name := coalesce(public.app_user_name(), new.fitter_name);
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_history_note on public.asset_history_notes;
create trigger stamp_history_note
  before insert on public.asset_history_notes
  for each row execute function public.stamp_history_note();

create or replace function public.stamp_work_order_signoff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and new.completed_by is not null
     and (tg_op = 'INSERT'
          or new.completed_by is distinct from old.completed_by
          or new.completed_at is distinct from old.completed_at) then
    new.completed_by := coalesce(public.app_user_name(), new.completed_by);
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_work_order_signoff on public.machine_work_orders;
create trigger stamp_work_order_signoff
  before insert or update on public.machine_work_orders
  for each row execute function public.stamp_work_order_signoff();

create or replace function public.stamp_shift_supervisor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.supervisor := coalesce(public.app_user_name(), new.supervisor);
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_shift_supervisor on public.shift_records;
create trigger stamp_shift_supervisor
  before insert on public.shift_records
  for each row execute function public.stamp_shift_supervisor();

-- ---------------------------------------------------------------------------
-- 4. Atomic shift rollover. Fails if the shift was already rolled over by someone else.
-- ---------------------------------------------------------------------------
create unique index if not exists shift_records_one_active
  on public.shift_records (status)
  where status = 'ACTIVE';

create or replace function public.rollover_shift(p_current_shift_id uuid)
returns public.shift_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.shift_records;
  v_new public.shift_records;
begin
  if public.app_user_role() is distinct from 'management' then
    raise exception 'Only management can roll over a shift' using errcode = '42501';
  end if;

  select * into v_current
  from public.shift_records
  where id = p_current_shift_id and status = 'ACTIVE'
  for update;

  if not found then
    raise exception 'This shift has already been rolled over. Refresh the board.';
  end if;

  update public.shift_records
  set status = 'HANDED_OVER', closed_at = now()
  where id = v_current.id;

  insert into public.shift_records (shift_name, supervisor, status)
  values (
    case when v_current.shift_name ilike '%day%' then 'Night Shift' else 'Day Shift' end,
    public.app_user_name(),
    'ACTIVE'
  )
  returning * into v_new;

  update public.machine_work_orders
  set shift_id = v_new.id
  where status = 'OPEN';

  return v_new;
end;
$$;

revoke execute on function public.rollover_shift from public, anon;
grant execute on function public.rollover_shift to authenticated;

-- Trigger functions must not be callable through the REST API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.stamp_history_note() from public, anon, authenticated;
revoke execute on function public.stamp_work_order_signoff() from public, anon, authenticated;
revoke execute on function public.stamp_shift_supervisor() from public, anon, authenticated;
revoke all on public.profiles from anon;

commit;
