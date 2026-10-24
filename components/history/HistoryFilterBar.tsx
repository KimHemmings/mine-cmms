'use client';

import React from 'react';
import { Search, Clock, Wrench } from 'lucide-react';
import { COMPONENT_SYSTEMS } from '@/types';

export type TimeScope = 'CURRENT_EVENT' | 'ROSTER_7D' | 'ALL';

interface HistoryFilterBarProps {
  searchFilter: string;
  setSearchFilter: (val: string) => void;
  timeScope: TimeScope;
  setTimeScope: (scope: TimeScope) => void;
  selectedSystem: string;
  setSelectedSystem: (sys: string) => void;
  totalNotesCount: number;
  filteredCount: number;
}

const COMMON_SUBSYSTEMS = [
  'ALL',
  'Gearbox',
  'Transmission',
  'Engine',
  'Hydraulics',
  'Electrical',
  'Brakes',
  'Undercarriage',
];

export default function HistoryFilterBar({
  searchFilter,
  setSearchFilter,
  timeScope,
  setTimeScope,
  selectedSystem,
  setSelectedSystem,
  totalNotesCount,
  filteredCount,
}: HistoryFilterBarProps) {
  return (
    <div className="p-3 bg-slate-50/80 border-b border-slate-200 space-y-2.5">
      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          placeholder="Filter notes by keyword, fitter name, or stage..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-800"
        />
      </div>

      {/* Subsystem Filters (Gearbox, Transmission, etc.) */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
        <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0 flex items-center gap-0.5 mr-1">
          <Wrench className="w-3 h-3 text-slate-400" /> System:
        </span>
        {COMMON_SUBSYSTEMS.map((sys) => {
          const isSelected = selectedSystem === sys;
          return (
            <button
              key={sys}
              type="button"
              onClick={() => setSelectedSystem(sys)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer shrink-0 ${
                isSelected
                  ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {sys}
            </button>
          );
        })}
      </div>

      {/* Scope Selectors (Breakdown vs 7D vs All) */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-slate-200/60">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-0.5">
            <Clock className="w-3 h-3" /> Scope:
          </span>
          <button
            type="button"
            onClick={() => setTimeScope('CURRENT_EVENT')}
            className={`px-2 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer ${
              timeScope === 'CURRENT_EVENT'
                ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Current Breakdown
          </button>
          <button
            type="button"
            onClick={() => setTimeScope('ROSTER_7D')}
            className={`px-2 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer ${
              timeScope === 'ROSTER_7D'
                ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            7-Day Swing
          </button>
          <button
            type="button"
            onClick={() => setTimeScope('ALL')}
            className={`px-2 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer ${
              timeScope === 'ALL'
                ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            All History ({totalNotesCount})
          </button>
        </div>

        <span className="text-[11px] text-slate-500 font-medium">
          Showing {filteredCount} entry/entries
        </span>
      </div>
    </div>
  );
}