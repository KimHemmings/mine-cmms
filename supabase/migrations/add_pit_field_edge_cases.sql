-- Park-up time and circuit live on public.assets (the fleet table).
-- carried_fields keeps an amber "still from the previous shift" mark
-- until the oncoming supervisor updates that check.

alter table public.assets
  add column if not exists location_updated_at timestamptz;

alter table public.assets
  add column if not exists circuit text;

alter table public.production_handover_checks
  add column if not exists carried_fields text[] not null default '{}';

alter table public.crew_members
  drop constraint if exists crew_members_allocated_role_check;

alter table public.crew_members
  add constraint crew_members_allocated_role_check
  check (
    allocated_role is null
    or allocated_role in ('Primary', 'Hot Seat', 'Trainee (Buddy Seat)')
  );

create or replace function public.touch_asset_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.location is distinct from old.location then
    new.location_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists assets_touch_location on public.assets;
create trigger assets_touch_location
  before update of location on public.assets
  for each row execute function public.touch_asset_location();

revoke execute on function public.touch_asset_location() from public, anon, authenticated;
