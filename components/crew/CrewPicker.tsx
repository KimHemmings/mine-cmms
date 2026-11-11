'use client';

import React, { useMemo, useState } from 'react';
import { Check, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { CrewMember, personLight } from '@/types';
import { useCrewData } from './CrewDataContext';
import { AuthLight, PersonAuthorisationsDialog } from '@/components/training/PersonAuthorisations';
import { CrewMarks } from '@/components/training/CrewMarks';

interface CrewPickerProps {
  crew: CrewMember[];
  onShiftIds: Set<string>;
  openJobCounts: Map<string, number>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export default function CrewPicker({ crew, onShiftIds, openJobCounts, selectedIds, onChange }: CrewPickerProps) {
  const [search, setSearch] = useState('');
  const [showEveryone, setShowEveryone] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { authorisations, holdings, supervision, canCheckAuthorisations } = useCrewData();

  const activeCrew = useMemo(
    () => crew.filter((c) => c.active || selectedIds.includes(c.id)),
    [crew, selectedIds]
  );
  const term = search.trim().toLowerCase();
  const matches = (c: CrewMember) =>
    !term || [c.display_name, c.employee_id, c.trade, c.panel].some((f) => f?.toLowerCase().includes(term));

  const onShift = activeCrew.filter((c) => onShiftIds.has(c.id) && matches(c));
  const others = activeCrew.filter((c) => !onShiftIds.has(c.id) && matches(c));
  const othersVisible = showEveryone || onShift.length === 0 || term !== '';

  const toggle = (id: string) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  if (activeCrew.length === 0) {
    return (
      <p className="p-3 rounded-lg bg-slate-50 border border-dashed border-slate-300 text-sm text-slate-600">
        No crew set up yet. A manager can add people in the <strong>Crew</strong> tab.
      </p>
    );
  }

  const renderChip = (c: CrewMember) => {
    const selected = selectedIds.includes(c.id);
    const jobs = openJobCounts.get(c.id) ?? 0;
    const light = personLight(holdings.filter((row) => row.crew_member_id === c.id).map((row) => row.expires_on));
    return (
      <div key={c.id} className="flex items-stretch gap-1">
        <button
          type="button"
          onClick={() => toggle(c.id)}
          aria-pressed={selected}
          className={`min-h-12 flex-1 px-3 py-1.5 rounded-lg border-2 text-left transition flex items-center gap-2 ${
            selected
              ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
              : 'bg-white border-slate-300 text-slate-800 hover:border-slate-500'
          }`}
        >
          <span
            className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
              selected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-400'
            }`}
          >
            {selected && <Check className="w-3.5 h-3.5 text-white" />}
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-bold">{c.display_name}</span>
            <span className="text-xs text-slate-500">
              {c.trade}
              {jobs > 0 && <span className="ml-1 font-bold text-amber-700">· {jobs} open job{jobs > 1 ? 's' : ''}</span>}
            </span>
            {canCheckAuthorisations && <AuthLight light={light} />}
            <CrewMarks person={c} supervision={supervision} authorisations={authorisations} holdings={holdings} showUpcoming={canCheckAuthorisations} />
          </span>
        </button>
        {canCheckAuthorisations && (
          <button
            type="button"
            onClick={() => setOpenId(c.id)}
            className="min-h-12 px-2 rounded-lg border-2 border-slate-300 bg-white text-xs font-bold text-slate-700 hover:border-slate-500"
          >
            Check
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {activeCrew.length > 8 && (
        <label className="relative block">
          <span className="sr-only">Search crew</span>
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, ID or trade..."
            className="w-full min-h-11 pl-9 pr-3 rounded-lg border-2 border-slate-300 bg-slate-50 text-sm focus:outline-none focus:border-amber-500"
          />
        </label>
      )}

      {onShift.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">On this shift</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{onShift.map(renderChip)}</div>
        </div>
      )}

      {others.length > 0 && (
        <div className="space-y-2">
          {onShift.length > 0 && term === '' ? (
            <button
              type="button"
              onClick={() => setShowEveryone((v) => !v)}
              className="min-h-10 flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-slate-900"
            >
              {showEveryone ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showEveryone ? 'Hide crew not on shift' : `Show crew not on shift (${others.length})`}
            </button>
          ) : (
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {onShift.length === 0 && term === '' ? 'Crew (no one marked on shift yet)' : 'Not on this shift'}
            </p>
          )}
          {othersVisible && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{others.map(renderChip)}</div>}
        </div>
      )}

      {onShift.length === 0 && others.length === 0 && (
        <p className="text-sm text-slate-500">No crew match &ldquo;{search}&rdquo;.</p>
      )}
      {activeCrew.find((member) => member.id === openId) && (
        <PersonAuthorisationsDialog
          person={activeCrew.find((member) => member.id === openId)!}
          authorisations={authorisations}
          holdings={holdings}
          supervision={supervision}
          crew={crew}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
