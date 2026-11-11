-- SOPs sit on the same training list. Supervisors only see one when it is due or expired.
begin;

alter table public.authorisations
  add column if not exists kind text not null default 'AUTHORISATION';

alter table public.authorisations drop constraint if exists authorisations_kind_check;
alter table public.authorisations
  add constraint authorisations_kind_check check (kind in ('AUTHORISATION', 'SOP'));

insert into public.authorisations (name, sort_order, kind) values
  ('Isolation and lockout', 11, 'SOP'),
  ('Pre-start inspection', 12, 'SOP'),
  ('Tyre and rim', 13, 'SOP'),
  ('Hot work procedure', 14, 'SOP')
on conflict (name) do update set kind = 'SOP', sort_order = excluded.sort_order;

insert into public.crew_authorisations (crew_member_id, authorisation_id, expires_on)
select c.id, a.id, current_date + 400
from public.crew_members c
join public.authorisations a on a.name = 'Pre-start inspection'
where c.active
on conflict (crew_member_id, authorisation_id) do nothing;

insert into public.crew_authorisations (crew_member_id, authorisation_id, expires_on)
select c.id, a.id, current_date + 14
from public.crew_members c
join public.authorisations a on a.name = 'Pre-start inspection'
where c.display_name = 'Robbie Dunn'
on conflict (crew_member_id, authorisation_id) do update set expires_on = excluded.expires_on;

insert into public.crew_authorisations (crew_member_id, authorisation_id, expires_on)
select c.id, a.id, current_date - 2
from public.crew_members c
join public.authorisations a on a.name = 'Isolation and lockout'
where c.display_name = 'Lucy Nguyen'
on conflict (crew_member_id, authorisation_id) do update set expires_on = excluded.expires_on;

commit;
