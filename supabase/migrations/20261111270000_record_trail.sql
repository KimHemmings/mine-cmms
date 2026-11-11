-- Keep the previous value whenever a supervisor-facing record changes.
begin;

create table if not exists public.record_events (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  previous jsonb,
  next jsonb,
  changed_by text,
  changed_at timestamptz not null default now()
);

create index if not exists record_events_changed_idx on public.record_events (changed_at desc);

alter table public.record_events enable row level security;
revoke all on public.record_events from anon, public;
grant select on public.record_events to authenticated;

create policy record_events_select on public.record_events
  for select to authenticated
  using ((select public.app_user_role()) in ('management', 'training', 'production'));

create or replace function public.log_record_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_old jsonb;
  v_id text;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_id := coalesce(v_old->>'id', v_old->>'crew_member_id', v_old->>'shift_id', 'unknown');
    insert into public.record_events (table_name, record_id, action, previous, next, changed_by)
    values (tg_table_name, v_id, 'delete', v_old, null, public.app_user_name());
    return old;
  end if;

  v_row := to_jsonb(new);
  v_id := coalesce(v_row->>'id', v_row->>'crew_member_id', v_row->>'shift_id', 'unknown');
  v_old := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  insert into public.record_events (table_name, record_id, action, previous, next, changed_by)
  values (tg_table_name, v_id, lower(tg_op), v_old, v_row, public.app_user_name());
  return new;
end;
$$;

revoke execute on function public.log_record_change() from public, anon, authenticated;

drop trigger if exists operator_passouts_audit on public.operator_passouts;
create trigger operator_passouts_audit
  after insert or update or delete on public.operator_passouts
  for each row execute function public.log_record_change();

drop trigger if exists crew_supervision_audit on public.crew_supervision;
create trigger crew_supervision_audit
  after insert or update or delete on public.crew_supervision
  for each row execute function public.log_record_change();

drop trigger if exists crew_authorisations_audit on public.crew_authorisations;
create trigger crew_authorisations_audit
  after insert or update or delete on public.crew_authorisations
  for each row execute function public.log_record_change();

drop trigger if exists shift_handovers_audit on public.shift_handovers;
create trigger shift_handovers_audit
  after insert or update or delete on public.shift_handovers
  for each row execute function public.log_record_change();

drop trigger if exists production_handovers_audit on public.production_handovers;
create trigger production_handovers_audit
  after insert or update or delete on public.production_handovers
  for each row execute function public.log_record_change();

drop trigger if exists oce_reports_audit on public.oce_reports;
create trigger oce_reports_audit
  after insert or update or delete on public.oce_reports
  for each row execute function public.log_record_change();

commit;
