'use client';

import { CREW_PANELS, CrewMember } from '@/types';

export function IncomingCrewPicker({
  panel,
  crew,
  onChange,
}: {
  panel: string | null;
  crew: CrewMember[];
  onChange: (panel: string) => void;
}) {
  const people = crew.filter((member) => member.active && member.panel === panel);

  return (
    <section className="mt-4 rounded-xl border border-slate-200 p-4">
      <h3 className="text-base font-black text-slate-900">Who is coming on</h3>
      <p className="text-sm text-slate-600 mt-1">
        The briefing is written for this crew. Open jobs stay with the people already named on them.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
        {CREW_PANELS.map((item) => {
          const count = crew.filter((member) => member.active && member.panel === item).length;
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
              <span className={`block text-xs ${selected ? 'text-slate-300' : 'text-slate-500'}`}>{count} on the roster</span>
            </button>
          );
        })}
      </div>
      {panel && (
        <p className="text-sm text-slate-700 mt-3">
          {people.length === 0
            ? `No one is rostered on ${panel}.`
            : people.map((member) => member.display_name).join(', ')}
        </p>
      )}
    </section>
  );
}
