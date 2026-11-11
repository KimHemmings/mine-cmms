'use client';

import React, { useState } from 'react';
import { RotateCw, X } from 'lucide-react';
import { CREW_PANELS, ShiftRecord } from '@/types';
import { useCrewData } from './CrewDataContext';

interface IncomingCrewDialogProps {
  activeShift: ShiftRecord;
  openJobsCount: number;
  nextCrew: string | null;
  onNextCrew: (panel: string) => void;
  onCancel: () => void;
  onConfirm: (nextCrew: string) => Promise<void>;
}

export default function IncomingCrewDialog({ activeShift, openJobsCount, nextCrew, onNextCrew, onCancel, onConfirm }: IncomingCrewDialogProps) {
  const { crew } = useCrewData();
  const nextType = activeShift.shift_type === 'DAY' ? 'NIGHT' : 'DAY';
  const nextName = nextType === 'DAY' ? 'Day Shift' : 'Night Shift';
  const [submitting, setSubmitting] = useState(false);

  const membersOf = (panel: string) => crew.filter((c) => c.active && c.panel === panel).length;

  const handleConfirm = async () => {
    if (!nextCrew) return;
    setSubmitting(true);
    await onConfirm(nextCrew);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900">Finish this shift?</h2>
            <p className="text-base text-slate-600 mt-1">
              The handover document is saved for every supervisor. Then {activeShift.shift_name} ({activeShift.crew ?? 'no crew'}) closes and{' '}
              <strong>{openJobsCount} open job{openJobsCount === 1 ? '' : 's'}</strong> carry over to {nextName}.
            </p>
          </div>
          <button type="button" onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-black uppercase tracking-wide text-slate-700 mb-2">Which crew is coming on for {nextName}?</legend>
          <div className="grid grid-cols-2 gap-2">
            {CREW_PANELS.map((panel) => {
              const selected = nextCrew === panel;
              return (
                <button
                  key={panel}
                  type="button"
                  onClick={() => onNextCrew(panel)}
                  aria-pressed={selected}
                  className={`min-h-14 px-3 rounded-xl border-2 text-left transition ${
                    selected ? 'bg-emerald-50 border-emerald-500 text-emerald-900' : 'bg-white border-slate-300 text-slate-800 hover:border-slate-500'
                  }`}
                >
                  <span className="block text-base font-black">{panel}</span>
                  <span className="block text-xs text-slate-500">{membersOf(panel)} people will be put on shift</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500">You can still add or remove people afterwards in the Crew tab.</p>
        </fieldset>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 px-5 rounded-xl border-2 border-slate-300 bg-white hover:bg-slate-50 text-base font-bold text-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !nextCrew}
            className="min-h-12 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-base font-black text-white shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RotateCw className="w-5 h-5" /> {submitting ? 'Handing over...' : nextCrew ? `Start ${nextName} with ${nextCrew}` : 'Choose a crew'}
          </button>
        </div>
      </div>
    </div>
  );
}
