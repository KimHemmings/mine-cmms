-- Machine pass-outs are training records. A supervisor cannot put someone on a machine without one.
begin;

drop policy if exists operator_passouts_insert on public.operator_passouts;
drop policy if exists operator_passouts_update on public.operator_passouts;
drop policy if exists operator_passouts_delete on public.operator_passouts;

create policy operator_passouts_insert on public.operator_passouts
  for insert to authenticated
  with check ((select public.app_user_role()) = 'training');
create policy operator_passouts_update on public.operator_passouts
  for update to authenticated
  using ((select public.app_user_role()) = 'training')
  with check ((select public.app_user_role()) = 'training');
create policy operator_passouts_delete on public.operator_passouts
  for delete to authenticated
  using ((select public.app_user_role()) = 'training');

create or replace function public.require_machine_passout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.operator_passouts
    where crew_member_id = new.crew_member_id
      and asset_id = new.asset_id
      and expires_on >= current_date
  ) then
    raise exception 'That operator is not passed out on this machine';
  end if;
  return new;
end;
$$;

drop trigger if exists shift_machine_operators_passout on public.shift_machine_operators;
create trigger shift_machine_operators_passout
  before insert or update on public.shift_machine_operators
  for each row execute function public.require_machine_passout();

revoke execute on function public.require_machine_passout() from public, anon, authenticated;

commit;
