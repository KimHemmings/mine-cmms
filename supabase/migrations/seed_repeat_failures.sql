-- Three repeat breakdowns inside a 14-day window.
-- Safe to run again: the seed work orders are removed and inserted again.

delete from public.machine_work_orders
where wo_number like 'SEED-REPEAT-%';

insert into public.machine_work_orders (
  asset_id, order_type, task_description, component_systems, stage, status,
  created_at, completed_at, completed_by, is_main_event, takes_machine_down, wo_number
)
select asset.id, row.order_type, row.task_description, array[row.component], row.stage, row.status,
       row.created_at, row.completed_at, row.completed_by, false, true, row.wo_number
from (
  values
    ('EX-201', 'UNPLANNED', 'Stick hose blown', 'Hydraulics', 'COMPLETED', 'COMPLETED',
      timestamptz '2026-11-14 06:30:00+10', timestamptz '2026-11-14 14:30:00+10', 'Workshop', 'SEED-REPEAT-EX201-1'),
    ('EX-201', 'UNPLANNED', 'Manifold hose burst', 'Hydraulics', 'COMPLETED', 'COMPLETED',
      timestamptz '2026-11-19 07:00:00+10', timestamptz '2026-11-19 19:00:00+10', 'Workshop', 'SEED-REPEAT-EX201-2'),
    ('EX-201', 'UNPLANNED', 'Stick hose weeping again', 'Hydraulics', 'IN_PROGRESS', 'OPEN',
      timestamptz '2026-11-23 00:15:00+10', null::timestamptz, null::text, 'SEED-REPEAT-EX201-3'),
    ('DT-045', 'UNPLANNED', 'Retarder housing oil leak', 'Brakes & Retarder', 'COMPLETED', 'COMPLETED',
      timestamptz '2026-11-17 09:00:00+10', timestamptz '2026-11-17 15:30:00+10', 'Workshop', 'SEED-REPEAT-DT045-1'),
    ('DT-045', 'UNPLANNED', 'Service brake dragging on the ramp', 'Brakes & Retarder', 'IN_PROGRESS', 'OPEN',
      timestamptz '2026-11-22 14:00:00+10', null::timestamptz, null::text, 'SEED-REPEAT-DT045-2'),
    ('DZ-008', 'UNPLANNED', 'Blade lift hose burst', 'Hydraulics', 'COMPLETED', 'COMPLETED',
      timestamptz '2026-11-12 08:00:00+10', timestamptz '2026-11-12 13:00:00+10', 'Workshop', 'SEED-REPEAT-DZ008-1'),
    ('DZ-008', 'UNPLANNED', 'Blade lift hose weeping at the valve bank', 'Hydraulics', 'IN_PROGRESS', 'OPEN',
      timestamptz '2026-11-22 09:30:00+10', null::timestamptz, null::text, 'SEED-REPEAT-DZ008-2')
) as row(fleet_id, order_type, task_description, component, stage, status, created_at, completed_at, completed_by, wo_number)
join public.assets asset on asset.fleet_id = row.fleet_id;
