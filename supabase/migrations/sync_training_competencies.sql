-- Operator competencies live on public.crew_members.
-- The fleet models live on public.assets.make_model.
-- Training Level 2 and Level 3 can update production tickets only.
-- Production supervisors can still edit their own roster, but not the tickets.

alter table public.crew_members
  add column if not exists passed_out_equipment text[] not null default '{}';

alter table public.crew_members
  add column if not exists in_training_equipment text[] not null default '{}';

alter table public.crew_members
  add column if not exists competency_updated_by text;

alter table public.crew_members
  add column if not exists competency_updated_at timestamptz;

update public.crew_members
set passed_out_equipment = (
  select coalesce(array_agg(model order by model), '{}')
  from (
    select distinct btrim(make_model) as model
    from public.assets
    where btrim(make_model) <> ''
  ) models
)
where lower(department) = 'production'
  and cardinality(passed_out_equipment) = 0;

create or replace function public.guard_crew_competencies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.app_user_department() = 'production' then
    new.passed_out_equipment := old.passed_out_equipment;
    new.in_training_equipment := old.in_training_equipment;
    new.competency_updated_by := old.competency_updated_by;
    new.competency_updated_at := old.competency_updated_at;
    return new;
  end if;

  if public.app_user_department() = 'training'
     and public.app_user_access_level() >= 2
     and old.department = 'production' then
    new.display_name := old.display_name;
    new.employee_id := old.employee_id;
    new.department := old.department;
    new.access_level := old.access_level;
    new.trade := old.trade;
    new.panel := old.panel;
    new.email := old.email;
    new.away := old.away;
    new.shift_duty := old.shift_duty;
    new.allocated_machine_id := old.allocated_machine_id;
    new.allocated_role := old.allocated_role;
    new.is_contractor := old.is_contractor;
    new.contractor_company := old.contractor_company;
    new.overtime_crew_group := old.overtime_crew_group;
    new.shift_expires_at := old.shift_expires_at;
    new.active := old.active;
    if new.passed_out_equipment is distinct from old.passed_out_equipment
       or new.in_training_equipment is distinct from old.in_training_equipment then
      new.competency_updated_by := public.app_user_name();
      new.competency_updated_at := now();
    else
      new.competency_updated_by := old.competency_updated_by;
      new.competency_updated_at := old.competency_updated_at;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists crew_members_guard_competencies on public.crew_members;
create trigger crew_members_guard_competencies
  before update on public.crew_members
  for each row execute function public.guard_crew_competencies();

revoke execute on function public.guard_crew_competencies() from public, anon, authenticated;

drop policy if exists crew_members_update on public.crew_members;
create policy crew_members_update on public.crew_members
  for update to authenticated
  using (
    (
      public.app_can_manage_crew()
      and department = public.app_user_department()
    )
    or (
      public.app_user_department() = 'training'
      and public.app_user_access_level() >= 2
      and department = 'production'
    )
  )
  with check (
    (
      public.app_can_manage_crew()
      and department = public.app_user_department()
    )
    or (
      public.app_user_department() = 'training'
      and public.app_user_access_level() >= 2
      and department = 'production'
    )
  );
