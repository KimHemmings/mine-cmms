'use client';

import React, { useState } from 'react';
import { Clock } from 'lucide-react';

interface EtuTimeSectionProps {
  downSinceInput: string;
  setDownSinceInput: (val: string) => void;
  expectedUpInput: string;
  setExpectedUpInput: (val: string) => void;
}

const PRESETS = [
  { id: '2h', label: '+2h', hours: 2 },
  { id: '4h', label: '+4h', hours: 4 },
  { id: '8h', label: '+8h', hours: 8 },
];

export default function EtuTimeSection({
  downSinceInput,
  setDownSinceInput,
  expectedUpInput,
  setExpectedUpInput,
}: EtuTimeSectionProps) {
  const [activePreset, setActivePreset] = useState<string | null>(null);

  function applyEtuPreset(hours: number, id: string) {
    setActivePreset(id);
    const target = new Date(Date.now() + hours * 60 * 60 * 1000);
    const localTarget = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setExpectedUpInput(localTarget);
  }

  function setEndOfShiftEtu() {
    setActivePreset('shift_end');
    const now = new Date();
    const isDayShift = now.getHours() >= 6 && now.getHours() < 18;
    const target = new Date();
    if (isDayShift) {
      target.setHours(17, 30, 0, 0);
    } else {
      if (now.getHours() >= 18) target.setDate(target.getDate() + 1);
      target.setHours(5, 30, 0, 0);
    }
    const localTarget = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setExpectedUpInput(localTarget);
  }

  return (
    <div className="space-y-2 pt-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block font-bold text-slate-700 mb-1">DOWN SINCE</label>
          <input
            type="datetime-local"
            value={downSinceInput}
            onChange={(e) => setDownSinceInput(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-slate-400"
            required
          />
        </div>
        <div>
          <label className="block font-bold text-slate-700 mb-1">EXPECTED UP TIME (ETU)</label>
          <input
            type="datetime-local"
            value={expectedUpInput}
            onChange={(e) => {
              setExpectedUpInput(e.target.value);
              setActivePreset(null);
            }}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-slate-400"
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 pt-1">
        <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
          <Clock className="w-3 h-3" /> Presets:
        </span>
        {PRESETS.map((p) => {
          const isSelected = activePreset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => applyEtuPreset(p.hours, p.id)}
              className={`px-2.5 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                isSelected
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={setEndOfShiftEtu}
          className={`px-2.5 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
            activePreset === 'shift_end'
              ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
              : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
          }`}
        >
          Shift End
        </button>
      </div>
    </div>
  );
}