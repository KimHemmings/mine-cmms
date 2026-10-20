'use client';

import React from 'react';
import { Clock } from 'lucide-react';

interface EtuPresetsPickerProps {
  downSinceInput: string;
  setDownSinceInput: (val: string) => void;
  expectedUpInput: string;
  setExpectedUpInput: (val: string) => void;
  activePreset: string | null;
  setActivePreset: (preset: string | null) => void;
}

const PRESETS = [
  { id: '1h', label: '+1 Hour', hours: 1 },
  { id: '2h', label: '+2 Hours', hours: 2 },
  { id: '4h', label: '+4 Hours', hours: 4 },
];

export default function EtuPresetsPicker({
  downSinceInput,
  setDownSinceInput,
  expectedUpInput,
  setExpectedUpInput,
  activePreset,
  setActivePreset,
}: EtuPresetsPickerProps) {
  function applyHoursPreset(hours: number, id: string) {
    setActivePreset(id);
    const target = new Date(Date.now() + hours * 60 * 60 * 1000);
    const localTarget = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setExpectedUpInput(localTarget);
  }

  function applyShiftEndPreset() {
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
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">DATE & TIME DOWN</label>
          <input
            type="datetime-local"
            value={downSinceInput}
            onChange={(e) => setDownSinceInput(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-slate-400"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">EXPECTED UP TIME (ETU)</label>
          <input
            type="datetime-local"
            value={expectedUpInput}
            onChange={(e) => {
              setExpectedUpInput(e.target.value);
              setActivePreset(null);
            }}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-slate-400"
            required
          />
        </div>
      </div>

      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Quick ETU Presets
        </span>
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((p) => {
            const isSelected = activePreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyHoursPreset(p.hours, p.id)}
                className={`py-1 px-2 rounded text-xs font-bold transition border cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                }`}
              >
                {p.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={applyShiftEndPreset}
            className={`py-1 px-2 rounded text-xs font-bold transition border cursor-pointer ${
              activePreset === 'shift_end'
                ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                : 'bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-900'
            }`}
          >
            End of Shift
          </button>
        </div>
      </div>
    </div>
  );
}