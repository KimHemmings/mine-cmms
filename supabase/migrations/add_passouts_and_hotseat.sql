-- Pass-outs and hot-seat roles live on the roster.
-- In this database the roster is public.crew_members and the fleet is public.assets.
-- assets.location already holds the pit or bay. The location statement is safe to run again.

alter table public.crew_members
  add column if not exists passed_out_equipment text[] not null default '{}';

alter table public.crew_members
  add column if not exists allocated_role text;

alter table public.crew_members
  drop constraint if exists crew_members_allocated_role_check;

alter table public.crew_members
  add constraint crew_members_allocated_role_check
  check (allocated_role is null or allocated_role in ('Primary', 'Hot Seat'));

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
      'Pit Utility / Ancillary',
      'Go-Line / Training'
    )
  );

alter table public.assets
  add column if not exists location text;
