'use client';

import { CREW_PANELS } from '@/types';

export function IncomingCrewPicker({
  panel,
  shiftType,
  onChange,
}: {
  panel: string | null;
  shiftType: string | null;
  onChange: (panel: string | null) => void;
}) {
  return (
    <section className="mt-4 flex min-h-12 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
      <p className="text-sm font-black text-slate-900">
        Incoming: {panel ?? 'Crew not matched'} - {shiftType === 'NIGHT' ? 'Night' : 'Day'} Shift
      </p>
      <label className="shrink-0">
        <span className="sr-only">Override incoming crew</span>
        <select
          value=""
          onChange={(event) => onChange(event.target.value || null)}
          className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-slate-700"
          aria-label="Override"
        >
          <option value="">Override ▾</option>
          {CREW_PANELS.map((crew) => <option key={crew} value={crew}>{crew}</option>)}
        </select>
      </label>
    </section>
  );
}
