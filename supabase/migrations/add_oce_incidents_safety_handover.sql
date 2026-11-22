-- OCE inspection file, incidents, TARPs, production actuals, and sign-off
-- live on the production handover row for that 12-hour shift.
-- The oce-reports bucket already exists for supervisor uploads.
-- on conflict do nothing keeps that bucket private.
-- Downloads use a short-lived signed link.

insert into storage.buckets (id, name, public)
values ('oce-reports', 'oce-reports', true)
on conflict (id) do nothing;

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'text/plain',
  'application/octet-stream'
]
where id = 'oce-reports';

drop policy if exists oce_reports_handover_select on storage.objects;
create policy oce_reports_handover_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'oce-reports'
    and public.app_user_role() in ('management', 'production')
  );

drop policy if exists oce_reports_handover_insert on storage.objects;
create policy oce_reports_handover_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'oce-reports'
    and public.app_user_role() in ('management', 'production')
  );

alter table public.production_handover_checks
  add column if not exists oce_report_url text,
  add column if not exists oce_report_filename text,
  add column if not exists oce_report_uploaded_at timestamptz,
  add column if not exists oce_inspection_status text default 'Pending Upload',
  add column if not exists incidents jsonb not null default '[]'::jsonb,
  add column if not exists safety_awareness text,
  add column if not exists active_tarps jsonb not null default '[]'::jsonb,
  add column if not exists shift_production jsonb not null default '{}'::jsonb,
  add column if not exists services_status text default 'Normal',
  add column if not exists services_notes text,
  add column if not exists outgoing_signed_by text,
  add column if not exists outgoing_signed_at timestamptz,
  add column if not exists oncoming_signed_by text,
  add column if not exists oncoming_signed_at timestamptz;
