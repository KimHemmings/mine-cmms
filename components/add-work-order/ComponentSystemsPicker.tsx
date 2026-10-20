'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { COMPONENT_SYSTEMS } from '@/types';

interface ComponentSystemsPickerProps {
  selectedSystems: string[];
  toggleSystem: (sys: string) => void;
}

export default function ComponentSystemsPicker({
  selectedSystems,
  toggleSystem,
}: ComponentSystemsPickerProps) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1.5">
        AREAS BEING WORKED ON <span className="text-slate-500 font-normal">(Select multiple)</span>
      </label>
      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
        {COMPONENT_SYSTEMS.map((sys) => {
          const isSelected = selectedSystems.includes(sys);
          return (
            <button
              key={sys}
              type="button"
              onClick={() => toggleSystem(sys)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition flex items-center gap-1 cursor-pointer ${
                isSelected
                  ? 'bg-amber-100 border-amber-500 text-amber-900'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {isSelected && <Check className="w-3 h-3 text-amber-600" />}
              {sys}
            </button>
          );
        })}
      </div>
    </div>
  );
}