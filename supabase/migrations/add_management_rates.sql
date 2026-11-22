-- Dollar targets for Site Command. One site-wide row.
-- Level 4 superintendents and the Level 5 SSE / GM can update it.

create table if not exists public.management_rates (
  id integer primary key default 1 check (id = 1),
  availability_target_pct numeric not null default 85,
  use_of_availability_target_pct numeric not null default 90,
  down_unit_exposure numeric not null default 0,
  unmanned_unit_loss numeric not null default 0,
  workshop_ot_rate numeric not null default 0,
  workshop_contractor_rate numeric not null default 0,
  production_ot_rate numeric not null default 0,
  production_contractor_rate numeric not null default 0,
  rom_tonne_rate numeric not null default 0,
  bcm_rate numeric not null default 0,
  rom_shift_target numeric not null default 0,
  bcm_shift_target numeric not null default 0,
  updated_by text,
  updated_at timestamptz not null default now()
);

insert into public.management_rates (id) values (1)
on conflict (id) do nothing;

alter table public.management_rates enable row level security;
revoke all on public.management_rates from anon, public;
grant select on public.management_rates to authenticated;
grant insert, update on public.management_rates to authenticated;

drop policy if exists "Authenticated users can read rates" on public.management_rates;
create policy "Authenticated users can read rates"
  on public.management_rates for select to authenticated
  using (true);

drop policy if exists "Superintendents can insert rates" on public.management_rates;
create policy "Superintendents can insert rates"
  on public.management_rates for insert to authenticated
  with check (public.app_user_access_level() >= 4);

drop policy if exists "Superintendents can update rates" on public.management_rates;
create policy "Superintendents can update rates"
  on public.management_rates for update to authenticated
  using (public.app_user_access_level() >= 4)
  with check (public.app_user_access_level() >= 4);
