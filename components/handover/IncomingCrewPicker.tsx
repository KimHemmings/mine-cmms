'use client';

import { CREW_PANELS } from '@/types';

export function IncomingCrewPicker({
  panel,
  counts,
  onChange,
}: {
  panel: string | null;
  counts: { panel: string; count: number }[];
  onChange: (panel: string) => void;
}) {
  const countFor = (item: string) => counts.find((row) => row.panel === item)?.count ?? 0;

  return (
    <section className="mt-4 rounded-xl border border-slate-200 p-4">
      <h3 className="text-base font-black text-slate-900">Who is coming on</h3>
      <p className="text-sm text-slate-600 mt-1">
        Counts are workshop trades only. Open jobs stay with the people already named on them.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
        {CREW_PANELS.map((item) => {
          const count = countFor(item);
          const selected = panel === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              aria-pressed={selected}
              className={`min-h-14 px-3 rounded-xl border-2 text-left transition ${
                selected ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-300 text-slate-800 hover:border-slate-500'
              }`}
            >
              <span className="block text-sm font-black">{item}</span>
              <span className={`block text-xs ${selected ? 'text-slate-300' : 'text-slate-500'}`}>{count} workshop on shift</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
