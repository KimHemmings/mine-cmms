-- Hold ETA sits on the job. Permanent fleet details stay with the workshop supervisor.

begin;

alter table public.machine_work_orders
  add column if not exists hold_eta text;

create or replace function public.guard_permanent_fleet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if public.app_user_department() is distinct from 'workshop'
       or public.app_user_access_level() is distinct from 3 then
      raise exception 'Only a workshop supervisor can add a machine';
    end if;
    return new;
  end if;

  if new.fleet_id is distinct from old.fleet_id
     or new.make_model is distinct from old.make_model
     or new.asset_type is distinct from old.asset_type
     or new.serial_number is distinct from old.serial_number
     or new.machine_owner is distinct from old.machine_owner then
    if public.app_user_department() is distinct from 'workshop'
       or public.app_user_access_level() is distinct from 3 then
      raise exception 'Only a workshop supervisor can change the permanent machine record';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists assets_guard_permanent_fleet on public.assets;
create trigger assets_guard_permanent_fleet
  before insert or update on public.assets
  for each row execute function public.guard_permanent_fleet();

revoke execute on function public.guard_permanent_fleet() from public, anon, authenticated;

create or replace function public.set_shift_panel(p_shift_id uuid, p_crew text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.app_user_access_level() is distinct from 3 then
    raise exception 'Only a supervisor can change the crew on shift';
  end if;

  update public.shift_records set crew = p_crew where id = p_shift_id;
  if not found then
    raise exception 'Shift not found' using errcode = '42501';
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
