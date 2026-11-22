-- Saleable-coal yield, waste rate, and separate contractor rates.
-- These sit beside the existing site_targets_rates row. They do not replace labour with fleet-hour costs.

alter table public.site_targets_rates
  add column if not exists chpp_wash_yield_pct numeric not null default 75,
  add column if not exists overburden_rate_per_bcm numeric not null default 5.50,
  add column if not exists operator_contractor_shift_cost numeric not null default 1380,
  add column if not exists trades_contractor_shift_cost numeric not null default 1680;
