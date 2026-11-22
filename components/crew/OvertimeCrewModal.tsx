'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { CREW_PANELS, CrewMember } from '@/types';
import { crewLetter } from '@/utils/shiftRoster';

interface OvertimeCrewModalProps {
  crew: CrewMember[];
  targetPanel: string;
  onAdd: (member: CrewMember) => Promise<void>;
  onClose: () => void;
}

export default function OvertimeCrewModal({ crew, targetPanel, onAdd, onClose }: OvertimeCrewModalProps) {
  const [query, setQuery] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const letter = crewLetter(targetPanel);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const people = useMemo(() => {
    const term = query.trim().toLowerCase();
    return crew
      .filter((member) => member.active && !member.is_contractor)
      .filter((member) => (CREW_PANELS as readonly string[]).includes(member.panel ?? '') && member.panel !== targetPanel)
      .filter((member) => !term || member.display_name.toLowerCase().includes(term) || member.trade.toLowerCase().includes(term))
      .sort((a, b) => (a.panel ?? '').localeCompare(b.panel ?? '') || a.display_name.localeCompare(b.display_name));
  }, [crew, query, targetPanel]);

  const add = async (member: CrewMember) => {
    setSavingId(member.id);
    await onAdd(member);
    setSavingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl my-8 space-y-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="overtime-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="overtime-title" className="text-xl font-black text-slate-900">Overtime onto {targetPanel}</h3>
            <p className="text-sm text-slate-500">Their home crew stays the same. This cover ends at handover.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or trade"
          className="w-full min-h-11 rounded-lg border-2 border-slate-300 px-3 text-base focus:outline-none focus:border-amber-500"
          autoFocus
        />
        <ul className="max-h-80 overflow-y-auto divide-y divide-slate-200 border border-slate-200 rounded-lg">
          {people.length === 0 ? (
            <li className="p-4 text-sm text-slate-500">No one from another crew matches.</li>
          ) : people.map((member) => (
            <li key={member.id} className="p-3 flex items-center gap-3">
              <div className="min-w-0">
                <p className="font-bold text-slate-900 truncate">{member.display_name}</p>
                <p className="text-xs font-semibold text-slate-500">{member.panel} · {member.trade}</p>
              </div>
              <button
                type="button"
                disabled={savingId === member.id}
                onClick={() => void add(member)}
                className="ml-auto shrink-0 min-h-10 px-3 rounded-lg bg-indigo-600 text-white text-xs font-black hover:bg-indigo-500 disabled:opacity-50"
              >
                {savingId === member.id ? 'Adding...' : `+ Add to ${letter} Crew (OT)`}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
