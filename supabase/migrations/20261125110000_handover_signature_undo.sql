create or replace function public.lock_signed_shift_handover()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  body_changed boolean;
  outgoing_unchanged boolean;
  outgoing_cleared boolean;
  oncoming_added boolean;
  oncoming_cleared boolean;
begin
  if old.outgoing_signed_at is null then
    if new.oncoming_signed_at is not null then
      raise exception 'OUTGOING SIGN-OFF REQUIRED BEFORE ONCOMING ACKNOWLEDGEMENT';
    end if;
    return new;
  end if;

  body_changed := (
    new.id,
    new.shift_id,
    new.shift_name,
    new.shift_date,
    new.shift_type,
    new.crew,
    new.supervisor,
    new.document,
    new.shift_summary,
    new.oce_summary
  ) is distinct from (
    old.id,
    old.shift_id,
    old.shift_name,
    old.shift_date,
    old.shift_type,
    old.crew,
    old.supervisor,
    old.document,
    old.shift_summary,
    old.oce_summary
  );

  outgoing_unchanged := new.outgoing_signed_by is not distinct from old.outgoing_signed_by
    and new.outgoing_signed_at is not distinct from old.outgoing_signed_at;
  outgoing_cleared := new.outgoing_signed_at is null and new.outgoing_signed_by is null;
  oncoming_added := old.oncoming_signed_at is null
    and new.oncoming_signed_at is not null
    and new.oncoming_signed_by is not null;
  oncoming_cleared := new.oncoming_signed_at is null and new.oncoming_signed_by is null;

  if body_changed then
    raise exception 'STATUTORY HANDOVER LOCKED (OUTGOING SIGNED)';
  end if;

  if oncoming_added and outgoing_unchanged then
    return new;
  end if;

  if oncoming_cleared and outgoing_unchanged then
    return new;
  end if;

  if outgoing_cleared and oncoming_cleared then
    return new;
  end if;

  raise exception 'STATUTORY HANDOVER LOCKED (OUTGOING SIGNED)';
end;
$$;

revoke execute on function public.lock_signed_shift_handover() from public, anon, authenticated;
