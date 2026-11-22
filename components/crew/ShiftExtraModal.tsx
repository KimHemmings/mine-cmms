'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Asset, CrewMember, MachineWorkOrder } from '@/types';
import { AllocationChoice } from '@/utils/crewAllocation';
import OvertimeCrewModal from './OvertimeCrewModal';
import ContractorModal from './ContractorModal';

interface ShiftExtraModalProps {
  crew: CrewMember[];
  targetPanel: string;
  assets: Asset[];
  workOrders: MachineWorkOrder[];
  variant: 'workshop' | 'production';
  onAddOvertime: (member: CrewMember) => Promise<void>;
  onAddContractor: (input: { name: string; company: string; trade: string; allocation: AllocationChoice | null; passedOut: string[] }) => Promise<void>;
  onClose: () => void;
}

export default function ShiftExtraModal(props: ShiftExtraModalProps) {
  const [mode, setMode] = useState<'overtime' | 'contractor'>('overtime');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg my-8 space-y-3">
        <div className="flex rounded-full border border-slate-300 bg-white p-1" role="tablist" aria-label="Who to add">
          {([['overtime', 'Overtime (From Another Crew)'], ['contractor', 'External Contractor']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={`flex-1 min-h-10 px-3 rounded-full text-sm font-black ${mode === id ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
            >
              {label}
            </button>
          ))}
          <button type="button" onClick={props.onClose} className="min-h-10 min-w-10 text-slate-400 hover:text-slate-700" aria-label="Close">
            <X className="w-5 h-5 mx-auto" />
          </button>
        </div>
        {mode === 'overtime' ? (
          <OvertimeCrewModal crew={props.crew} targetPanel={props.targetPanel} onAdd={props.onAddOvertime} onClose={props.onClose} embedded />
        ) : (
          <ContractorModal
            crewLabel={props.targetPanel}
            assets={props.assets}
            workOrders={props.workOrders}
            variant={props.variant}
            onSave={props.onAddContractor}
            onClose={props.onClose}
            embedded
          />
        )}
      </div>
    </div>
  );
}
