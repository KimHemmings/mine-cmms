-- Production supervisors message the workshop desk. Their messages are stamped
-- Production Sup. A workshop supervisor can reply to that production sign-in.

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
  if v_department = 'production' and v_level is distinct from 3 then
    raise exception 'Sign in to send a message';
  end if;

  new.sender_id := auth.uid();
  new.sender_name := coalesce(nullif(trim(v_name), ''), 'Crew');
  new.created_at := now();

  if v_department = 'workshop' and v_level = 3 then
    new.role := 'Workshop Supervisor';
    if new.recipient_id is null then
      raise exception 'Choose who this is for';
    end if;
    if not exists (
      select 1 from public.profiles
      where id = new.recipient_id
        and active
        and (
          (department = 'workshop' and access_level = 2)
          or (department = 'production' and access_level = 3)
        )
    ) then
      raise exception 'Choose a fitter or a production supervisor who can sign in';
    end if;
  elsif v_department = 'production' and v_level = 3 then
    new.role := 'Production Sup';
    new.recipient_id := null;
  else
    new.role := 'Fitter';
    new.recipient_id := null;
  end if;

  return new;
end;
$$;

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
            and (
              (department = 'workshop' and access_level = 2)
              or (department = 'production' and access_level = 3)
            )
        )
      )
      or (
        not (
          public.app_user_department() = 'workshop'
          and public.app_user_access_level() = 3
        )
        and public.app_user_access_level() >= 2
        and (
          public.app_user_department() is distinct from 'production'
          or public.app_user_access_level() = 3
        )
        and recipient_id is null
      )
    )
  );
