-- Department and access level decide what a sign-in can do.
-- Job title stays a label on the crew list.

begin;

alter table public.profiles
  add column if not exists department text not null default 'workshop';

alter table public.profiles
  add column if not exists access_level int not null default 2;

alter table public.profiles drop constraint if exists profiles_department_check;
alter table public.profiles
  add constraint profiles_department_check
  check (department in ('workshop', 'production', 'training'));

alter table public.profiles drop constraint if exists profiles_access_level_check;
alter table public.profiles
  add constraint profiles_access_level_check
  check (access_level in (1, 2, 3));

update public.profiles
set department = case role
      when 'production' then 'production'
      when 'training' then 'training'
      else 'workshop'
    end,
    access_level = case
      when role in ('management', 'production') then 3
      else 2
    end;

alter table public.crew_members drop constraint if exists crew_members_department_check;

update public.crew_members
set department = case lower(department)
      when 'production' then 'production'
      when 'training' then 'training'
      else 'workshop'
    end;

alter table public.crew_members
  add constraint crew_members_department_check
  check (department in ('workshop', 'production', 'training'));

alter table public.crew_members
  add column if not exists access_level int not null default 2;

alter table public.crew_members drop constraint if exists crew_members_access_level_check;
alter table public.crew_members
  add constraint crew_members_access_level_check
  check (access_level in (1, 2, 3));

update public.crew_members c
set department = p.department,
    access_level = p.access_level
from public.profiles p
where p.crew_member_id = c.id;

create or replace function public.app_user_department()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select department from public.profiles where id = auth.uid() and active
$$;

create or replace function public.app_user_access_level()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select access_level from public.profiles where id = auth.uid() and active
$$;

create or replace function public.app_can_manage_crew()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.app_user_access_level() = 3
     and public.app_user_department() in ('workshop', 'training')
$$;

revoke execute on function public.app_user_department() from public, anon;
revoke execute on function public.app_user_access_level() from public, anon;
revoke execute on function public.app_can_manage_crew() from public, anon;
grant execute on function public.app_user_department() to authenticated;
grant execute on function public.app_user_access_level() to authenticated;
grant execute on function public.app_can_manage_crew() to authenticated;

drop policy if exists crew_members_insert on public.crew_members;
create policy crew_members_insert on public.crew_members
  for insert to authenticated
  with check (public.app_can_manage_crew());

drop policy if exists crew_members_update on public.crew_members;
create policy crew_members_update on public.crew_members
  for update to authenticated
  using (public.app_can_manage_crew())
  with check (public.app_can_manage_crew());

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

drop trigger if exists crew_members_sync_profile_access on public.crew_members;
create trigger crew_members_sync_profile_access
  after insert or update of department, access_level on public.crew_members
  for each row execute function public.sync_linked_profile_access();

revoke execute on function public.sync_linked_profile_access() from public, anon, authenticated;

create or replace function public.link_my_crew(p_crew_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_department text;
  v_level integer;
  v_role text;
begin
  if (select public.app_user_role()) is distinct from 'fitter' then
    raise exception 'Only a fitter can link their sign-in to a person';
  end if;

  if p_crew_member_id is not null then
    select department, access_level
      into v_department, v_level
    from public.crew_members
    where id = p_crew_member_id and active;

    if v_department is null then
      raise exception 'That person is not on the crew list';
    end if;
    if exists (
      select 1 from public.profiles
      where crew_member_id = p_crew_member_id
        and id <> (select auth.uid())
    ) then
      raise exception 'That person is already linked to another sign-in';
    end if;

    v_role := case
      when v_department = 'production' then 'production'
      when v_department = 'training' then 'training'
      when v_level = 3 then 'management'
      else 'fitter'
    end;

    update public.profiles
    set crew_member_id = p_crew_member_id,
        department = v_department,
        access_level = v_level,
        role = v_role
    where id = (select auth.uid());
    return;
  end if;

  update public.profiles
  set crew_member_id = null
  where id = (select auth.uid());
end;
$$;

create or replace function public.stamp_shift_chat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_department text;
  v_level integer;
  v_name text;
begin
  v_department := public.app_user_department();
  v_level := public.app_user_access_level();
  v_name := public.app_user_name();

  if v_level is null or v_level < 2 or auth.uid() is null then
    raise exception 'Sign in to send a message';
  end if;

  new.sender_id := auth.uid();
  new.sender_name := coalesce(nullif(trim(v_name), ''), 'Crew');
  new.created_at := now();

  if v_department = 'workshop' and v_level = 3 then
    new.role := 'Workshop Supervisor';
    if new.recipient_id is null then
      raise exception 'Choose a fitter';
    end if;
    if not exists (
      select 1 from public.profiles
      where id = new.recipient_id
        and active
        and department = 'workshop'
        and access_level = 2
    ) then
      raise exception 'Choose a fitter who can sign in';
    end if;
  else
    new.role := 'Fitter';
    new.recipient_id := null;
  end if;

  return new;
end;
$$;

drop policy if exists shift_chat_select on public.shift_chat;
create policy shift_chat_select on public.shift_chat
  for select to authenticated
  using (
    (
      public.app_user_department() = 'workshop'
      and public.app_user_access_level() = 3
    )
    or sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
  );

drop policy if exists shift_chat_insert on public.shift_chat;
create policy shift_chat_insert on public.shift_chat
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.app_user_access_level() >= 2
    and (
      (
        public.app_user_department() = 'workshop'
        and public.app_user_access_level() = 3
        and recipient_id is not null
        and exists (
          select 1 from public.profiles
          where id = recipient_id
            and active
            and department = 'workshop'
            and access_level = 2
        )
      )
      or (
        not (
          public.app_user_department() = 'workshop'
          and public.app_user_access_level() = 3
        )
        and recipient_id is null
      )
    )
  );

commit;
