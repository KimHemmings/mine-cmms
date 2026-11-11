-- Base operational schema, captured from the original mine-cmms project.

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  fleet_id varchar(50) not null unique,
  asset_type varchar(50) not null,
  make_model varchar(100) not null,
  current_hours numeric(10,1) default 0.0,
  status varchar(30) default 'OPERATIONAL',
  location varchar(100),
  created_at timestamptz default now(),
  priority varchar(10) default 'P3',
  in_shift boolean default false,
  shift_task text,
  fitter_assigned varchar(100),
  shift_stage varchar(30) default 'IN_PROGRESS',
  down_since timestamptz,
  expected_up timestamptz,
  actual_up timestamptz,
  component_system varchar(50) default 'Hydraulics',
  work_order_num varchar(50),
  sap_notification varchar(50),
  component_systems text[] default array['General'::text],
  machine_owner varchar(50) default 'Central',
  serial_number varchar(50)
);

create index if not exists idx_assets_serial_number on public.assets using btree (serial_number);

create table if not exists public.shift_records (
  id uuid primary key default gen_random_uuid(),
  shift_name varchar(50) not null,
  shift_date date not null default current_date,
  supervisor varchar(100),
  status varchar(20) default 'ACTIVE',
  handover_notes text,
  started_at timestamptz default now(),
  closed_at timestamptz,
  crew text default 'A Crew',
  shift_type text default 'DAY'
);

create table if not exists public.machine_work_orders (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.assets (id) on delete cascade,
  shift_id uuid references public.shift_records (id),
  wo_number varchar(50),
  notification_num varchar(50),
  order_type varchar(20) default 'UNPLANNED',
  task_description text not null,
  component_systems text[] default array['General'::text],
  fitter_assigned varchar(100),
  stage varchar(30) default 'DIAGNOSING',
  status varchar(20) default 'OPEN',
  completed_at timestamptz,
  completed_by varchar(100),
  created_at timestamptz default now(),
  is_main_event boolean default false,
  takes_machine_down boolean default true
);

create table if not exists public.work_order_parts (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.machine_work_orders (id) on delete cascade,
  part_number varchar(100),
  description text not null,
  po_or_reservation varchar(100),
  is_special_run boolean default false,
  carrier_details varchar(255),
  eta timestamptz,
  status varchar(50) default 'ordered',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.asset_history_notes (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.assets (id) on delete cascade,
  fitter_name varchar(100) not null,
  note text not null,
  stage varchar(50),
  created_at timestamptz default now()
);

create table if not exists public.defect_watchlist (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.assets (id) on delete cascade,
  severity varchar(10) not null check (severity in ('CAT1', 'CAT2', 'CAT3')),
  description text not null,
  reported_by varchar(100) not null,
  status varchar(20) default 'OPEN',
  created_at timestamptz default now(),
  rectified_by varchar(100),
  rectified_at timestamptz,
  shift_id uuid references public.shift_records (id) on delete cascade,
  wo_number varchar(50),
  notification_num varchar(50),
  order_type varchar(20) default 'UNPLANNED',
  component_systems text[] default array['General'::text],
  fitter_assigned varchar(100),
  stage varchar(30) default 'DIAGNOSING'
);

create table if not exists public.downtime_logs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.assets (id) on delete cascade,
  down_start timestamptz not null default now(),
  down_end timestamptz,
  downtime_type varchar(30) not null,
  notes text,
  fitter_name varchar(100)
);

create table if not exists public.outstanding_parts (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.assets (id) on delete cascade,
  work_order_id uuid references public.machine_work_orders (id) on delete set null,
  part_number text not null,
  description text not null,
  supplier text not null,
  ordered_at timestamptz default now(),
  expected_arrival timestamptz,
  freight_type text check (freight_type in ('HOTSHOT_SPECIAL', 'OVERNIGHT_AIR', 'STANDARD_ROAD')),
  status text default 'ORDERED' check (status in ('ORDERED', 'IN_TRANSIT', 'DELIVERED_TO_GATE', 'FITTED')),
  consignment_note text,
  critical_hold boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.specials_on_order (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.assets (id) on delete set null,
  part_number varchar(100) not null,
  description text not null,
  po_number varchar(50),
  supplier varchar(100),
  carrier_tracking varchar(100),
  eta date,
  status varchar(20) default 'ORDERED'
);

do $$
declare
  t text;
begin
  foreach t in array array['assets', 'machine_work_orders', 'defect_watchlist', 'asset_history_notes']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
