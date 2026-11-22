-- Operator allocation sits on the roster. There is no public.crew table and no public.machines table.
-- crew_members is the roster. assets is the fleet.

alter table public.crew_members
  add column if not exists allocated_machine_id uuid references public.assets(id) on delete set null;

create index if not exists crew_members_allocated_machine_idx
  on public.crew_members (allocated_machine_id);

alter table public.crew_members
  drop constraint if exists crew_members_shift_duty_check;

alter table public.crew_members
  add constraint crew_members_shift_duty_check
  check (
    shift_duty is null
    or shift_duty in (
      'Pit Patrol / Field',
      'Workshop / Fab',
      'Hot Seat / Relief',
      'Pit Utility / Ancillary',
      'Go-Line / Training'
    )
  );

-- Production supervisors manage production people. Workshop and training stay on their own rows.
create or replace function public.app_can_manage_crew()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.app_user_access_level() = 3
     and public.app_user_department() in ('workshop', 'training', 'production')
$$;

drop policy if exists crew_members_insert on public.crew_members;
create policy crew_members_insert on public.crew_members
  for insert to authenticated
  with check (
    public.app_can_manage_crew()
    and department = public.app_user_department()
  );

drop policy if exists crew_members_update on public.crew_members;
create policy crew_members_update on public.crew_members
  for update to authenticated
  using (
    public.app_can_manage_crew()
    and department = public.app_user_department()
  )
  with check (
    public.app_can_manage_crew()
    and department = public.app_user_department()
  );

-- Pit notes stay on the same handover log, marked by department.
alter table public.handover_log_entries
  add column if not exists department text not null default 'workshop';

alter table public.handover_log_entries
  drop constraint if exists handover_log_entries_department_check;

alter table public.handover_log_entries
  add constraint handover_log_entries_department_check
  check (department in ('workshop', 'production', 'training'));

create or replace function public.stamp_handover_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_by := coalesce(public.app_user_name(), new.created_by);
  if public.app_user_department() in ('workshop', 'production', 'training') then
    new.department := public.app_user_department();
  end if;
  return new;
end;
$$;

drop policy if exists handover_log_entries_select on public.handover_log_entries;
create policy handover_log_entries_select on public.handover_log_entries
  for select to authenticated
  using (
    public.app_user_access_level() = 3
    and public.app_user_department() in ('workshop', 'production')
    and department = public.app_user_department()
  );

drop policy if exists handover_log_entries_insert on public.handover_log_entries;
create policy handover_log_entries_insert on public.handover_log_entries
  for insert to authenticated
  with check (
    public.app_user_access_level() = 3
    and public.app_user_department() in ('workshop', 'production')
    and department = public.app_user_department()
  );

drop policy if exists handover_log_entries_update on public.handover_log_entries;
create policy handover_log_entries_update on public.handover_log_entries
  for update to authenticated
  using (
    public.app_user_access_level() = 3
    and public.app_user_department() in ('workshop', 'production')
    and department = public.app_user_department()
  )
  with check (
    public.app_user_access_level() = 3
    and public.app_user_department() in ('workshop', 'production')
    and department = public.app_user_department()
  );

drop policy if exists handover_log_entries_delete on public.handover_log_entries;
create policy handover_log_entries_delete on public.handover_log_entries
  for delete to authenticated
  using (
    public.app_user_access_level() = 3
    and public.app_user_department() in ('workshop', 'production')
    and department = public.app_user_department()
  );
