-- Level 4 is a departmental superintendent (production, workshop, or training).
-- Level 5 is the site senior executive / general manager.
-- Roster rows live on public.crew_members. Sign-in rows live on public.profiles.

alter table public.profiles drop constraint if exists profiles_access_level_check;
alter table public.profiles
  add constraint profiles_access_level_check
  check (access_level in (1, 2, 3, 4, 5));

alter table public.crew_members drop constraint if exists crew_members_access_level_check;
alter table public.crew_members
  add constraint crew_members_access_level_check
  check (access_level in (1, 2, 3, 4, 5));

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
    when new.access_level = 5 then 'management'
    when new.department = 'production' then 'production'
    when new.department = 'training' then 'training'
    when new.access_level in (3, 4) then 'management'
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

create or replace function public.app_can_manage_crew()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.app_user_access_level() in (3, 4)
     and public.app_user_department() in ('workshop', 'training', 'production')
$$;

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
      when v_level = 5 then 'management'
      when v_department = 'production' then 'production'
      when v_department = 'training' then 'training'
      when v_level in (3, 4) then 'management'
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

create or replace function public.guard_permanent_fleet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if public.app_user_department() is distinct from 'workshop'
       or public.app_user_access_level() not in (3, 4) then
      raise exception 'Only a workshop supervisor can add a machine';
    end if;
    return new;
  end if;

  if new.fleet_id is distinct from old.fleet_id
     or new.make_model is distinct from old.make_model
     or new.asset_type is distinct from old.asset_type
     or new.serial_number is distinct from old.serial_number
     or new.machine_owner is distinct from old.machine_owner then
    if public.app_user_department() is distinct from 'workshop'
       or public.app_user_access_level() not in (3, 4) then
      raise exception 'Only a workshop supervisor can change the permanent machine record';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_permanent_fleet() from public, anon, authenticated;

create or replace function public.set_shift_panel(p_shift_id uuid, p_crew text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.app_user_access_level() not in (3, 4) then
    raise exception 'Only a supervisor can change the crew on shift';
  end if;

  update public.shift_records set crew = p_crew where id = p_shift_id;
  if not found then
    raise exception 'Shift not found' using errcode = '42501';
  end if;

  delete from public.shift_crew where shift_id = p_shift_id;

  insert into public.shift_crew (shift_id, crew_member_id)
  select p_shift_id, c.id
  from public.crew_members c
  where c.active and c.panel = p_crew;
end;
$$;

revoke execute on function public.set_shift_panel(uuid, text) from public, anon;
grant execute on function public.set_shift_panel(uuid, text) to authenticated;

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

  if v_level is null or v_level < 2 or v_level = 5 or auth.uid() is null then
    raise exception 'Sign in to send a message';
  end if;
  if v_department = 'production' and v_level not in (3, 4) then
    raise exception 'Sign in to send a message';
  end if;

  new.sender_id := auth.uid();
  new.sender_name := coalesce(nullif(trim(v_name), ''), 'Crew');
  new.created_at := now();

  if v_department = 'workshop' and v_level in (3, 4) then
    new.role := case when v_level = 4 then 'Workshop Superintendent' else 'Workshop Supervisor' end;
    if new.recipient_id is null then
      raise exception 'Choose who this is for';
    end if;
    if not exists (
      select 1 from public.profiles
      where id = new.recipient_id
        and active
        and (
          (department = 'workshop' and access_level = 2)
          or (department = 'production' and access_level in (3, 4))
        )
    ) then
      raise exception 'Choose a fitter or a production supervisor who can sign in';
    end if;
  elsif v_department = 'production' and v_level in (3, 4) then
    new.role := case when v_level = 4 then 'Production Superintendent' else 'Production Sup' end;
    new.recipient_id := null;
  else
    new.role := 'Fitter';
    new.recipient_id := null;
  end if;

  return new;
end;
$$;

drop policy if exists handover_log_entries_select on public.handover_log_entries;
create policy handover_log_entries_select on public.handover_log_entries
  for select to authenticated
  using (
    public.app_user_access_level() = 5
    or (
      public.app_user_access_level() in (3, 4)
      and public.app_user_department() in ('workshop', 'production')
      and department = public.app_user_department()
    )
  );

drop policy if exists handover_log_entries_insert on public.handover_log_entries;
create policy handover_log_entries_insert on public.handover_log_entries
  for insert to authenticated
  with check (
    public.app_user_access_level() in (3, 4)
    and public.app_user_department() in ('workshop', 'production')
    and department = public.app_user_department()
  );

drop policy if exists handover_log_entries_update on public.handover_log_entries;
create policy handover_log_entries_update on public.handover_log_entries
  for update to authenticated
  using (
    public.app_user_access_level() in (3, 4)
    and public.app_user_department() in ('workshop', 'production')
    and department = public.app_user_department()
  )
  with check (
    public.app_user_access_level() in (3, 4)
    and public.app_user_department() in ('workshop', 'production')
    and department = public.app_user_department()
  );

drop policy if exists handover_log_entries_delete on public.handover_log_entries;
create policy handover_log_entries_delete on public.handover_log_entries
  for delete to authenticated
  using (
    public.app_user_access_level() in (3, 4)
    and public.app_user_department() in ('workshop', 'production')
    and department = public.app_user_department()
  );

drop policy if exists production_handover_checks_select on public.production_handover_checks;
create policy production_handover_checks_select on public.production_handover_checks
  for select to authenticated
  using (
    public.app_user_access_level() = 5
    or (
      public.app_user_access_level() in (3, 4)
      and public.app_user_department() in ('production', 'workshop')
    )
  );

drop policy if exists production_handover_checks_insert on public.production_handover_checks;
create policy production_handover_checks_insert on public.production_handover_checks
  for insert to authenticated
  with check (
    public.app_user_access_level() in (3, 4)
    and public.app_user_department() = 'production'
  );

drop policy if exists production_handover_checks_update on public.production_handover_checks;
create policy production_handover_checks_update on public.production_handover_checks
  for update to authenticated
  using (
    public.app_user_access_level() in (3, 4)
    and public.app_user_department() = 'production'
  )
  with check (
    public.app_user_access_level() in (3, 4)
    and public.app_user_department() = 'production'
  );

drop policy if exists shift_chat_select on public.shift_chat;
create policy shift_chat_select on public.shift_chat
  for select to authenticated
  using (
    public.app_user_access_level() = 5
    or (
      public.app_user_department() = 'workshop'
      and public.app_user_access_level() in (3, 4)
    )
    or sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
    or (
      public.app_user_department() = 'training'
      and public.app_user_access_level() >= 2
      and message like '@Training%'
    )
  );

drop policy if exists shift_chat_insert on public.shift_chat;
create policy shift_chat_insert on public.shift_chat
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.app_user_access_level() >= 2
    and public.app_user_access_level() < 5
    and (
      (
        public.app_user_department() = 'workshop'
        and public.app_user_access_level() in (3, 4)
        and recipient_id is not null
        and exists (
          select 1 from public.profiles
          where id = recipient_id
            and active
            and (
              (department = 'workshop' and access_level = 2)
              or (department = 'production' and access_level in (3, 4))
            )
        )
      )
      or (
        not (
          public.app_user_department() = 'workshop'
          and public.app_user_access_level() in (3, 4)
        )
        and (
          public.app_user_department() is distinct from 'production'
          or public.app_user_access_level() in (3, 4)
        )
        and recipient_id is null
      )
    )
  );
