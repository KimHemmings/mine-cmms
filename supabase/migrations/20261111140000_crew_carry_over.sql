-- Crews carry over between shifts: rollover sets the incoming panel and loads its members,
-- and a manager can switch the panel on the current shift in one step.
begin;

drop function if exists public.rollover_shift(uuid);

create or replace function public.rollover_shift(p_current_shift_id uuid, p_next_crew text default null)
returns public.shift_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.shift_records;
  v_new public.shift_records;
  v_next_type text;
  v_next_crew text;
begin
  if public.app_user_role() is distinct from 'management' then
    raise exception 'Only management can roll over a shift' using errcode = '42501';
  end if;

  select * into v_current
  from public.shift_records
  where id = p_current_shift_id and status = 'ACTIVE'
  for update;

  if not found then
    raise exception 'This shift has already been rolled over. Refresh the board.';
  end if;

  v_next_type := case when v_current.shift_type = 'DAY' then 'NIGHT' else 'DAY' end;

  -- Default to the panel that last worked this shift type; fixed panels repeat the same swing.
  v_next_crew := coalesce(
    nullif(trim(p_next_crew), ''),
    (select crew from public.shift_records
      where shift_type = v_next_type and id <> v_current.id
      order by started_at desc limit 1),
    v_current.crew
  );

  update public.shift_records
  set status = 'HANDED_OVER', closed_at = now()
  where id = v_current.id;

  insert into public.shift_records (shift_name, shift_type, crew, shift_date, supervisor, status)
  values (
    case when v_next_type = 'DAY' then 'Day Shift' else 'Night Shift' end,
    v_next_type,
    v_next_crew,
    (now() at time zone 'Australia/Brisbane')::date,
    public.app_user_name(),
    'ACTIVE'
  )
  returning * into v_new;

  insert into public.shift_crew (shift_id, crew_member_id)
  select v_new.id, c.id
  from public.crew_members c
  where c.active and c.panel = v_next_crew;

  update public.machine_work_orders
  set shift_id = v_new.id
  where status = 'OPEN';

  return v_new;
end;
$$;

revoke execute on function public.rollover_shift(uuid, text) from public, anon;
grant execute on function public.rollover_shift(uuid, text) to authenticated;

-- Switch which panel is on the current shift; replaces the on-shift list (runs as caller, RLS applies).
create or replace function public.set_shift_panel(p_shift_id uuid, p_crew text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.shift_records set crew = p_crew where id = p_shift_id;
  if not found then
    raise exception 'Shift not found or you are not allowed to change it' using errcode = '42501';
  end if;

  delete from public.shift_crew where shift_id = p_shift_id;

  insert into public.shift_crew (shift_id, crew_member_id)
  select p_shift_id, c.id
  from public.crew_members c
  where c.active and c.panel = p_crew;
end;
$$;

revoke execute on function public.set_shift_panel(uuid, text) from public, anon;
grant execute on function public.set_shift_panel(uuid, text) to authenticated;

commit;
