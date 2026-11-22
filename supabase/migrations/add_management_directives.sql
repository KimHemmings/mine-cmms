-- Directives a superintendent sends to one department. Supervisors can read them and mark them resolved.

create table if not exists public.management_directives (
  id uuid primary key default gen_random_uuid(),
  target_department text not null check (target_department in ('production', 'workshop', 'training')),
  title text not null,
  details text,
  priority text not null default 'High' check (priority in ('Critical', 'High', 'Normal')),
  status text not null default 'Open' check (status in ('Open', 'Resolved')),
  created_by text not null,
  created_at timestamptz not null default now(),
  resolved_by text,
  resolved_at timestamptz
);

alter table public.management_directives enable row level security;
revoke all on public.management_directives from anon, public;
grant select, insert, update on public.management_directives to authenticated;

drop policy if exists "Authenticated users can read directives" on public.management_directives;
create policy "Authenticated users can read directives"
  on public.management_directives for select to authenticated using (true);

drop policy if exists "Authenticated users can insert directives" on public.management_directives;
create policy "Authenticated users can insert directives"
  on public.management_directives for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update directives" on public.management_directives;
create policy "Authenticated users can update directives"
  on public.management_directives for update to authenticated using (true) with check (true);
