'use client';

import { useMemo, useState } from 'react';
import { CREW_PANELS, SavedHandover } from '@/types';
import { formatDateTime } from '@/utils/helpers';

interface HandoverHistoryProps {
  handovers: SavedHandover[];
  activeShiftId?: string;
  onOpen: (handover: SavedHandover) => void;
}

export default function HandoverHistory({ handovers, activeShiftId, onOpen }: HandoverHistoryProps) {
  const [shiftType, setShiftType] = useState('ALL');
  const [crew, setCrew] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filtered = useMemo(() => {
    return handovers.filter((handover) => {
      if (shiftType !== 'ALL' && handover.shift_type !== shiftType) return false;
      if (crew !== 'ALL' && handover.crew !== crew) return false;
      if (from && handover.shift_date && handover.shift_date < from) return false;
      if (to && handover.shift_date && handover.shift_date > to) return false;
      return true;
    });
  }, [handovers, shiftType, crew, from, to]);

  const selectClass = 'min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select value={shiftType} onChange={(event) => setShiftType(event.target.value)} className={selectClass} aria-label="Shift type">
          <option value="ALL">Day and night</option>
          <option value="DAY">Day shift</option>
          <option value="NIGHT">Night shift</option>
        </select>
        <select value={crew} onChange={(event) => setCrew(event.target.value)} className={selectClass} aria-label="Crew">
          <option value="ALL">All crews</option>
          {CREW_PANELS.map((panel) => <option key={panel} value={panel}>{panel}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
          From
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={selectClass} />
        </label>
        <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
          To
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className={selectClass} />
        </label>
        {(shiftType !== 'ALL' || crew !== 'ALL' || from || to) && (
          <button
            type="button"
            onClick={() => { setShiftType('ALL'); setCrew('ALL'); setFrom(''); setTo(''); }}
            className="min-h-11 px-3 text-sm font-bold text-slate-600 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {handovers.length === 0 ? 'No handovers saved yet. Save the current shift to start the history.' : 'No handovers match these filters.'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-300 bg-white">
          {filtered.map((handover) => (
            <li key={handover.id}>
              <button type="button" onClick={() => onOpen(handover)} className="w-full text-left px-4 py-3 hover:bg-slate-50 min-h-16">
                <span className="block text-base font-black text-slate-900">
                  {handover.shift_name}{handover.crew ? ` · ${handover.crew}` : ''}
                  {handover.shift_id === activeShiftId && <span className="ml-2 text-xs font-bold uppercase text-emerald-700">Current shift</span>}
                </span>
                <span className="block text-sm text-slate-500">
                  {handover.shift_date ? new Date(handover.shift_date).toLocaleDateString() : 'No date'}
                  {' · '}{handover.supervisor || 'Supervisor not recorded'}
                  {' · '}Saved {formatDateTime(handover.saved_at)}
                  {' · '}{handover.document.handedOver.length} still down, {handover.document.released.length} released
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
