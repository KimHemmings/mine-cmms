-- Away people stay on the roster and off the pre-start sign-on sheet.
-- Crew panel already lives in crew_members.panel ('A Crew' .. 'D Crew').

alter table public.crew_members
  add column if not exists away boolean not null default false;

alter table public.crew_members
  add column if not exists email text;
