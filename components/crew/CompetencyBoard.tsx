'use client';

import { useState } from 'react';
import { CREW_PANELS, CrewMember } from '@/types';
import { operatorEquipmentModels } from '@/utils/crewAllocation';
import { expiryState } from '@/utils/statutoryCompliance';
import ManagementDirectives from '@/components/ManagementDirectives';
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
  actorName = 'Training',
  readOnly = false,
  hideDirectives = false,
}: {
  crew: CrewMember[];
  assets: Asset[];
  onSave: (member: CrewMember, passed: string[], training: string[], extras?: { voc?: Record<string, string>; medical?: string; standard11?: string }) => Promise<boolean>;
  actorName?: string;
  readOnly?: boolean;
  hideDirectives?: boolean;
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
      {!hideDirectives && <ManagementDirectives actorName={actorName} department="training" />}
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
        <div className="overflow-x-auto">
        <ul className="min-w-[720px] space-y-3">
          {operators.map((member) => {
            const passed = new Set(member.passed_out_equipment ?? []);
            const training = new Set(member.in_training_equipment ?? []);
            return (
              <li key={member.id} className="rounded-xl border border-slate-300 bg-white p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-black text-slate-900">{member.display_name}</span>
                  <span className="text-xs font-bold text-slate-500">{member.panel || 'No crew'} · {member.trade}</span>
                  {expiryState(member.medical_expiry) === 'expired' && <span className="rounded-full bg-rose-700 px-2 py-0.5 text-[11px] font-black text-white">Medical expired</span>}
                  {expiryState(member.medical_expiry) === 'soon' && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-black text-amber-950">Medical due</span>}
                  {expiryState(member.standard11_expiry) === 'expired' && <span className="rounded-full bg-rose-700 px-2 py-0.5 text-[11px] font-black text-white">Standard 11 expired</span>}
                  {expiryState(member.standard11_expiry) === 'soon' && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-black text-amber-950">Standard 11 due</span>}
                  {(member.passed_out_equipment ?? []).length === 0 && (
                    <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-950">Needs Sign-Off</span>
                  )}
                  {member.competency_updated_by && (
                    <span className="text-[11px] font-bold text-slate-400">Last signed by {member.competency_updated_by}</span>
                  )}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="text-xs font-bold text-slate-600">
                    Coal Board Medical Expiry
                    <input type="date" disabled={readOnly} defaultValue={(member.medical_expiry ?? '').slice(0, 10)} onBlur={(event) => { if (!readOnly) void onSave(member, [...passed], [...training], { voc: member.voc_expiries ?? {}, medical: event.target.value, standard11: (member.standard11_expiry ?? '').slice(0, 10) }); }} className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 px-2" />
                  </label>
                  <label className="text-xs font-bold text-slate-600">
                    Standard 11 Expiry
                    <input type="date" disabled={readOnly} defaultValue={(member.standard11_expiry ?? '').slice(0, 10)} onBlur={(event) => { if (!readOnly) void onSave(member, [...passed], [...training], { voc: member.voc_expiries ?? {}, medical: (member.medical_expiry ?? '').slice(0, 10), standard11: event.target.value }); }} className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 px-2" />
                  </label>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wide text-emerald-800">Passed Out (Ticketed)</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {models.map((model) => {
                      const state = expiryState(member.voc_expiries?.[model]);
                      const tone = passed.has(model)
                        ? state === 'expired' ? 'bg-rose-700 text-white border-rose-700' : state === 'soon' ? 'bg-amber-400 text-amber-950 border-amber-500' : 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-600 border-slate-300';
                      return (
                        <span key={`${member.id}-pass-${model}`} className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={readOnly || savingId === member.id}
                            aria-pressed={passed.has(model)}
                            onClick={() => { if (!readOnly) void toggle(member, model, 'passed'); }}
                            className={`min-h-9 px-2 rounded-full border text-xs font-bold disabled:opacity-50 ${tone}`}
                          >
                            {model}
                          </button>
                          {passed.has(model) && (
                            <input
                              type="date"
                              aria-label={`${model} VOC expiry`}
                              disabled={readOnly}
                              defaultValue={(member.voc_expiries?.[model] ?? '').slice(0, 10)}
                              onBlur={(event) => {
                                if (readOnly) return;
                                void onSave(member, [...passed], [...training], {
                                  voc: { ...(member.voc_expiries ?? {}), [model]: event.target.value },
                                  medical: (member.medical_expiry ?? '').slice(0, 10),
                                  standard11: (member.standard11_expiry ?? '').slice(0, 10),
                                });
                              }}
                              className="min-h-9 rounded-lg border border-slate-300 px-1 text-xs"
                            />
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wide text-amber-800">In Training (Buddy Seat)</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {models.map((model) => (
                      <button
                        key={`${member.id}-train-${model}`}
                        type="button"
                        disabled={readOnly || savingId === member.id}
                        aria-pressed={training.has(model)}
                        onClick={() => { if (!readOnly) void toggle(member, model, 'training'); }}
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
        </div>
      )}
    </div>
  );
}
