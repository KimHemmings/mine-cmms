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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p className="text-sm font-bold text-slate-700 whitespace-nowrap">
        Incoming: <span className="font-black text-slate-900">{panel ?? 'Crew not matched'} - {shiftType === 'NIGHT' ? 'Night' : 'Day'} Shift</span>
      </p>
      <label className="shrink-0">
        <span className="sr-only">Override incoming crew</span>
        <select
          value=""
          onChange={(event) => onChange(event.target.value || null)}
          className="min-h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-bold text-slate-700"
          aria-label="Override"
        >
          <option value="">Override ▾</option>
          {CREW_PANELS.map((crew) => <option key={crew} value={crew}>{crew}</option>)}
        </select>
      </label>
    </div>
  );
}
