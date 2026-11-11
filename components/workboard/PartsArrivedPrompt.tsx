'use client';

import React from 'react';
import { PackageCheck } from 'lucide-react';
import { MachineWorkOrder } from '@/types';

interface PartsArrivedPromptProps {
  workOrder: MachineWorkOrder;
  onResume: () => void;
}

export function allPartsArrived(wo: MachineWorkOrder) {
  return (
    wo.status === 'OPEN' &&
    wo.stage === 'WAITING_PARTS' &&
    !!wo.parts?.length &&
    wo.parts.every((p) => p.status === 'RECEIVED')
  );
}

export default function PartsArrivedPrompt({ workOrder, onResume }: PartsArrivedPromptProps) {
  if (!allPartsArrived(workOrder)) return null;

  return (
    <div className="mt-3 p-3 rounded-lg bg-emerald-50 border-2 border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm font-bold text-emerald-800">
        <PackageCheck className="w-5 h-5 text-emerald-600 shrink-0" />
        All parts for this job have arrived.
      </span>
      <button
        type="button"
        onClick={onResume}
        className="min-h-11 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black transition shadow-sm"
      >
        Resume work
      </button>
    </div>
  );
}
