alter table public.shift_handovers
  add column if not exists outgoing_signed_by text,
  add column if not exists outgoing_signed_at timestamptz,
  add column if not exists oncoming_signed_by text,
  add column if not exists oncoming_signed_at timestamptz;

create or replace function public.lock_signed_shift_handover()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.outgoing_signed_at is not null then
    if old.oncoming_signed_at is not null
      or new.oncoming_signed_at is null
      or new.oncoming_signed_by is null
      or (
        new.id,
        new.shift_id,
        new.shift_name,
        new.shift_date,
        new.shift_type,
        new.crew,
        new.supervisor,
        new.document,
        new.outgoing_signed_by,
        new.outgoing_signed_at
      ) is distinct from (
        old.id,
        old.shift_id,
        old.shift_name,
        old.shift_date,
        old.shift_type,
        old.crew,
        old.supervisor,
        old.document,
        old.outgoing_signed_by,
        old.outgoing_signed_at
      )
    then
      raise exception 'STATUTORY HANDOVER LOCKED (OUTGOING SIGNED)';
    end if;
  elsif new.oncoming_signed_at is not null then
    raise exception 'OUTGOING SIGN-OFF REQUIRED BEFORE ONCOMING ACKNOWLEDGEMENT';
  end if;

  return new;
end;
$$;

drop trigger if exists shift_handover_lock_signed on public.shift_handovers;
create trigger shift_handover_lock_signed
  before update on public.shift_handovers
  for each row execute function public.lock_signed_shift_handover();

revoke execute on function public.lock_signed_shift_handover() from public, anon, authenticated;
