-- A later supervision date, and a log when production changes who is in the seat.
begin;

alter table public.crew_supervision
  add column if not exists starts_on date not null default current_date;

drop policy if exists crew_supervision_select on public.crew_supervision;
create policy crew_supervision_select on public.crew_supervision
  for select to authenticated
  using ((select public.app_user_role()) in ('management', 'training', 'production', 'fitter'));

create table if not exists public.shift_seat_changes (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shift_records (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  off_crew_member_id uuid not null references public.crew_members (id),
  on_crew_member_id uuid not null references public.crew_members (id),
  changed_at timestamptz not null default now()
);

create index if not exists shift_seat_changes_shift_idx
  on public.shift_seat_changes (shift_id, changed_at);

alter table public.shift_seat_changes enable row level security;
revoke all on public.shift_seat_changes from anon, public;
grant select, insert on public.shift_seat_changes to authenticated;

create policy shift_seat_changes_select on public.shift_seat_changes
  for select to authenticated
  using ((select public.app_user_role()) in ('management', 'production'));
create policy shift_seat_changes_insert on public.shift_seat_changes
  for insert to authenticated
  with check ((select public.app_user_role()) = 'production');

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shift_seat_changes'
  ) then
    alter publication supabase_realtime add table public.shift_seat_changes;
  end if;
end $$;

commit;
