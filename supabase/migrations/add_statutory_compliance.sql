-- Fatigue, ticket expiry, statutory plant, HPI close-out, and the OT budget.

alter table public.crew_members
  add column if not exists last_shift_ended_at timestamptz,
  add column if not exists overtime_reason text,
  add column if not exists voc_expiries jsonb not null default '{}'::jsonb,
  add column if not exists medical_expiry date,
  add column if not exists standard11_expiry date,
  add column if not exists fatigue_override_by text,
  add column if not exists fatigue_override_at timestamptz;

alter table public.crew_members drop constraint if exists crew_members_overtime_reason_check;
alter table public.crew_members
  add constraint crew_members_overtime_reason_check
  check (
    overtime_reason is null
    or overtime_reason in ('Annual Leave Cover', 'Unplanned Absence', 'Open Vacancy', 'Breakdown Surge')
  );

alter table public.crew_members drop constraint if exists crew_members_allocated_role_check;
alter table public.crew_members
  add constraint crew_members_allocated_role_check
  check (
    allocated_role is null
    or allocated_role in ('Primary', 'Hot Seat', 'Trainee (Buddy Seat)', 'Crib Floater')
  );

alter table public.assets
  add column if not exists current_smu numeric,
  add column if not exists next_service_smu numeric,
  add column if not exists statutory_inspection_due date;

alter table public.production_handover_checks
  add column if not exists plant_delay_hours numeric,
  add column if not exists blasted_inventory_shifts numeric;

alter table public.site_targets_rates
  add column if not exists budgeted_ot_contractor_shift numeric not null default 0;
