'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Asset, CrewMember, MachineWorkOrder } from '@/types';
import {
  AllocationChoice,
  SHIFT_DUTIES,
  ShiftDuty,
  dutyPill,
  memberAssignments,
  whiteboardMachines,
} from '@/utils/crewAllocation';

interface AllocationPillProps {
  member: CrewMember;
  assets: Asset[];
  workOrders: MachineWorkOrder[];
  busy?: boolean;
  onChange: (choice: AllocationChoice) => void;
}

export default function AllocationPill({ member, assets, workOrders, busy, onChange }: AllocationPillProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const machines = whiteboardMachines(assets, workOrders);
  const assigned = memberAssignments(member.id, workOrders, assets);
  const duty = member.shift_duty && (SHIFT_DUTIES as readonly string[]).includes(member.shift_duty)
    ? (member.shift_duty as ShiftDuty)
    : null;
  const allocated = assigned.length > 0 || !!duty;
  const label = assigned.length > 0
    ? assigned.length > 1 ? `${assigned[0].fleetId} +${assigned.length - 1}` : assigned[0].fleetId
    : duty
      ? dutyPill(duty)
      : 'Unassigned';

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const choose = (choice: AllocationChoice) => {
    setOpen(false);
    onChange(choice);
  };

  return (
    <div ref={rootRef} className="relative flex items-center gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
        className={`min-h-10 px-3 rounded-full text-xs font-black border inline-flex items-center gap-1 disabled:opacity-50 ${
          allocated
            ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
            : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {label}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {allocated && (
        <button
          type="button"
          disabled={busy}
          onClick={() => choose({ type: 'clear' })}
          className="min-h-10 min-w-10 rounded-full border border-slate-300 text-slate-500 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 inline-flex items-center justify-center disabled:opacity-50"
          aria-label={`Clear ${member.display_name}'s allocation`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {open && (
        <div className="absolute right-0 top-11 z-30 w-72 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl py-1" role="listbox">
          <p className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-wide text-slate-400">Active whiteboard</p>
          {machines.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">No machines with an open job.</p>
          ) : (
            machines.map((machine) => (
              <button
                key={machine.assetId}
                type="button"
                role="option"
                aria-selected={assigned.some((job) => job.assetId === machine.assetId)}
                onClick={() => choose({ type: 'machine', assetId: machine.assetId })}
                className="w-full text-left px-3 py-2 text-sm font-bold text-slate-800 hover:bg-amber-50"
              >
                {machine.fleetId} • {machine.priority} • {machine.classification}
              </button>
            ))
          )}
          <p className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-wide text-slate-400">General shift duties</p>
          {SHIFT_DUTIES.map((item) => (
            <button
              key={item}
              type="button"
              role="option"
              aria-selected={duty === item && assigned.length === 0}
              onClick={() => choose({ type: 'duty', duty: item })}
              className="w-full text-left px-3 py-2 text-sm font-bold text-slate-800 hover:bg-amber-50"
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            role="option"
            onClick={() => choose({ type: 'clear' })}
            className="w-full text-left px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 border-t border-slate-100"
          >
            Unassigned
          </button>
        </div>
      )}
    </div>
  );
}
