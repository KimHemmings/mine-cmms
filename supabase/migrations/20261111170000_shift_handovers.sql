-- One saved handover document per shift, readable by every supervisor.
begin;

create table if not exists public.shift_handovers (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null unique references public.shift_records(id) on delete cascade,
  shift_name text not null,
  shift_date date,
  shift_type text,
  crew text,
  supervisor text,
  document jsonb not null,
  saved_at timestamptz not null default now(),
  saved_by text
);

create index if not exists shift_handovers_saved_idx on public.shift_handovers (saved_at desc);

alter table public.shift_handovers enable row level security;
revoke all on public.shift_handovers from anon;

create policy shift_handovers_select on public.shift_handovers
  for select to authenticated using (public.app_user_role() = 'management');
create policy shift_handovers_insert on public.shift_handovers
  for insert to authenticated with check (public.app_user_role() = 'management');
create policy shift_handovers_update on public.shift_handovers
  for update to authenticated
  using (public.app_user_role() = 'management')
  with check (public.app_user_role() = 'management');

create or replace function public.stamp_shift_handover()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.saved_by := coalesce(public.app_user_name(), new.saved_by);
  new.saved_at := now();
  return new;
end;
$$;

drop trigger if exists shift_handover_stamp on public.shift_handovers;
create trigger shift_handover_stamp
  before insert or update on public.shift_handovers
  for each row execute function public.stamp_shift_handover();

revoke execute on function public.stamp_shift_handover() from public, anon, authenticated;

alter publication supabase_realtime add table public.shift_handovers;

commit;
