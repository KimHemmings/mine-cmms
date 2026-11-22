-- A signed production handover cannot be rewritten.
-- Later notes go in handover_amendments instead.

create table if not exists public.handover_amendments (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid not null references public.production_handover_checks(id) on delete cascade,
  amended_by text not null,
  amendment_note text not null,
  created_at timestamptz not null default now()
);

create index if not exists handover_amendments_handover_idx
  on public.handover_amendments (handover_id, created_at);

alter table public.handover_amendments enable row level security;
revoke all on public.handover_amendments from anon, public;
grant select, insert on public.handover_amendments to authenticated;

drop policy if exists "Authenticated users can read handover amendments" on public.handover_amendments;
create policy "Authenticated users can read handover amendments"
  on public.handover_amendments for select to authenticated
  using (true);

drop policy if exists "Supervisors can add handover amendments" on public.handover_amendments;
create policy "Supervisors can add handover amendments"
  on public.handover_amendments for insert to authenticated
  with check (public.app_user_access_level() >= 3);

create or replace function public.lock_signed_production_handover()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.outgoing_signed_at is not null and old.oncoming_signed_at is not null then
    raise exception 'STATUTORY RECORD LOCKED (SIGNED OFF)';
  end if;
  return new;
end;
$$;

drop trigger if exists production_handover_checks_lock_signed on public.production_handover_checks;
create trigger production_handover_checks_lock_signed
  before update on public.production_handover_checks
  for each row execute function public.lock_signed_production_handover();

revoke execute on function public.lock_signed_production_handover() from public, anon, authenticated;
