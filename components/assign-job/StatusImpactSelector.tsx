'use client';

import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface StatusImpactSelectorProps {
  isMachineDown: boolean;
  onChange: (isDown: boolean) => void;
}

export default function StatusImpactSelector({
  isMachineDown,
  onChange,
}: StatusImpactSelectorProps) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
        Operational Status Impact
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`py-2 px-3 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 transition cursor-pointer ${
            isMachineDown
              ? 'bg-rose-50 border-rose-500 text-rose-800 shadow-2xs'
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>Take Machine Down</span>
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`py-2 px-3 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 transition cursor-pointer ${
            !isMachineDown
              ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs'
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>In-Service Inspection</span>
        </button>
      </div>
    </div>
  );
}