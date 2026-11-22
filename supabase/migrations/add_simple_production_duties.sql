-- Two plain production duties. Older duty names stay allowed so saved rows still pass the check.

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
      'Go-Line / Training',
      'Floating Hot Seat / Relief',
      'Standby / Pit Utility'
    )
  );
