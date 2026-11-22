-- Notes belong to one work order. Older rows stay on the machine for history.

begin;

alter table public.asset_history_notes
  add column if not exists work_order_id uuid references public.machine_work_orders (id) on delete set null;

create index if not exists asset_history_notes_work_order_idx
  on public.asset_history_notes (work_order_id);

commit;
