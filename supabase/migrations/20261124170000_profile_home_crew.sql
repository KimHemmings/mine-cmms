begin;

alter table public.profiles
  add column if not exists crew_name text
  check (crew_name is null or crew_name in ('A Crew', 'B Crew', 'C Crew', 'D Crew'));

create or replace function public.set_home_crew(p_crew text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_crew is null or p_crew not in ('A Crew', 'B Crew', 'C Crew', 'D Crew') then
    raise exception 'Choose a valid crew';
  end if;

  update public.profiles
  set crew_name = p_crew
  where id = auth.uid()
    and active
    and crew_name is null;

  if not found then
    raise exception 'Home crew is already set or profile is unavailable';
  end if;
end;
$$;

revoke execute on function public.set_home_crew(text) from public, anon;
grant execute on function public.set_home_crew(text) to authenticated;

commit;
