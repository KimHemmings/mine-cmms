create table if not exists public.parts_board (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.assets (id) on delete set null,
  fleet_id text not null,
  kind text not null check (kind in ('on_order', 'hotshot', 'borrowed')),
  supplier text,
  ordered_on date,
  eta date,
  description text not null,
  reason text,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.parts_board enable row level security;

grant select, insert, update, delete on public.parts_board to authenticated;

drop policy if exists "Authenticated users can read parts board" on public.parts_board;
create policy "Authenticated users can read parts board"
  on public.parts_board for select to authenticated
  using (true);

drop policy if exists "Supervisors can manage parts board" on public.parts_board;
create policy "Supervisors can manage parts board"
  on public.parts_board for all to authenticated
  using (public.app_user_access_level() >= 3)
  with check (public.app_user_access_level() >= 3);
