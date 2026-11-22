'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Asset, CrewMember, MachineWorkOrder } from '@/types';
import {
  AllocationChoice,
  PRODUCTION_DUTIES,
  ProductionDuty,
  SHIFT_DUTIES,
  ShiftDuty,
  AllocationRole,
  defaultAllocationRole,
  dutyPill,
  fleetLabel,
  machineHasPassedOutPrimary,
  machineMatchesTickets,
  memberAssignments,
  namesOnMachine,
  nextAllocationRole,
  seatLabel,
  whiteboardMachines,
} from '@/utils/crewAllocation';

interface AllocationPillProps {
  member: CrewMember;
  assets: Asset[];
  fleetAssets?: Asset[];
  downAssetIds?: string[];
  roster?: CrewMember[];
  workOrders: MachineWorkOrder[];
  busy?: boolean;
  variant?: 'workshop' | 'production';
  onChange: (choice: AllocationChoice) => void;
}

export default function AllocationPill({
  member,
  assets,
  fleetAssets,
  downAssetIds = [],
  roster = [],
  workOrders,
  busy,
  variant = 'workshop',
  onChange,
}: AllocationPillProps) {
  const [open, setOpen] = useState(false);
  const [seatIntent, setSeatIntent] = useState<AllocationRole>(member.allocated_role ?? 'Primary');
  const rootRef = useRef<HTMLDivElement>(null);
  const production = variant === 'production';
  const machines = whiteboardMachines(assets, workOrders);
  const fleet = [...(fleetAssets ?? assets)].sort((a, b) => a.fleet_id.localeCompare(b.fleet_id, undefined, { numeric: true }));
  const tickets = member.passed_out_equipment ?? [];
  const passedFleet = tickets.length === 0 ? [] : fleet.filter((asset) => machineMatchesTickets(asset, tickets));
  const buddyFleet = fleet.filter((asset) => machineHasPassedOutPrimary(asset, roster, member.id) && !passedFleet.some((match) => match.id === asset.id));
  const traineeSeat = seatIntent === 'Trainee (Buddy Seat)';
  const down = new Set(downAssetIds);
  const assigned = memberAssignments(member.id, workOrders, assets);
  const duty = member.shift_duty && (SHIFT_DUTIES as readonly string[]).includes(member.shift_duty)
    ? (member.shift_duty as ShiftDuty)
    : null;
  const productionDuty = member.shift_duty && (PRODUCTION_DUTIES as readonly string[]).includes(member.shift_duty)
    ? (member.shift_duty as ProductionDuty)
    : null;
  const productionFleet = fleetLabel(member.allocated_machine_id, fleet);
  const unitDown = production && !!member.allocated_machine_id && down.has(member.allocated_machine_id);
  const allocated = production ? !!productionFleet || !!productionDuty : assigned.length > 0 || !!duty;
  const traineeMark = member.allocated_role === 'Trainee (Buddy Seat)' ? ' (Trainee)' : '';
  const label = production
    ? productionFleet ? `${productionFleet}${traineeMark}` : productionDuty || 'Unassigned'
    : assigned.length > 0
      ? assigned.length > 1 ? `${assigned[0].fleetId} +${assigned.length - 1}` : assigned[0].fleetId
      : duty
        ? dutyPill(duty)
        : 'Unassigned';

  useEffect(() => {
    setSeatIntent(member.allocated_role ?? 'Primary');
  }, [member.allocated_role]);

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
          unitDown
            ? 'bg-rose-700 text-white border-rose-700 hover:bg-rose-600'
            : allocated
            ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
            : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {unitDown ? `${productionFleet}${traineeMark} • UNIT DOWN • Reassign` : label}
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
      {production && !!productionFleet && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onChange({ type: 'role', role: nextAllocationRole(member.allocated_role) })}
          className={`min-h-10 px-3 rounded-full text-xs font-black border disabled:opacity-50 ${
            member.allocated_role === 'Trainee (Buddy Seat)'
              ? 'bg-sky-100 text-sky-950 border-sky-300'
              : member.allocated_role === 'Hot Seat'
              ? 'bg-amber-100 text-amber-950 border-amber-300'
              : 'bg-slate-900 text-white border-slate-900'
          }`}
        >
          {seatLabel(member.allocated_role)}
        </button>
      )}
      {open && (
        <div className="absolute right-0 top-11 z-30 w-80 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl py-1" role="listbox">
          {production ? (
            <>
              <div className="flex flex-wrap gap-1 px-3 py-2">
                {(['Primary', 'Hot Seat', 'Trainee (Buddy Seat)'] as AllocationRole[]).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      setSeatIntent(role);
                      if (member.allocated_machine_id) onChange({ type: 'role', role });
                    }}
                    className={`min-h-9 px-2 rounded-full border text-[11px] font-black ${
                      seatIntent === role ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    {role === 'Trainee (Buddy Seat)' ? 'Trainee (Buddy Seat)' : role}
                  </button>
                ))}
              </div>
              <p className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-wide text-slate-400">Fleet machines</p>
              {(!traineeSeat && tickets.length === 0) ? (
                <p className="px-3 py-2 text-sm font-bold text-amber-800">No pass-outs set — click Edit to assign tickets</p>
              ) : (!traineeSeat && passedFleet.length === 0) ? (
                <p className="px-3 py-2 text-sm text-slate-500">No fleet units match these pass-outs.</p>
              ) : (
                <>
                  {passedFleet.map((asset) => {
                    const names = namesOnMachine(asset.id, roster);
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        role="option"
                        aria-selected={member.allocated_machine_id === asset.id}
                        onClick={() => choose({
                          type: 'machine',
                          assetId: asset.id,
                          role: traineeSeat ? 'Trainee (Buddy Seat)' : defaultAllocationRole(asset.id, member.id, roster),
                        })}
                        className="w-full text-left px-3 py-2 text-sm font-bold text-slate-800 hover:bg-amber-50"
                      >
                        {asset.fleet_id}
                        <span className="font-medium text-slate-500"> • {asset.make_model}</span>
                        {names.length > 0 && <span className="font-bold text-slate-700"> (Assigned: {names.join(', ')})</span>}
                        {down.has(asset.id) && (
                          <span className="ml-2 inline-flex rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black uppercase text-white">Down in workshop</span>
                        )}
                      </button>
                    );
                  })}
                  {traineeSeat && (
                    <>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-wide text-slate-400">Buddy seat with a passed-out Primary</p>
                      {buddyFleet.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-slate-500">No manned unit has a passed-out Primary yet.</p>
                      ) : buddyFleet.map((asset) => {
                        const names = namesOnMachine(asset.id, roster);
                        return (
                          <button
                            key={`buddy-${asset.id}`}
                            type="button"
                            role="option"
                            aria-selected={member.allocated_machine_id === asset.id}
                            onClick={() => choose({ type: 'machine', assetId: asset.id, role: 'Trainee (Buddy Seat)' })}
                            className="w-full text-left px-3 py-2 text-sm font-bold text-slate-800 hover:bg-sky-50"
                          >
                            {asset.fleet_id}
                            <span className="font-medium text-slate-500"> • {asset.make_model}</span>
                            {names.length > 0 && <span className="font-bold text-slate-700"> (Assigned: {names.join(', ')})</span>}
                          </button>
                        );
                      })}
                    </>
                  )}
                </>
              )}
              <p className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-wide text-slate-400">General production duties</p>
              {PRODUCTION_DUTIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="option"
                  aria-selected={productionDuty === item && !productionFleet}
                  onClick={() => choose({ type: 'duty', duty: item })}
                  className="w-full text-left px-3 py-2 text-sm font-bold text-slate-800 hover:bg-amber-50"
                >
                  {item}
                </button>
              ))}
            </>
          ) : (
            <>
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
            </>
          )}
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
