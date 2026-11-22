-- Overtime cover and shift contractors live on the roster.
-- There is no public.crew table. Permanent crew is crew_members.panel ('A Crew' .. 'D Crew').
-- overtime_crew_group stores the covering letter only: A, B, C, or D.

alter table public.crew_members
  add column if not exists is_contractor boolean not null default false;

alter table public.crew_members
  add column if not exists contractor_company text;

alter table public.crew_members
  add column if not exists overtime_crew_group text;

alter table public.crew_members
  add column if not exists shift_expires_at timestamptz;

alter table public.crew_members
  drop constraint if exists crew_members_overtime_crew_group_check;

alter table public.crew_members
  add constraint crew_members_overtime_crew_group_check
  check (overtime_crew_group is null or overtime_crew_group in ('A', 'B', 'C', 'D'));
