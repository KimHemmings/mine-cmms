-- A fitter sign-in can be tied to one person, so "My jobs" follows that person.
begin;

alter table public.profiles
  add column if not exists crew_member_id uuid references public.crew_members (id) on delete set null;

create unique index if not exists profiles_crew_member_id_key
  on public.profiles (crew_member_id)
  where crew_member_id is not null;

create or replace function public.link_my_crew(p_crew_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select public.app_user_role()) is distinct from 'fitter' then
    raise exception 'Only a fitter can link their sign-in to a person';
  end if;

  if p_crew_member_id is not null then
    if not exists (
      select 1 from public.crew_members where id = p_crew_member_id and active
    ) then
      raise exception 'That person is not on the crew list';
    end if;
    if exists (
      select 1 from public.profiles
      where crew_member_id = p_crew_member_id
        and id <> (select auth.uid())
    ) then
      raise exception 'That person is already linked to another sign-in';
    end if;
  end if;

  update public.profiles
  set crew_member_id = p_crew_member_id
  where id = (select auth.uid());
end;
$$;

revoke execute on function public.link_my_crew(uuid) from public, anon;
grant execute on function public.link_my_crew(uuid) to authenticated;

commit;
