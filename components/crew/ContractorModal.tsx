'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Asset, MachineWorkOrder } from '@/types';
import { AllocationChoice, PRODUCTION_DUTIES, SHIFT_DUTIES, isOperatorEquipment, machineMatchesTickets, operatorEquipmentModels, whiteboardMachines } from '@/utils/crewAllocation';

const WORKSHOP_TRADES = ['Field Fitter', 'Fitter', 'Boilermaker', 'Auto Sparky', 'Auto Electrician', 'Other'];
const PRODUCTION_TRADES = ['Operator', 'Multi-Skilled Operator', 'Leading Hand', 'OCE / Supervisor'];

interface ContractorModalProps {
  crewLabel: string;
  assets: Asset[];
  workOrders: MachineWorkOrder[];
  variant?: 'workshop' | 'production';
  onSave: (input: { name: string; company: string; trade: string; allocation: AllocationChoice | null; passedOut: string[] }) => Promise<void>;
  onClose: () => void;
  embedded?: boolean;
}

export default function ContractorModal({
  crewLabel,
  assets,
  workOrders,
  variant = 'workshop',
  onSave,
  onClose,
  embedded = false,
}: ContractorModalProps) {
  const production = variant === 'production';
  const trades = production ? PRODUCTION_TRADES : WORKSHOP_TRADES;
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [trade, setTrade] = useState(trades[0]);
  const [allocation, setAllocation] = useState('');
  const [tickets, setTickets] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const machines = whiteboardMachines(assets, workOrders);
  const models = operatorEquipmentModels(assets);
  const fleet = [...assets].filter(isOperatorEquipment).sort((a, b) => a.fleet_id.localeCompare(b.fleet_id, undefined, { numeric: true }));
  const passedFleet = tickets.length === 0 ? [] : fleet.filter((asset) => machineMatchesTickets(asset, tickets));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !company.trim()) return;
    const duty = [...SHIFT_DUTIES, ...PRODUCTION_DUTIES].find((item) => item === allocation);
    const choice: AllocationChoice | null = allocation.startsWith('asset:')
      ? { type: 'machine', assetId: allocation.slice(6) }
      : duty
        ? { type: 'duty', duty }
        : null;
    setSaving(true);
    await onSave({ name: name.trim(), company: company.trim(), trade, allocation: choice, passedOut: tickets });
    setSaving(false);
  };

  const card = (
      <form
        onSubmit={(event) => void submit(event)}
        onClick={(event) => event.stopPropagation()}
        className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl my-8 space-y-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contractor-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="contractor-title" className="text-xl font-black text-slate-900">Contractor on {crewLabel}</h3>
            <p className="text-sm text-slate-500">{production ? 'Labour hire stays on this crew until handover, then drops off.' : 'They stay on this crew until handover, then drop off.'}</p>
          </div>
          {!embedded && (
            <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-600">Full name *</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required autoFocus className="w-full min-h-11 rounded-lg border-2 border-slate-300 px-3 text-base focus:outline-none focus:border-amber-500" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-600">{production ? 'Company *' : 'Company / OEM *'}</span>
          <input value={company} onChange={(event) => setCompany(event.target.value)} required placeholder={production ? 'Labour hire company' : 'Hastings Deering, Komatsu, Hitachi'} className="w-full min-h-11 rounded-lg border-2 border-slate-300 px-3 text-base focus:outline-none focus:border-amber-500" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-600">Trade / Role</span>
          <select value={trade} onChange={(event) => setTrade(event.target.value)} className="w-full min-h-11 rounded-lg border-2 border-slate-300 px-3 text-base bg-white focus:outline-none focus:border-amber-500">
            {trades.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        {production && (
          <fieldset className="space-y-2">
            <legend className="text-xs font-bold text-slate-600">Passed-Out Equipment (Competencies)</legend>
            {models.length === 0 ? (
              <p className="text-sm text-slate-500">No machine models are on the fleet yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {models.map((model) => {
                  const on = tickets.includes(model);
                  return (
                    <button
                      key={model}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setTickets((current) => on ? current.filter((item) => item !== model) : [...current, model]);
                        setAllocation('');
                      }}
                      className={`min-h-10 px-3 rounded-full border text-sm font-bold ${on ? 'bg-sky-700 text-white border-sky-700' : 'bg-white text-slate-700 border-slate-300'}`}
                    >
                      {model}
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>
        )}
        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-600">Allocate now (optional)</span>
          <select value={allocation} onChange={(event) => setAllocation(event.target.value)} className="w-full min-h-11 rounded-lg border-2 border-slate-300 px-3 text-base bg-white focus:outline-none focus:border-amber-500">
            <option value="">Unassigned</option>
            {production ? (
              tickets.length === 0 ? (
                <option value="" disabled>Tick pass-outs to see matching units</option>
              ) : passedFleet.length === 0 ? (
                <option value="" disabled>No units match these pass-outs</option>
              ) : passedFleet.map((asset) => (
                <option key={asset.id} value={`asset:${asset.id}`}>{asset.fleet_id} • {asset.make_model}</option>
              ))
            ) : machines.map((machine) => (
              <option key={machine.assetId} value={`asset:${machine.assetId}`}>
                {machine.fleetId} • {machine.priority} • {machine.classification}
              </option>
            ))}
            {(production ? PRODUCTION_DUTIES : SHIFT_DUTIES).map((duty) => <option key={duty} value={duty}>{duty}</option>)}
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="min-h-11 px-4 rounded-lg border-2 border-slate-300 text-sm font-bold text-slate-700">Cancel</button>
          <button type="submit" disabled={saving || !name.trim() || !company.trim()} className="min-h-11 px-4 rounded-lg bg-violet-700 text-white text-sm font-black hover:bg-violet-600 disabled:opacity-50">
            {saving ? 'Saving...' : 'Add contractor'}
          </button>
        </div>
      </form>
  );

  if (embedded) return card;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      {card}
    </div>
  );
}
