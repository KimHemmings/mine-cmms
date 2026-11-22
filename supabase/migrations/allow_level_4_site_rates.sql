-- Departmental superintendents (level 4) and the SSE / GM (level 5)
-- can both calibrate the one site rates row.

drop policy if exists "SSE can insert site targets" on public.site_targets_rates;
drop policy if exists "SSE can update site targets" on public.site_targets_rates;
drop policy if exists "Superintendents can insert site targets" on public.site_targets_rates;
drop policy if exists "Superintendents can update site targets" on public.site_targets_rates;

create policy "Superintendents can insert site targets"
  on public.site_targets_rates for insert to authenticated
  with check (public.app_user_access_level() >= 4);

create policy "Superintendents can update site targets"
  on public.site_targets_rates for update to authenticated
  using (public.app_user_access_level() >= 4)
  with check (public.app_user_access_level() >= 4);
