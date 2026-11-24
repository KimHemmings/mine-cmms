alter table public.shift_handovers
  add column if not exists shift_summary text,
  add column if not exists oce_summary text;
