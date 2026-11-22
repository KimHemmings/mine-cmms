'use client';

import { useState } from 'react';
import { CREW_PANELS, CrewMember } from '@/types';
import { operatorEquipmentModels } from '@/utils/crewAllocation';
import { Asset } from '@/types';

type CrewPanel = (typeof CREW_PANELS)[number];
type CrewFilter = CrewPanel | 'all';

const FILTERS: { id: CrewFilter; label: string }[] = [
  ...CREW_PANELS.map((panel) => ({ id: panel as CrewFilter, label: panel.replace(' Crew', '') })),
  { id: 'all', label: 'All' },
];

export default function CompetencyBoard({
  crew,
  assets,
  onSave,
}: {
  crew: CrewMember[];
  assets: Asset[];
  onSave: (member: CrewMember, passed: string[], training: string[]) => Promise<boolean>;
}) {
  const [panel, setPanel] = useState<CrewFilter>('all');
  const [missingOnly, setMissingOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const models = operatorEquipmentModels(assets);
  const needle = query.trim().toLowerCase();
  const productionOperators = crew.filter((member) => member.active && (member.department || '').toLowerCase() === 'production');
  const missingCount = productionOperators.filter((member) => !member.away && (member.passed_out_equipment ?? []).length === 0).length;
  const operators = productionOperators
    .filter((member) => panel === 'all' || member.panel === panel)
    .filter((member) => !missingOnly || (!member.away && (member.passed_out_equipment ?? []).length === 0))
    .filter((member) => !needle || member.display_name.toLowerCase().includes(needle) || (member.employee_id || '').toLowerCase().includes(needle))
    .slice()
    .sort((a, b) => (a.panel || '').localeCompare(b.panel || '') || a.display_name.localeCompare(b.display_name));

  const toggle = async (member: CrewMember, model: string, list: 'passed' | 'training') => {
    const passed = new Set(member.passed_out_equipment ?? []);
    const training = new Set(member.in_training_equipment ?? []);
    if (list === 'passed') {
      if (passed.has(model)) passed.delete(model);
      else {
        passed.add(model);
        training.delete(model);
      }
    } else if (training.has(model)) {
      training.delete(model);
    } else {
      training.add(model);
      passed.delete(model);
    }
    setSavingId(member.id);
    await onSave(member, [...passed], [...training]);
    setSavingId(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-slate-900">Production Operator Pass-Outs</h2>
        <p className="text-sm text-slate-500">Passed out is a ticket. In training is the buddy seat until you sign them out.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setPanel(filter.id)}
            className={`min-h-10 px-3 rounded-full border text-sm font-black ${panel === filter.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
          >
            {filter.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={missingOnly}
          onClick={() => setMissingOnly((value) => !value)}
          className={`min-h-10 px-3 rounded-full border text-sm font-black ${missingOnly ? 'bg-amber-700 text-white border-amber-700' : 'bg-amber-50 text-amber-950 border-amber-300'}`}
        >
          Missing Pass-Outs ({missingCount})
        </button>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search operator"
          className="min-h-10 flex-1 min-w-48 rounded-lg border-2 border-slate-300 px-3 text-sm"
        />
      </div>
      {operators.length === 0 ? (
        <p className="p-4 rounded-lg border border-dashed border-slate-300 text-sm text-slate-600">No production operators match.</p>
      ) : (
        <ul className="space-y-3">
          {operators.map((member) => {
            const passed = new Set(member.passed_out_equipment ?? []);
            const training = new Set(member.in_training_equipment ?? []);
            return (
              <li key={member.id} className="rounded-xl border border-slate-300 bg-white p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-black text-slate-900">{member.display_name}</span>
                  <span className="text-xs font-bold text-slate-500">{member.panel || 'No crew'} · {member.trade}</span>
                  {(member.passed_out_equipment ?? []).length === 0 && (
                    <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-950">Needs Sign-Off</span>
                  )}
                  {member.competency_updated_by && (
                    <span className="text-[11px] font-bold text-slate-400">Last signed by {member.competency_updated_by}</span>
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wide text-emerald-800">Passed Out (Ticketed)</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {models.map((model) => (
                      <button
                        key={`${member.id}-pass-${model}`}
                        type="button"
                        disabled={savingId === member.id}
                        aria-pressed={passed.has(model)}
                        onClick={() => void toggle(member, model, 'passed')}
                        className={`min-h-9 px-2 rounded-full border text-xs font-bold disabled:opacity-50 ${passed.has(model) ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-slate-600 border-slate-300'}`}
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wide text-amber-800">In Training (Buddy Seat)</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {models.map((model) => (
                      <button
                        key={`${member.id}-train-${model}`}
                        type="button"
                        disabled={savingId === member.id}
                        aria-pressed={training.has(model)}
                        onClick={() => void toggle(member, model, 'training')}
                        className={`min-h-9 px-2 rounded-full border text-xs font-bold disabled:opacity-50 ${training.has(model) ? 'bg-amber-500 text-amber-950 border-amber-500' : 'bg-white text-slate-600 border-slate-300'}`}
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
