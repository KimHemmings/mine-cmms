'use client';

import React, { useState } from 'react';
import { RotateCw, X } from 'lucide-react';
import { CREW_PANELS, ShiftRecord } from '@/types';

interface IncomingCrewDialogProps {
  activeShift: ShiftRecord;
  openJobsCount: number;
  outgoingCrew: string | null;
  nextCrew: string | null;
  automaticNextCrew: string | null;
  onNextCrew: (panel: string | null) => void;
  onCancel: () => void;
  onConfirm: (nextCrew: string) => Promise<void>;
}

export default function IncomingCrewDialog({ activeShift, openJobsCount, outgoingCrew, nextCrew, automaticNextCrew, onNextCrew, onCancel, onConfirm }: IncomingCrewDialogProps) {
  const nextType = activeShift.shift_type === 'DAY' ? 'NIGHT' : 'DAY';
  const nextName = nextType === 'DAY' ? 'Day Shift' : 'Night Shift';
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!nextCrew) return;
    setSubmitting(true);
    await onConfirm(nextCrew);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900">Finish this shift?</h2>
            <p className="text-base text-slate-600 mt-1">
              The handover document is saved for every supervisor. Then {activeShift.shift_name} ({outgoingCrew ?? activeShift.crew ?? 'no crew'}) closes and{' '}
              <strong>{openJobsCount} open job{openJobsCount === 1 ? '' : 's'}</strong> carry over to {nextName}.
            </p>
          </div>
          <button type="button" onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <fieldset className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div>
            <legend className="text-xs font-black uppercase tracking-wide text-emerald-800">Incoming {nextName}</legend>
            <p className="mt-1 text-lg font-black text-emerald-950">{nextCrew ?? 'No crew matched'}</p>
            {nextCrew && nextCrew === automaticNextCrew && (
              <span className="text-xs font-bold text-emerald-800">Roster Auto-Matched</span>
            )}
          </div>
          <label className="text-sm font-bold text-slate-700">
            <span className="sr-only">Override incoming crew</span>
            <select
              value={nextCrew === automaticNextCrew ? '__auto__' : nextCrew ?? '__auto__'}
              onChange={(event) => onNextCrew(event.target.value === '__auto__' ? null : event.target.value)}
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-3"
              aria-label="Override incoming crew"
            >
              <option value="__auto__">Override crew ▾</option>
              {CREW_PANELS.map((panel) => <option key={panel} value={panel}>{panel}</option>)}
            </select>
          </label>
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
