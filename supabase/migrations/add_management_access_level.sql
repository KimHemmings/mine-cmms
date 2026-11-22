-- Superintendent access. Level 4 can be stored on a profile and on the roster.
-- Saving it on a linked crew member copies it onto that person's sign-in.

alter table public.profiles drop constraint if exists profiles_access_level_check;
alter table public.profiles
  add constraint profiles_access_level_check
  check (access_level in (1, 2, 3, 4));

alter table public.crew_members drop constraint if exists crew_members_access_level_check;
alter table public.crew_members
  add constraint crew_members_access_level_check
  check (access_level in (1, 2, 3, 4));

create or replace function public.sync_linked_profile_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  v_role := case
    when new.access_level = 4 then 'management'
    when new.department = 'production' then 'production'
    when new.department = 'training' then 'training'
    when new.access_level = 3 then 'management'
    else 'fitter'
  end;

  update public.profiles
  set department = new.department,
      access_level = new.access_level,
      role = v_role
  where crew_member_id = new.id;

  return new;
end;
$$;

revoke execute on function public.sync_linked_profile_access() from public, anon, authenticated;

drop policy if exists production_handover_checks_select on public.production_handover_checks;
create policy production_handover_checks_select on public.production_handover_checks
  for select to authenticated
  using (
    public.app_user_access_level() = 4
    or (
      public.app_user_access_level() = 3
      and public.app_user_department() in ('production', 'workshop')
    )
  );
