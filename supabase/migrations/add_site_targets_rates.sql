-- Bowen Basin benchmarks for Site Command. One site-wide row.
-- Level 5 SSE / GM can change the rates. Level 4 can read them.

create table if not exists public.site_targets_rates (
  id integer primary key default 1 check (id = 1),
  show_financials boolean not null default true,
  target_rom_tonnes_shift numeric not null default 15000,
  target_prime_bcm_shift numeric not null default 45000,
  target_primary_pa_pct numeric not null default 86,
  target_primary_uoa_pct numeric not null default 82,
  coal_margin_per_tonne numeric not null default 115,
  primary_digger_hr_cost numeric not null default 18500,
  primary_truck_hr_cost numeric not null default 4200,
  overtime_shift_cost numeric not null default 950,
  contractor_shift_cost numeric not null default 1450,
  chpp_wash_yield_pct numeric not null default 75,
  overburden_rate_per_bcm numeric not null default 5.50,
  operator_contractor_shift_cost numeric not null default 1380,
  trades_contractor_shift_cost numeric not null default 1680,
  updated_by text,
  updated_at timestamptz not null default now()
);

insert into public.site_targets_rates (id) values (1)
on conflict (id) do nothing;

alter table public.site_targets_rates enable row level security;
revoke all on public.site_targets_rates from anon, public;
grant select on public.site_targets_rates to authenticated;
grant insert, update on public.site_targets_rates to authenticated;

drop policy if exists "Authenticated users can read site targets" on public.site_targets_rates;
create policy "Authenticated users can read site targets"
  on public.site_targets_rates for select to authenticated
  using (true);

drop policy if exists "SSE can insert site targets" on public.site_targets_rates;
create policy "SSE can insert site targets"
  on public.site_targets_rates for insert to authenticated
  with check (public.app_user_access_level() = 5);

drop policy if exists "SSE can update site targets" on public.site_targets_rates;
create policy "SSE can update site targets"
  on public.site_targets_rates for update to authenticated
  using (public.app_user_access_level() = 5)
  with check (public.app_user_access_level() = 5);
