'use client';

import React from 'react';
import { Edit3, History } from 'lucide-react';
import { Asset } from '@/types';
import { formatDateTime, getElapsedDown, getEtuStatus } from '@/utils/helpers';

interface MachineCardHeaderProps {
  asset: Asset;
  eventConfig: { badge: string; label: string; icon: React.ReactNode };
  priorityBadge: string;
  priorityLabel: string;
  openQuickEdit: (asset: Asset) => void;
  openHistory: (asset: Asset) => void;
}

export default function MachineCardHeader({
  asset,
  priorityBadge,
  priorityLabel,
  openQuickEdit,
  openHistory,
}: MachineCardHeaderProps) {
  const etu = getEtuStatus(asset.expected_up);

  return (
    <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => openQuickEdit(asset)}
          className={`text-[10px] font-black px-2.5 py-1 rounded border uppercase tracking-wider hover:opacity-80 transition cursor-pointer ${priorityBadge}`}
        >
          {priorityLabel}
        </button>

        <div className="flex items-baseline gap-2">
          <span className="text-xl font-black text-slate-900 tracking-wide">{asset.fleet_id}</span>
          <span className="text-xs font-bold text-slate-600">{asset.make_model}</span>
        </div>

        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
          {asset.machine_owner || 'Central'}
        </span>

        <button
          type="button"
          onClick={() => openQuickEdit(asset)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-slate-200 hover:border-amber-400 text-xs font-semibold text-slate-700 transition shadow-2xs cursor-pointer"
        >
          <span className="text-slate-400">Loc / Bay:</span>
          <strong className="text-slate-900">{asset.location || 'Unassigned'}</strong>
          <Edit3 className="w-3 h-3 text-amber-600 ml-0.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => openQuickEdit(asset)}
          className="bg-white hover:bg-slate-50 px-2.5 py-1 rounded border border-slate-200 text-[11px] font-medium text-slate-600 transition shadow-2xs text-left cursor-pointer"
        >
          Down: <strong className="font-mono text-rose-700 font-bold">{getElapsedDown(asset.down_since)}</strong>
        </button>

        <button
          type="button"
          onClick={() => openQuickEdit(asset)}
          className="bg-white hover:bg-slate-50 px-2.5 py-1 rounded border border-slate-200 text-[11px] font-medium text-slate-600 transition shadow-2xs text-left cursor-pointer"
        >
          ETU: <strong className="font-mono text-slate-900 font-bold">{formatDateTime(asset.expected_up)}</strong>
          {etu && (
            <span className={`ml-1.5 px-1 rounded text-[10px] font-black ${etu.overdue ? 'text-rose-700 bg-rose-50' : 'text-emerald-700 bg-emerald-50'}`}>
              {etu.label}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => openHistory(asset)}
          className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-slate-800 text-xs font-bold transition shadow-2xs cursor-pointer"
        >
          <History className="w-3.5 h-3.5 text-amber-600" /> Shift History
        </button>
      </div>
    </div>
  );
}