-- Shift handover compliance log, saved per shift so any computer sees the same entries.
begin;

create table if not exists public.handover_log_entries (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shift_records(id) on delete cascade,
  category text not null check (category in (
    'SAFETY', 'WEATHER', 'MANNING', 'WATCHLIST', 'BRAKE_TEST', 'TOOLING', 'PRIORITY'
  )),
  fleet_id text,
  details text not null check (length(trim(details)) > 0),
  action_required text,
  logged_at timestamptz not null default now(),
  created_by text
);

create index if not exists handover_log_entries_shift_idx
  on public.handover_log_entries (shift_id, logged_at);

alter table public.handover_log_entries enable row level security;
revoke all on public.handover_log_entries from anon;

create policy handover_log_entries_select on public.handover_log_entries
  for select to authenticated using (public.app_user_role() = 'management');
create policy handover_log_entries_insert on public.handover_log_entries
  for insert to authenticated with check (public.app_user_role() = 'management');
create policy handover_log_entries_update on public.handover_log_entries
  for update to authenticated
  using (public.app_user_role() = 'management')
  with check (public.app_user_role() = 'management');
create policy handover_log_entries_delete on public.handover_log_entries
  for delete to authenticated using (public.app_user_role() = 'management');

create or replace function public.stamp_handover_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_by := coalesce(public.app_user_name(), new.created_by);
  return new;
end;
$$;

drop trigger if exists handover_log_stamp on public.handover_log_entries;
create trigger handover_log_stamp
  before insert on public.handover_log_entries
  for each row execute function public.stamp_handover_log();

revoke execute on function public.stamp_handover_log() from public, anon, authenticated;

alter publication supabase_realtime add table public.handover_log_entries;

commit;
