'use client';

import { HandoverRecord, PIT_CHECK_ROWS, PitCheckKey, PitCheckValues } from '@/utils/productionHandoverRecord';

export type { PitCheckValues } from '@/utils/productionHandoverRecord';
export { EMPTY_PIT_CHECKS, pitCheckLines } from '@/utils/productionHandoverRecord';

export default function PitChecksCard({
  shiftDate,
  shiftName,
  crewGroup,
  values,
  carried,
  onEdit,
  onCommit,
}: {
  shiftDate: string;
  shiftName: string;
  crewGroup: string | null;
  values: PitCheckValues;
  carried: string[];
  onEdit: (partial: Partial<HandoverRecord>) => void;
  onCommit: (partial: Partial<HandoverRecord>, key: PitCheckKey) => void;
}) {
  return (
    <section className="bg-white border border-slate-300 rounded-xl p-4 shadow-2xs space-y-3">
      <div>
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Statutory Pit & OCE Checks</h3>
        <p className="text-sm text-slate-500">{shiftName} · {shiftDate}{crewGroup ? ` · ${crewGroup} Crew` : ''}</p>
      </div>
      {!crewGroup ? (
        <p className="text-sm font-bold text-amber-800">The active crew is not set, so these checks cannot be saved yet.</p>
      ) : (
        <div className="space-y-3">
          {PIT_CHECK_ROWS.map((row) => (
            <div key={row.status} className="grid gap-2 md:grid-cols-[1.1fr_0.8fr_1.4fr] md:items-center">
              <div>
                <p className="text-sm font-black text-slate-800">{row.label}</p>
                {carried.includes(row.key) && (
                  <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-900">
                    CARRIED OVER FROM PREV SHIFT
                  </span>
                )}
              </div>
              <select
                value={values[row.status]}
                onChange={(event) => onCommit({ [row.status]: event.target.value }, row.key)}
                className="min-h-11 rounded-lg border-2 border-slate-300 bg-white px-2 text-sm font-bold text-slate-900"
              >
                {!row.options.includes(values[row.status]) && values[row.status] && (
                  <option value={values[row.status]}>{values[row.status]}</option>
                )}
                {row.options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <input
                value={values[row.notes]}
                onChange={(event) => onEdit({ [row.notes]: event.target.value })}
                onBlur={(event) => onCommit({ [row.notes]: event.target.value }, row.key)}
                placeholder="Note"
                className="min-h-11 rounded-lg border-2 border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
