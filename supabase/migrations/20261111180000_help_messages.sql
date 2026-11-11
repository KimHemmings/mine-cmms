-- Messages from the workboard: a note to the supervisor, or a system problem.
begin;

create table if not exists public.help_messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('SUPERVISOR', 'SYSTEM')),
  message text not null check (length(trim(message)) > 0 and length(message) <= 1000),
  fleet_id text check (fleet_id is null or length(trim(fleet_id)) <= 40),
  shift_id uuid references public.shift_records(id) on delete set null,
  status text not null default 'OPEN' check (status in ('OPEN', 'DONE')),
  created_by uuid references auth.users (id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  handled_by_name text,
  handled_at timestamptz
);

create index if not exists help_messages_created_by_idx
  on public.help_messages (created_by, created_at desc);

create index if not exists help_messages_open_idx
  on public.help_messages (created_at desc)
  where status = 'OPEN';

alter table public.help_messages enable row level security;
revoke all on public.help_messages from anon, public;
grant select, insert, update on public.help_messages to authenticated;

create policy help_messages_select on public.help_messages
  for select to authenticated
  using (
    created_by = (select auth.uid())
    or (select public.app_user_role()) = 'management'
  );

create policy help_messages_insert on public.help_messages
  for insert to authenticated
  with check ((select public.app_user_role()) is not null);

create policy help_messages_update on public.help_messages
  for update to authenticated
  using ((select public.app_user_role()) = 'management')
  with check ((select public.app_user_role()) = 'management');

create or replace function public.stamp_help_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
      new.created_by_name := public.app_user_name();
    end if;
    new.status := 'OPEN';
    new.handled_by_name := null;
    new.handled_at := null;
    new.created_at := now();
    return new;
  end if;

  new.id := old.id;
  new.kind := old.kind;
  new.message := old.message;
  new.fleet_id := old.fleet_id;
  new.shift_id := old.shift_id;
  new.created_by := old.created_by;
  new.created_by_name := old.created_by_name;
  new.created_at := old.created_at;

  if new.status = 'DONE' and old.status is distinct from 'DONE' then
    new.handled_at := now();
    new.handled_by_name := coalesce(public.app_user_name(), new.handled_by_name);
  elsif new.status = 'OPEN' then
    new.handled_at := null;
    new.handled_by_name := null;
  else
    new.status := old.status;
    new.handled_at := old.handled_at;
    new.handled_by_name := old.handled_by_name;
  end if;

  return new;
end;
$$;

drop trigger if exists help_messages_stamp on public.help_messages;
create trigger help_messages_stamp
  before insert or update on public.help_messages
  for each row execute function public.stamp_help_message();

revoke execute on function public.stamp_help_message() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'help_messages'
  ) then
    alter publication supabase_realtime add table public.help_messages;
  end if;
end $$;

commit;
