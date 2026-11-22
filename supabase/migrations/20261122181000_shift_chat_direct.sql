-- A fitter writes only to the supervisor. The supervisor chooses one fitter.

alter table public.shift_chat
  add column if not exists sender_id uuid references public.profiles (id) on delete set null,
  add column if not exists recipient_id uuid references public.profiles (id) on delete set null;

create index if not exists shift_chat_sender_idx
  on public.shift_chat (sender_id, created_at desc);

create index if not exists shift_chat_recipient_idx
  on public.shift_chat (recipient_id, created_at desc);

create or replace function public.stamp_shift_chat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_name text;
begin
  v_role := public.app_user_role();
  v_name := public.app_user_name();
  if v_role is null or auth.uid() is null then
    raise exception 'Sign in to send a message';
  end if;
  if v_role not in ('fitter', 'management') then
    raise exception 'Only a fitter or the supervisor can send this';
  end if;

  new.sender_id := auth.uid();
  new.sender_name := coalesce(
    nullif(trim(v_name), ''),
    case when v_role = 'management' then 'Supervisor' else 'Fitter' end
  );
  new.role := case when v_role = 'management' then 'Workshop Supervisor' else 'Fitter' end;
  new.created_at := now();

  if v_role = 'fitter' then
    new.recipient_id := null;
  else
    if new.recipient_id is null then
      raise exception 'Choose a fitter';
    end if;
    if not exists (
      select 1 from public.profiles
      where id = new.recipient_id and role = 'fitter' and active
    ) then
      raise exception 'Choose a fitter who can sign in';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists shift_chat_stamp on public.shift_chat;
create trigger shift_chat_stamp
  before insert on public.shift_chat
  for each row execute function public.stamp_shift_chat();

drop policy if exists shift_chat_select on public.shift_chat;
create policy shift_chat_select on public.shift_chat
  for select to authenticated
  using (
    (select public.app_user_role()) = 'management'
    or sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
  );

drop policy if exists shift_chat_insert on public.shift_chat;
create policy shift_chat_insert on public.shift_chat
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (
      (
        (select public.app_user_role()) = 'fitter'
        and recipient_id is null
      )
      or (
        (select public.app_user_role()) = 'management'
        and recipient_id is not null
        and exists (
          select 1 from public.profiles
          where id = recipient_id and role = 'fitter' and active
        )
      )
    )
  );
