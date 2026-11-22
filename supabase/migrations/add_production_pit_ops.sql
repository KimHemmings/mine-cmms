-- Pit location already lives on public.assets.location.
-- Statutory checks are one row per crew and 12-hour shift.

alter table public.assets
  add column if not exists location text;

alter table public.crew_members
  drop constraint if exists crew_members_shift_duty_check;

alter table public.crew_members
  add constraint crew_members_shift_duty_check
  check (
    shift_duty is null
    or shift_duty in (
      'Pit Patrol / Field',
      'Workshop / Fab',
      'Hot Seat / Relief',
      'Hot Seat / Relief (General)',
      'Standby / Crib Relief',
      'Pit Utility / Ancillary',
      'Go-Line / Training'
    )
  );

create table if not exists public.production_handover_checks (
  id uuid primary key default gen_random_uuid(),
  shift_date date not null,
  shift_name text not null check (shift_name in ('Day Shift', 'Night Shift')),
  crew_group text not null check (crew_group in ('A', 'B', 'C', 'D')),
  highwall_status text not null default 'Checked',
  highwall_notes text,
  blast_status text not null default 'All Clear',
  blast_notes text,
  dewatering_status text not null default 'Normal',
  dewatering_notes text,
  ramps_lighting_status text not null default 'Good',
  ramps_lighting_notes text,
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint production_handover_checks_shift_key unique (shift_date, shift_name, crew_group)
);

alter table public.production_handover_checks enable row level security;
revoke all on public.production_handover_checks from anon;
grant select, insert, update on public.production_handover_checks to authenticated;

drop policy if exists production_handover_checks_select on public.production_handover_checks;
create policy production_handover_checks_select on public.production_handover_checks
  for select to authenticated
  using (public.app_user_access_level() = 3 and public.app_user_department() in ('production', 'workshop'));

drop policy if exists production_handover_checks_insert on public.production_handover_checks;
create policy production_handover_checks_insert on public.production_handover_checks
  for insert to authenticated
  with check (public.app_user_access_level() = 3 and public.app_user_department() = 'production');

drop policy if exists production_handover_checks_update on public.production_handover_checks;
create policy production_handover_checks_update on public.production_handover_checks
  for update to authenticated
  using (public.app_user_access_level() = 3 and public.app_user_department() = 'production')
  with check (public.app_user_access_level() = 3 and public.app_user_department() = 'production');
