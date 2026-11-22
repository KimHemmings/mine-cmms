-- Short-lived workshop chat. Not tied to a machine or a work order.
-- Messages older than a day are left in the table and ignored by the app.

begin;

create table if not exists public.shift_chat (
  id uuid primary key default gen_random_uuid(),
  sender_name text not null check (length(trim(sender_name)) between 1 and 80),
  role text check (role is null or length(trim(role)) between 1 and 40),
  message text not null check (length(trim(message)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists shift_chat_created_at_idx
  on public.shift_chat (created_at desc);

alter table public.shift_chat enable row level security;

revoke all on public.shift_chat from anon, public;
grant select, insert on public.shift_chat to authenticated;

create policy shift_chat_select on public.shift_chat
  for select to authenticated
  using (true);

create policy shift_chat_insert on public.shift_chat
  for insert to authenticated
  with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shift_chat'
  ) then
    alter publication supabase_realtime add table public.shift_chat;
  end if;
end $$;

commit;
