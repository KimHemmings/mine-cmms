alter table public.oce_reports add column if not exists file_size bigint;

drop policy if exists oce_reports_crew_select on public.oce_reports;
create policy oce_reports_crew_select on public.oce_reports
  for select to authenticated
  using (true);

drop policy if exists oce_reports_storage_crew_select on storage.objects;
create policy oce_reports_storage_crew_select on storage.objects
  for select to authenticated
  using (bucket_id = 'oce-reports');
