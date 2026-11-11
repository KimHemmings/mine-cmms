'use client';

import React, { useState } from 'react';
import { CalendarCheck, ChevronDown, ChevronUp, UserMinus, UserPlus } from 'lucide-react';
import { CREW_PANELS, CrewMember, ShiftRecord, personLight } from '@/types';
import type { CrewJob } from '@/utils/crew';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import { useCrewData } from './CrewDataContext';
import { AuthLight, PersonAuthorisationsDialog } from '@/components/training/PersonAuthorisations';

interface OnShiftSectionProps {
  activeShift: ShiftRecord | null;
  crew: CrewMember[];
  onShiftIds: Set<string>;
  openJobsByCrew: Map<string, CrewJob[]>;
  setCrewOnShift: (ids: string[], onShift: boolean) => Promise<void>;
  setShiftPanel: (panel: string) => Promise<void>;
}

export default function OnShiftSection({
  activeShift,
  crew,
  onShiftIds,
  openJobsByCrew,
  setCrewOnShift,
  setShiftPanel,
}: OnShiftSectionProps) {
  const { confirm } = useFeedback();
  const { authorisations, holdings, canCheckAuthorisations } = useCrewData();
  const [showAddList, setShowAddList] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const activeCrew = crew.filter((c) => c.active);
  const onShift = activeCrew.filter((c) => onShiftIds.has(c.id));
  const notOnShift = activeCrew.filter((c) => !onShiftIds.has(c.id));

  const panelsToAdd = CREW_PANELS.map((panel) => ({
    panel,
    ids: notOnShift.filter((c) => c.panel === panel).map((c) => c.id),
  })).filter((p) => p.ids.length > 0 && p.panel !== activeShift?.crew);

  const handleSwitchPanel = async (panel: string) => {
    const ok = await confirm({
      title: `Switch this shift to ${panel}?`,
      message: `The on-shift list will be replaced with everyone in ${panel}. Jobs already assigned keep their people.`,
      confirmLabel: `Yes, switch to ${panel}`,
    });
    if (ok) await setShiftPanel(panel);
  };

  const sortedOnShift = [...onShift].sort(
    (a, b) => (openJobsByCrew.get(a.id)?.length ?? 0) - (openJobsByCrew.get(b.id)?.length ?? 0) || a.display_name.localeCompare(b.display_name)
  );

  return (
    <section className="bg-white border border-slate-300 rounded-xl p-4 shadow-2xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-emerald-600" /> On this shift ({onShift.length})
          </h3>
          <p className="text-sm text-slate-500">
            {activeShift ? `${activeShift.shift_name}${activeShift.crew ? ` · ${activeShift.crew}` : ''}` : 'No active shift'} · People here show first when assigning jobs. Least busy at the top.
          </p>
        </div>
        {onShift.length > 0 && (
          <button
            type="button"
            onClick={() => setCrewOnShift(onShift.map((c) => c.id), false)}
            className="min-h-11 px-4 rounded-lg border-2 border-slate-300 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            Clear list
          </button>
        )}
      </div>

      {activeShift && (
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-600">Crew rostered on:</span>
            {CREW_PANELS.map((panel) => {
              const current = activeShift.crew === panel;
              return (
                <button
                  key={panel}
                  type="button"
                  disabled={current && onShift.length > 0}
                  onClick={() => (current ? setShiftPanel(panel) : handleSwitchPanel(panel))}
                  aria-pressed={current}
                  className={`min-h-11 px-4 rounded-full border-2 text-sm font-black transition ${
                    current
                      ? 'bg-slate-900 border-slate-900 text-white cursor-default'
                      : 'bg-white border-slate-300 text-slate-700 hover:border-slate-500'
                  }`}
                >
                  {panel}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500">
            The rostered crew is loaded automatically at each shift handover. Tap another crew to switch, or add extra people below for overtime and swaps.
          </p>
          {panelsToAdd.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {panelsToAdd.map(({ panel, ids }) => (
                <button
                  key={panel}
                  type="button"
                  onClick={() => setCrewOnShift(ids, true)}
                  className="min-h-11 px-4 rounded-lg border-2 border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800 text-sm font-bold flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" /> Also add all of {panel} ({ids.length})
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {onShift.length === 0 ? (
        <p className="p-4 rounded-lg bg-slate-50 border border-dashed border-slate-300 text-sm text-slate-600">
          {activeCrew.length === 0
            ? 'Add your crew in the list below first.'
            : 'No one is on shift. Tap the rostered crew above to load them, or add people one at a time below.'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
          {sortedOnShift.map((c) => {
            const jobs = openJobsByCrew.get(c.id) ?? [];
            return (
              <li key={c.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-base font-bold text-slate-900 flex flex-wrap items-center gap-2">
                    {canCheckAuthorisations ? (
                      <button type="button" onClick={() => setOpenId(c.id)} className="hover:underline">
                        {c.display_name}
                      </button>
                    ) : (
                      c.display_name
                    )}
                    <span className="text-sm font-medium text-slate-500">
                      {c.trade}
                      {c.panel && ` · ${c.panel}`}
                    </span>
                    {canCheckAuthorisations && (
                      <AuthLight light={personLight(holdings.filter((row) => row.crew_member_id === c.id).map((row) => row.expires_on))} />
                    )}
                  </p>
                  {jobs.length === 0 ? (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-black uppercase">Free</span>
                  ) : (
                    <ul className="mt-1 space-y-0.5">
                      {jobs.map((j) => (
                        <li key={j.workOrderId} className="text-sm text-slate-700">
                          <strong>{j.fleetId}</strong>: {j.task}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setCrewOnShift([c.id], false)}
                  className="min-h-11 px-3 rounded-lg border border-slate-300 text-sm font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 flex items-center gap-1.5 shrink-0"
                >
                  <UserMinus className="w-4 h-4" /> Off shift
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {notOnShift.length > 0 && activeShift && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowAddList((v) => !v)}
            className="min-h-10 flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-slate-900"
          >
            {showAddList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showAddList ? 'Hide' : `Add someone else (${notOnShift.length} not on shift)`}
          </button>
          {showAddList && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {notOnShift.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCrewOnShift([c.id], true)}
                  className="min-h-12 px-3 rounded-lg border-2 border-slate-300 bg-white hover:border-emerald-500 text-left flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-sm font-bold text-slate-800">{c.display_name}</span>
                  <span className="text-xs text-slate-500">{c.panel ?? 'No panel'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {sortedOnShift.find((member) => member.id === openId) && (
        <PersonAuthorisationsDialog
          person={sortedOnShift.find((member) => member.id === openId)!}
          authorisations={authorisations}
          holdings={holdings}
          onClose={() => setOpenId(null)}
        />
      )}
    </section>
  );
}
