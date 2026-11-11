-- One OCE report per shift for both supervisors, and a production handover of its own.
begin;

create table if not exists public.oce_reports (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null unique references public.shift_records (id) on delete cascade,
  file_name text not null,
  storage_path text,
  source_text text,
  briefing jsonb not null default '{}'::jsonb,
  uploaded_at timestamptz not null default now(),
  uploaded_by text
);

create table if not exists public.production_handovers (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null unique references public.shift_records (id) on delete cascade,
  shift_name text not null,
  shift_date date,
  shift_type text,
  crew text,
  supervisor text,
  document jsonb not null,
  saved_at timestamptz not null default now(),
  saved_by text
);

create index if not exists production_handovers_saved_idx on public.production_handovers (saved_at desc);

alter table public.oce_reports enable row level security;
alter table public.production_handovers enable row level security;
revoke all on public.oce_reports, public.production_handovers from anon, public;
grant select, insert, update, delete on public.oce_reports to authenticated;
grant select, insert, update on public.production_handovers to authenticated;

create policy oce_reports_select on public.oce_reports
  for select to authenticated
  using ((select public.app_user_role()) in ('management', 'production'));
create policy oce_reports_insert on public.oce_reports
  for insert to authenticated
  with check ((select public.app_user_role()) in ('management', 'production'));
create policy oce_reports_update on public.oce_reports
  for update to authenticated
  using ((select public.app_user_role()) in ('management', 'production'))
  with check ((select public.app_user_role()) in ('management', 'production'));
create policy oce_reports_delete on public.oce_reports
  for delete to authenticated
  using ((select public.app_user_role()) in ('management', 'production'));

create policy production_handovers_select on public.production_handovers
  for select to authenticated
  using ((select public.app_user_role()) in ('management', 'production'));
create policy production_handovers_insert on public.production_handovers
  for insert to authenticated
  with check ((select public.app_user_role()) = 'production');
create policy production_handovers_update on public.production_handovers
  for update to authenticated
  using ((select public.app_user_role()) = 'production')
  with check ((select public.app_user_role()) = 'production');

create or replace function public.stamp_oce_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.uploaded_by := coalesce(public.app_user_name(), new.uploaded_by);
  new.uploaded_at := now();
  return new;
end;
$$;

drop trigger if exists oce_report_stamp on public.oce_reports;
create trigger oce_report_stamp
  before insert or update on public.oce_reports
  for each row execute function public.stamp_oce_report();

drop trigger if exists production_handover_stamp on public.production_handovers;
create trigger production_handover_stamp
  before insert or update on public.production_handovers
  for each row execute function public.stamp_shift_handover();

revoke execute on function public.stamp_oce_report() from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('oce-reports', 'oce-reports', false, 8388608, array['application/pdf', 'text/plain', 'application/octet-stream'])
on conflict (id) do nothing;

create policy oce_reports_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'oce-reports' and (select public.app_user_role()) in ('management', 'production'));
create policy oce_reports_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'oce-reports' and (select public.app_user_role()) in ('management', 'production'));
create policy oce_reports_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'oce-reports' and (select public.app_user_role()) in ('management', 'production'))
  with check (bucket_id = 'oce-reports' and (select public.app_user_role()) in ('management', 'production'));
create policy oce_reports_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'oce-reports' and (select public.app_user_role()) in ('management', 'production'));

insert into public.crew_members (display_name, employee_id, trade, panel, department, active)
values
  ('Hannah Brooks', '20110', 'Operator', 'A Crew', 'Production', true),
  ('Cooper Reid', '20111', 'Operator', 'A Crew', 'Production', true),
  ('Nate Ellis', '20112', 'Operator', 'A Crew', 'Production', true),
  ('Sophie Tran', '20113', 'Operator', 'A Crew', 'Production', true),
  ('Kyle Brown', '20114', 'Operator', 'A Crew', 'Production', true),
  ('Aisha Rahman', '20115', 'Operator', 'A Crew', 'Production', true),
  ('Drew Hogan', '20116', 'Operator', 'A Crew', 'Production', true),
  ('Holly Pearce', '20210', 'Operator', 'B Crew', 'Production', true),
  ('Chris Nguyen', '20211', 'Operator', 'B Crew', 'Production', true),
  ('Samir Ali', '20212', 'Operator', 'B Crew', 'Production', true),
  ('Brooke Taylor', '20213', 'Operator', 'B Crew', 'Production', true),
  ('Ethan Moss', '20214', 'Operator', 'B Crew', 'Production', true),
  ('Nina Rossi', '20215', 'Operator', 'B Crew', 'Production', true),
  ('Will McKay', '20216', 'Operator', 'B Crew', 'Production', true),
  ('Paige Donovan', '20310', 'Operator', 'C Crew', 'Production', true),
  ('Joel Kim', '20311', 'Operator', 'C Crew', 'Production', true),
  ('Tara Singh', '20312', 'Operator', 'C Crew', 'Production', true),
  ('Mason Clark', '20313', 'Operator', 'C Crew', 'Production', true),
  ('Abby Nguyen', '20314', 'Operator', 'C Crew', 'Production', true),
  ('Finn Obrien', '20315', 'Operator', 'C Crew', 'Production', true),
  ('Leah Scott', '20316', 'Operator', 'C Crew', 'Production', true),
  ('Tom Walsh', '20402', 'Operator', 'D Crew', 'Production', true),
  ('Priya Nair', '20403', 'Operator', 'D Crew', 'Production', true),
  ('Luke Harris', '20404', 'Operator', 'D Crew', 'Production', true),
  ('Amy Chen', '20405', 'Operator', 'D Crew', 'Production', true),
  ('Ben Walker', '20406', 'Operator', 'D Crew', 'Production', true),
  ('Noah Grant', '20407', 'Operator', 'D Crew', 'Production', true),
  ('Carla Mendes', '20408', 'Operator', 'D Crew', 'Production', true),
  ('Dan Hughes', '20409', 'Operator', 'D Crew', 'Production', true),
  ('Erin Blake', '20410', 'Operator', 'D Crew', 'Production', true),
  ('Josh Patel', '20411', 'Operator', 'D Crew', 'Production', true),
  ('Mia Kovacs', '20412', 'Operator', 'D Crew', 'Production', true),
  ('Owen Fraser', '20413', 'Operator', 'D Crew', 'Production', true)
on conflict (employee_id) do nothing;

insert into public.operator_passouts (crew_member_id, asset_id, expires_on)
select c.id, a.id, current_date + v.days
from (values
  ('Hannah Brooks', 'DT-041', 400),
  ('Hannah Brooks', 'DT-046', 400),
  ('Cooper Reid', 'EX-201', 400),
  ('Cooper Reid', 'EX-202', -2),
  ('Nate Ellis', 'SH-301', 300),
  ('Sophie Tran', 'DT-044', 400),
  ('Kyle Brown', 'WT-021', 200),
  ('Aisha Rahman', 'DR-101', 250),
  ('Drew Hogan', 'WL-050', 200),
  ('Drew Hogan', 'WD-015', 200),
  ('Holly Pearce', 'DT-043', 16),
  ('Chris Nguyen', 'DT-048', 400),
  ('Samir Ali', 'EX-201', 400),
  ('Brooke Taylor', 'SH-301', 300),
  ('Ethan Moss', 'DT-042', 400),
  ('Nina Rossi', 'WT-021', 180),
  ('Will McKay', 'DR-103', 220),
  ('Paige Donovan', 'DT-041', 400),
  ('Joel Kim', 'EX-201', 400),
  ('Tara Singh', 'SH-301', 400),
  ('Mason Clark', 'DT-046', 400),
  ('Abby Nguyen', 'WD-015', 200),
  ('Finn Obrien', 'DR-102', 180),
  ('Leah Scott', 'WL-051', 250),
  ('Tom Walsh', 'EX-201', 400),
  ('Priya Nair', 'SH-301', 400),
  ('Luke Harris', 'DT-041', 400),
  ('Luke Harris', 'DT-042', 400),
  ('Amy Chen', 'DT-042', 400),
  ('Amy Chen', 'DT-046', 400),
  ('Ben Walker', 'DT-044', 400),
  ('Noah Grant', 'DT-048', 400),
  ('Carla Mendes', 'WT-021', 200),
  ('Dan Hughes', 'WD-015', 200),
  ('Erin Blake', 'DR-101', 180),
  ('Erin Blake', 'DR-102', 12),
  ('Josh Patel', 'WL-050', 300),
  ('Mia Kovacs', 'DT-046', 14),
  ('Owen Fraser', 'GD-101', -4)
) as v(person, fleet, days)
join public.crew_members c on c.display_name = v.person
join public.assets a on a.fleet_id = v.fleet
on conflict (crew_member_id, asset_id) do nothing;

insert into public.crew_authorisations (crew_member_id, authorisation_id, expires_on)
select c.id, a.id, current_date + 400
from public.crew_members c
join public.authorisations a on a.name = 'Truck operation'
where c.employee_id ~ '^20[1-4]'
on conflict (crew_member_id, authorisation_id) do nothing;

insert into public.crew_authorisations (crew_member_id, authorisation_id, expires_on)
select c.id, a.id, case when c.display_name = 'Erin Blake' then current_date + 18 else current_date + 180 end
from public.crew_members c
join public.authorisations a on a.name = 'Working at heights'
where c.employee_id ~ '^20[1-4]'
on conflict (crew_member_id, authorisation_id) do nothing;

insert into public.crew_authorisations (crew_member_id, authorisation_id, expires_on)
select c.id, a.id, case when c.display_name = 'Owen Fraser' then current_date - 6 else current_date + 200 end
from public.crew_members c
join public.authorisations a on a.name = 'Hot work'
where c.employee_id ~ '^20[1-4]'
on conflict (crew_member_id, authorisation_id) do nothing;

insert into public.shift_machine_operators (shift_id, asset_id, crew_member_id)
select s.id, a.id, c.id
from public.shift_records s
join (values
  ('EX-201', 'Tom Walsh'),
  ('SH-301', 'Priya Nair'),
  ('DT-041', 'Luke Harris'),
  ('DT-042', 'Amy Chen'),
  ('DT-044', 'Ben Walker'),
  ('DT-046', 'Steve Parker'),
  ('DT-048', 'Noah Grant'),
  ('WT-021', 'Carla Mendes'),
  ('WD-015', 'Dan Hughes'),
  ('DR-101', 'Erin Blake'),
  ('WL-050', 'Josh Patel')
) as v(fleet, person) on true
join public.assets a on a.fleet_id = v.fleet
join public.crew_members c on c.display_name = v.person
where s.status = 'ACTIVE'
on conflict (shift_id, asset_id) do update set crew_member_id = excluded.crew_member_id;

insert into public.oce_reports (shift_id, file_name, source_text, briefing)
select s.id, 'OCE_Night_11Nov2026.txt', $oce$
OPEN CUT EXAMINER REPORT
Site: North Cut
Shift: Night, 11 November 2026
OCE: Pat Nguyen

Inspections
- Pit 2 Bench 240 highwall inspected at 18:40. Crest is cracked for about 15 metres above the EX-201 dig. Stand-off is 10 metres from the toe. Nobody under the wall. Re-inspect before day shift if rain exceeds 5 mm.
- Ramp 3 East: grader GD-103 is down. Rutting on the outside windrow. Limit is 20 km/h until a grader is back. Windrow is below half wheel height for about 40 metres.
- North Cut Strip 2, SH-301 face: clean, no water. Lighting tower LP-002 is working.
- Waste Dump 3 tip head: WD-015 only. No dozer. Tip-head bund is in place. Do not tip short.
- Pattern 42 North, DR-101: loaded holes on the eastern row are not tied in. The exclusion is flagged. The drill stays west of the flags.
- Main haul dust: WT-021 is the only water cart. WT-020 is in the workshop. Extra pass on the south haul before 22:00.

Incidents
- 19:10 ROM pad. DT-044 reversed toward a spotter. The spotter moved clear. No contact. Positive communication was not in place.
- 20:05 DR-101. Dust in the operator's eye. Flushed on the rig and returned to work.

Restrictions
- No work within 10 metres of the Pit 2 Bench 240 toe.
- Ramp 3 East is limited to 20 km/h.
- Pattern 42 eastern row is an exclusion. Do not enter.

Conditions
- Weather fine, wind north-west at 15 km/h, no lightning.
- Pit water is under control. The sump pump is running.
- Lighting is up on the shovel face and on Dump 3 crest.

Focus for the oncoming crew
- Reverse moves: stop, call, and wait for the all-clear.
- The highwall stand-off is not optional.
$oce$,
  jsonb_build_object(
    'summary', 'Pit 2 Bench 240 has a cracked crest above EX-201. Stay 10 metres off the toe and do not put a dozer on that floor until the examiner re-inspects. Ramp 3 East is 20 km/h while GD-103 is down. Pattern 42 eastern row is a loaded-hole exclusion: DR-101 stays west of the flags. Dump 3 has no dozer, so do not tip short. One water cart is up. DT-044 reversed toward a spotter at the ROM with no positive communication, and the DR-101 operator had dust in an eye and returned to work.',
    'hazards', jsonb_build_array(
      'Cracked crest for 15 metres above the EX-201 dig on Pit 2 Bench 240',
      'Ramp 3 East windrow below half wheel height',
      'Loaded holes not tied in on Pattern 42 eastern row',
      'Dump 3 tip head has no dozer'
    ),
    'incidents', jsonb_build_array(
      '19:10 ROM. DT-044 reversed toward a spotter. No contact. Positive communication was not in place.',
      '20:05 DR-101. Dust in the eye, flushed on the rig, returned to work.'
    ),
    'restrictions', jsonb_build_array(
      'No work within 10 metres of the Pit 2 Bench 240 toe',
      'Ramp 3 East limited to 20 km/h',
      'Do not enter the Pattern 42 eastern row',
      'Do not tip short on Dump 3'
    ),
    'conditions', jsonb_build_array(
      'Fine, north-west wind 15 km/h, no lightning',
      'Pit water under control, sump pump running',
      'Lighting up on the shovel face and Dump 3 crest',
      'WT-021 is the only water cart'
    )
  )
from public.shift_records s
where s.status = 'ACTIVE'
on conflict (shift_id) do nothing;

insert into public.production_handovers (
  shift_id, shift_name, shift_date, shift_type, crew, supervisor, document
)
select
  s.id,
  s.shift_name,
  s.shift_date,
  s.shift_type,
  s.crew,
  s.supervisor,
  jsonb_build_object(
    'summary', 'D Crew is digging Pit 2 with EX-201 and stripping North Cut with SH-301. Five trucks are crewed. There is no dozer and no grader, so the floor and Ramp 3 are the hold points. One water cart is on the haul road.',
    'safetyFocus', 'Reverse moves: stop, call, and wait for the all-clear. The 10 metre stand-off under the Pit 2 highwall is not optional.',
    'safetyIncidents', jsonb_build_array(
      jsonb_build_object('id', 'prod-1', 'what', 'DT-044 reversed toward a spotter. No contact.', 'where', 'ROM pad', 'action', 'Positive communication before any reverse move on the ROM or the dump'),
      jsonb_build_object('id', 'prod-2', 'what', 'Dust in the eye. Flushed and returned to work.', 'where', 'DR-101, Pattern 42', 'action', 'Eye-wash on the drill is restocked. Glasses on while the hole is collared')
    ),
    'delays', jsonb_build_array(
      jsonb_build_object('id', 'delay-1', 'fleetId', 'GD-103', 'reason', 'Grader down on Ramp 3 East. Road is 20 km/h and the windrow is low.'),
      jsonb_build_object('id', 'delay-2', 'fleetId', 'DZ-009', 'reason', 'No dozer for the Pit 2 floor. Do not clean the toe until the OCE re-inspects.'),
      jsonb_build_object('id', 'delay-3', 'fleetId', 'EX-202', 'reason', 'Pit 1 is not digging. The shovel face on North Cut is the waste circuit.'),
      jsonb_build_object('id', 'delay-4', 'fleetId', 'WT-020', 'reason', 'In the workshop. WT-021 is the only cart. Extra pass on the south haul before 22:00.')
    ),
    'oce', (
      select jsonb_build_object('fileName', r.file_name, 'briefing', r.briefing)
      from public.oce_reports r where r.shift_id = s.id
    ),
    'allocations', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'fleetId', a.fleet_id, 'machine', a.make_model, 'operator', c.display_name, 'location', coalesce(a.location, '')
      ) order by a.fleet_id), '[]'::jsonb)
      from public.shift_machine_operators smo
      join public.assets a on a.id = smo.asset_id
      join public.crew_members c on c.id = smo.crew_member_id
      where smo.shift_id = s.id
    ),
    'notCrewed', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'fleetId', a.fleet_id, 'machine', a.make_model, 'location', coalesce(a.location, '')
      ) order by a.fleet_id), '[]'::jsonb)
      from public.assets a
      where a.asset_type in ('Haul Truck', 'Excavator', 'Dozer', 'Grader', 'Electric Shovel', 'Wheel Dozer', 'Wheel Loader', 'Water Cart', 'Blast Drill')
        and a.status = 'OPERATIONAL' and not a.in_shift
        and not exists (
          select 1 from public.shift_machine_operators smo
          where smo.shift_id = s.id and smo.asset_id = a.id
        )
    ),
    'inWorkshop', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'fleetId', a.fleet_id, 'location', coalesce(a.location, ''), 'expected', coalesce(a.expected_up::text, '')
      ) order by a.fleet_id), '[]'::jsonb)
      from public.assets a
      where a.asset_type in ('Haul Truck', 'Excavator', 'Dozer', 'Grader', 'Electric Shovel', 'Wheel Dozer', 'Wheel Loader', 'Water Cart', 'Blast Drill')
        and a.status <> 'OPERATIONAL'
    )
  )
from public.shift_records s
where s.status = 'ACTIVE'
on conflict (shift_id) do nothing;

update public.shift_handovers h
set document = h.document || jsonb_build_object(
  'safetyIncidents', jsonb_build_array(
    jsonb_build_object('id', 'wx-1', 'what', 'Isolation was put on the wrong point on EX-202. Corrected before work started.', 'where', 'Workshop, EX-202', 'action', 'Confirm the isolation point on the machine before the lock goes on'),
    jsonb_build_object('id', 'wx-2', 'what', 'Fitter slipped on the washpad. No injury.', 'where', 'Washpad', 'action', 'Spill is cleaned. Keep truck mud off the washpad')
  ),
  'safetyFocus', 'Confirm the isolation point before the lock goes on. A spotter stays in place for any truck move in the workshop.'
)
where h.shift_id in (select id from public.shift_records where status = 'ACTIVE')
  and not (h.document ? 'safetyIncidents');

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'oce_reports'
  ) then
    alter publication supabase_realtime add table public.oce_reports;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'production_handovers'
  ) then
    alter publication supabase_realtime add table public.production_handovers;
  end if;
end $$;

commit;
