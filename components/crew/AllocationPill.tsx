'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Asset, CrewMember, MachineWorkOrder } from '@/types';
import {
  AllocationChoice,
  PRODUCTION_DUTIES,
  SHIFT_DUTIES,
  ShiftDuty,
  defaultAllocationRole,
  dutyPill,
  fleetLabel,
  isOperatorEquipment,
  machineMatchesTickets,
  memberAssignments,
  namesOnMachine,
  whiteboardMachines,
} from '@/utils/crewAllocation';
import { operatorBlockReason } from '@/utils/statutoryCompliance';

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
  readOnly?: boolean;
  onPingTraining?: () => void;
  pinging?: boolean;
  pingSent?: boolean;
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
  readOnly = false,
  onPingTraining,
  pinging = false,
  pingSent = false,
}: AllocationPillProps) {
  const [open, setOpen] = useState(false);
  const [floaterIds, setFloaterIds] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const production = variant === 'production';
  const machines = whiteboardMachines(assets, workOrders);
  const fleet = [...(fleetAssets ?? assets)].sort((a, b) => a.fleet_id.localeCompare(b.fleet_id, undefined, { numeric: true }));
  const operatorFleet = fleet.filter(isOperatorEquipment);
  const tickets = member.passed_out_equipment ?? [];
  const personBlock = operatorBlockReason(member);
  const down = new Set(downAssetIds);
  const eligible = operatorFleet.filter((asset) => asset.status === 'OPERATIONAL' && !down.has(asset.id) && machineMatchesTickets(asset, tickets) && !operatorBlockReason(member, asset.make_model));
  const assigned = memberAssignments(member.id, workOrders, assets);
  const duty = member.shift_duty && (SHIFT_DUTIES as readonly string[]).includes(member.shift_duty)
    ? (member.shift_duty as ShiftDuty)
    : null;
  const productionFleet = fleetLabel(member.allocated_machine_id, fleet);
  const allocated = production ? member.allocated_role === 'Crib Floater' || !!productionFleet || !!member.shift_duty : assigned.length > 0 || !!duty;
  const floaterNames = member.allocated_role === 'Crib Floater'
    ? (member.hot_seat_assignments ?? []).map((seat) => fleet.find((asset) => asset.id === seat.assetId)?.fleet_id).filter(Boolean)
    : [];
  const seatMark = member.allocated_role === 'Hot Seat' ? ' (Hot Seat)' : member.allocated_role === 'Trainee (Buddy Seat)' ? ' (Trainee)' : member.allocated_role === 'Crib Floater' ? '' : '';
  const label = production
    ? member.allocated_role === 'Crib Floater'
      ? `Crib Floater${floaterNames.length ? ` · ${floaterNames.join(', ')}` : ''}`
      : productionFleet ? `${productionFleet}${seatMark}` : member.shift_duty?.trim() || 'Unassigned'
    : assigned.length > 0
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

  if (readOnly) {
    return <span className="inline-flex min-h-10 items-center rounded-full border border-slate-300 bg-slate-100 px-3 text-xs font-black text-slate-700">{label}</span>;
  }

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
        <div className={`absolute right-0 top-11 z-30 ${production ? 'w-96' : 'w-80'} max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl py-1`} role="listbox">
          {production ? (
            <>
              {personBlock && (
                <p className="mx-2 my-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-black text-rose-800">{personBlock}. Allocation is blocked.</p>
              )}
              {tickets.length === 0 ? (
                <div className="mx-2 my-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                  <p className="text-sm font-black text-amber-950">No Training pass-outs verified</p>
                  {pingSent ? (
                    <p className="mt-2 text-xs font-black text-emerald-800">Sent to Training ✓</p>
                  ) : (
                    <button
                      type="button"
                      disabled={pinging || !onPingTraining}
                      onClick={() => onPingTraining?.()}
                      className="mt-2 min-h-9 rounded-lg bg-amber-700 px-3 text-xs font-black text-white hover:bg-amber-600 disabled:opacity-50"
                    >
                      {pinging ? 'Sending...' : 'Ping Training to Verify'}
                    </button>
                  )}
                </div>
              ) : personBlock ? null : eligible.length === 0 ? (
                <p className="px-3 py-2 text-sm font-bold text-slate-500">Ticketed for: {tickets.join(', ')} — all units currently down in Workshop</p>
              ) : (
                <>
                  <p className="px-3 pt-2 text-[11px] font-bold text-slate-500">Training Verified: {tickets.join(', ')}</p>
                  {member.competency_updated_by && (
                    <p className="px-3 pb-1 text-[11px] font-bold text-slate-400">Verified by {member.competency_updated_by}</p>
                  )}
                </>
              )}
              {tickets.length > 0 && eligible.length > 0 && eligible.map((asset) => {
                const names = namesOnMachine(asset.id, roster, member.id);
                const hotSeat = names.length > 0;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    role="option"
                    aria-selected={member.allocated_machine_id === asset.id}
                    onClick={() => choose({
                      type: 'machine',
                      assetId: asset.id,
                      role: defaultAllocationRole(asset.id, member.id, roster),
                    })}
                    className="w-full text-left px-3 py-2 text-sm font-bold text-slate-800 hover:bg-amber-50"
                  >
                    {asset.fleet_id}
                    <span className="font-medium text-slate-500"> • {asset.make_model}</span>
                    {hotSeat && <span className="font-bold text-slate-700"> (Hot Seat w/ {names.join(', ')})</span>}
                  </button>
                );
              })}
              {tickets.length > 0 && !personBlock && eligible.length > 0 && (
                <div className="mx-2 my-2 rounded-lg border border-slate-200 p-2">
                  <p className="text-[11px] font-black uppercase text-slate-500">Crib Floater (Multi-Unit)</p>
                  <p className="text-[11px] text-slate-500">Up to 4 ticketed units. This does not take a primary seat.</p>
                  {eligible.map((asset) => {
                    const on = floaterIds.includes(asset.id);
                    return (
                      <label key={`float-${asset.id}`} className="mt-1 flex items-center gap-2 text-sm font-bold text-slate-800">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => setFloaterIds((current) => on ? current.filter((id) => id !== asset.id) : current.length >= 4 ? current : [...current, asset.id])}
                        />
                        {asset.fleet_id}
                      </label>
                    );
                  })}
                  <button
                    type="button"
                    disabled={floaterIds.length === 0}
                    onClick={() => choose({ type: 'floater', assetIds: floaterIds.slice(0, 4) })}
                    className="mt-2 min-h-9 rounded-lg bg-slate-900 px-3 text-xs font-black text-white disabled:opacity-50"
                  >
                    Assign crib floater
                  </button>
                </div>
              )}
              <div className="mt-1 border-t border-slate-100">
              {PRODUCTION_DUTIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="option"
                  aria-selected={member.shift_duty === item && !productionFleet}
                  onClick={() => choose({ type: 'duty', duty: item })}
                  className="w-full text-left px-3 py-2 text-sm font-bold text-slate-800 hover:bg-amber-50"
                >
                  {item}
                </button>
              ))}
              </div>
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
          {!production && (
          <button
            type="button"
            role="option"
            onClick={() => choose({ type: 'clear' })}
            className="w-full text-left px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 border-t border-slate-100"
          >
            Unassigned
          </button>
          )}
        </div>
      )}
    </div>
  );
}
