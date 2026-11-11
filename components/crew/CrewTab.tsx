'use client';

import React, { useState } from 'react';
import { Users, Pencil, UserX, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { CREW_PANELS, CrewMember, CrewMemberInput, ShiftRecord } from '@/types';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import { useCrewData } from './CrewDataContext';
import CrewMemberForm from './CrewMemberForm';
import OnShiftSection from './OnShiftSection';

interface CrewTabProps {
  activeShift: ShiftRecord | null;
  saveCrewMember: (input: CrewMemberInput, id?: string) => Promise<boolean>;
  setCrewMemberActive: (member: CrewMember, active: boolean) => Promise<void>;
  setCrewOnShift: (ids: string[], onShift: boolean) => Promise<void>;
  setShiftPanel: (panel: string) => Promise<void>;
}

const NO_PANEL = 'No panel';

export default function CrewTab({ activeShift, saveCrewMember, setCrewMemberActive, setCrewOnShift, setShiftPanel }: CrewTabProps) {
  const { crew, onShiftIds, openJobsByCrew } = useCrewData();
  const { confirm } = useFeedback();
  const [editing, setEditing] = useState<CrewMember | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);

  const activeCrew = crew.filter((c) => c.active);
  const removedCrew = crew.filter((c) => !c.active);
  const panelOf = (c: CrewMember) => ((CREW_PANELS as readonly string[]).includes(c.panel ?? '') ? c.panel! : NO_PANEL);
  const groups = [...CREW_PANELS, NO_PANEL]
    .map((panel) => ({ panel, members: activeCrew.filter((c) => panelOf(c) === panel) }))
    .filter((g) => g.members.length > 0);

  const handleRemove = async (member: CrewMember) => {
    const ok = await confirm({
      title: `Remove ${member.display_name} from the crew list?`,
      message: 'They will no longer appear when assigning jobs. Their past jobs keep their name. You can restore them later.',
      confirmLabel: 'Yes, remove',
      tone: 'danger',
    });
    if (ok) await setCrewMemberActive(member, false);
  };

  return (
    <div className="space-y-6">
      <OnShiftSection
        activeShift={activeShift}
        crew={crew}
        onShiftIds={onShiftIds}
        openJobsByCrew={openJobsByCrew}
        setCrewOnShift={setCrewOnShift}
        setShiftPanel={setShiftPanel}
      />

      <section className="bg-white border border-slate-300 rounded-xl p-4 shadow-2xs space-y-4">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-600" /> Crew list ({activeCrew.length})
          </h3>
          <p className="text-sm text-slate-500">Everyone who can be assigned to jobs, grouped by panel.</p>
        </div>

        <CrewMemberForm
          key={editing?.id ?? 'new'}
          editing={editing}
          onSave={saveCrewMember}
          onCancelEdit={() => setEditing(null)}
        />

        {groups.map(({ panel, members }) => (
          <div key={panel} className="space-y-2">
            <h4 className="text-sm font-black uppercase tracking-wide text-slate-600">
              {panel} ({members.length})
            </h4>
            <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
              {members.map((c) => (
                <li key={c.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="text-base font-bold text-slate-900">
                    {c.display_name}
                    <span className="ml-2 text-sm font-medium text-slate-500">
                      {c.department || 'Workshop'} · {c.trade}
                      {c.employee_id && <span className="font-mono"> · #{c.employee_id}</span>}
                      {onShiftIds.has(c.id) && <span className="ml-2 text-emerald-700 font-bold">On shift</span>}
                    </span>
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(c);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="min-h-11 px-3 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 hover:bg-amber-50 hover:border-amber-400 flex items-center gap-1.5"
                    >
                      <Pencil className="w-4 h-4" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(c)}
                      className="min-h-11 px-3 rounded-lg border border-slate-300 text-sm font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 flex items-center gap-1.5"
                    >
                      <UserX className="w-4 h-4" /> Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {removedCrew.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowRemoved((v) => !v)}
              className="min-h-10 flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-800"
            >
              {showRemoved ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showRemoved ? 'Hide removed people' : `Show removed people (${removedCrew.length})`}
            </button>
            {showRemoved && (
              <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                {removedCrew.map((c) => (
                  <li key={c.id} className="p-3 flex items-center justify-between gap-2 bg-slate-50">
                    <span className="text-sm font-semibold text-slate-500">
                      {c.display_name} · {c.department || 'Workshop'} · {c.trade}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCrewMemberActive(c, true)}
                      className="min-h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-emerald-50 flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-4 h-4" /> Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
