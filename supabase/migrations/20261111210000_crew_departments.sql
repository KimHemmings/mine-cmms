-- Training filters people by department. Existing crew stay in the workshop.
begin;

alter table public.crew_members
  add column if not exists department text not null default 'Workshop';

alter table public.crew_members drop constraint if exists crew_members_department_check;
alter table public.crew_members
  add constraint crew_members_department_check
  check (department in ('Workshop', 'Production'));

commit;
