-- General shift duties sit on the person. Machine work still uses work_order_assignments.
-- There is no public.crew table; the roster is public.crew_members.

alter table public.crew_members
  add column if not exists shift_duty text;

alter table public.crew_members
  drop constraint if exists crew_members_shift_duty_check;

alter table public.crew_members
  add constraint crew_members_shift_duty_check
  check (shift_duty is null or shift_duty in ('Pit Patrol / Field', 'Workshop / Fab'));
