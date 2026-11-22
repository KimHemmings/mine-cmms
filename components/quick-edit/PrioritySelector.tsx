'use client';

import React from 'react';

interface PrioritySelectorProps {
  priority: string;
  setPriority: (priority: string) => void;
}

const PRIORITY_BUTTONS = [
  { label: 'P1 - HIGH', val: 'P1', activeClass: 'bg-rose-600 text-white border-rose-600 shadow-sm' },
  { label: 'P2 - MEDIUM', val: 'P2', activeClass: 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm' },
  { label: 'P3 - LOW', val: 'P3', activeClass: 'bg-blue-700 text-white border-blue-700 shadow-sm' },
];

export default function PrioritySelector({ priority, setPriority }: PrioritySelectorProps) {
  const selected = priority === 'P1' || priority === 'P2' ? priority : 'P3';
  return (
    <div>
      <label className="block font-bold text-slate-700 mb-1.5">PRIORITY RATING</label>
      <div className="grid grid-cols-3 gap-1.5">
        {PRIORITY_BUTTONS.map((p) => {
          const isSelected = selected === p.val;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => setPriority(p.val)}
              className={`py-2 px-1 rounded-lg font-bold border transition text-center text-[11px] cursor-pointer ${
                isSelected
                  ? p.activeClass
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}