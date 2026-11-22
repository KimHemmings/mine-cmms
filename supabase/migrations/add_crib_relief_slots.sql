-- Crib relief sits on the roster. There is no public.crew table.
-- Each operator's hot_seat_assignments lists the machine they relieve.

alter table public.crew_members
  add column if not exists hot_seat_assignments jsonb not null default '[]'::jsonb;
