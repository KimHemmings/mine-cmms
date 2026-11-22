'use client';

import React from 'react';
import { Pencil, History, MapPin, AlertTriangle, ChevronUp } from 'lucide-react';
import { Asset } from '@/types';
import { formatDateTime, getElapsedDown } from '@/utils/helpers';
import { EventClassBadge } from './workboardTheme';

interface MachineCardHeaderProps {
  asset: Asset;
  eventConfig?: { badge: string; label: string; icon: React.ReactNode };
  priorityBadge: string;
  priorityLabel: string;
  isReleased: boolean;
  yours?: boolean;
  etu?: { overdue: boolean; label: string } | null;
  showOverdue?: boolean;
  canEditDetails?: boolean;
  openQuickEdit: (asset: Asset) => void;
  openHistory: (asset: Asset) => void;
  openDefects: (asset: Asset) => void;
  onCollapse?: () => void;
}

export default function MachineCardHeader({
  asset,
  eventConfig,
  priorityBadge,
  priorityLabel,
  isReleased,
  yours = false,
  etu = null,
  showOverdue = false,
  canEditDetails = true,
  openQuickEdit,
  openHistory,
  openDefects,
  onCollapse,
}: MachineCardHeaderProps) {
  return (
    <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="shrink-0 inline-flex items-center gap-1.5">
          <span className={`text-xs font-extrabold uppercase px-2 py-0.5 rounded border ${priorityBadge}`}>
            {priorityLabel}
          </span>
          {eventConfig && <EventClassBadge config={eventConfig} />}
          {yours && (
            <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded bg-slate-900 text-white">Your job</span>
          )}
        </span>

        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-slate-900 tracking-wide">{asset.fleet_id}</span>
          <span className="text-sm font-bold text-slate-600">{asset.make_model}</span>
        </div>

        <span className="text-xs font-bold px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
          {asset.machine_owner || 'Central'}
        </span>

        <span className="flex items-center gap-1 text-sm text-slate-600">
          <MapPin className="w-4 h-4 text-slate-400" />
          <strong className="text-slate-900">{asset.location || 'No location set'}</strong>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {!isReleased && (
          <>
            <span className="text-slate-600">
              Down for <strong className="font-mono text-rose-700">{getElapsedDown(asset.down_since)}</strong>
            </span>

            <span className="text-slate-600">
              Expected back up <strong className="font-mono text-slate-900">{formatDateTime(asset.expected_up)}</strong>
              {showOverdue && etu && (
                <span className="ml-1.5 px-2 py-0.5 rounded text-xs font-black uppercase bg-red-600 text-white">
                  {etu.label}
                </span>
              )}
              {etu && !etu.overdue && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs font-black bg-emerald-100 text-emerald-800">
                  {etu.label}
                </span>
              )}
            </span>
          </>
        )}

        <div className="flex gap-2">
          {canEditDetails && (
          <button
            type="button"
            onClick={() => openQuickEdit(asset)}
            className="min-h-11 flex items-center gap-1.5 px-3.5 bg-white hover:bg-amber-50 border-2 border-slate-300 hover:border-amber-400 rounded-lg text-slate-800 text-sm font-bold transition cursor-pointer"
            title="Change priority, location, down time or expected back-up time"
          >
            <Pencil className="w-4 h-4 text-amber-600" /> Edit details
          </button>
          )}

          <button
            type="button"
            onClick={() => openDefects(asset)}
            className="min-h-11 flex items-center gap-1.5 px-3.5 bg-white hover:bg-rose-50 border-2 border-slate-300 hover:border-rose-300 rounded-lg text-slate-800 text-sm font-bold transition cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600" /> Defects
          </button>
          <button
            type="button"
            onClick={() => openHistory(asset)}
            className="min-h-11 flex items-center gap-1.5 px-3.5 bg-white hover:bg-slate-100 border-2 border-slate-300 rounded-lg text-slate-800 text-sm font-bold transition cursor-pointer"
          >
            <History className="w-4 h-4 text-amber-600" /> History
          </button>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              aria-expanded
              className="min-h-11 flex items-center gap-1.5 px-3.5 bg-white hover:bg-slate-100 border-2 border-slate-300 rounded-lg text-slate-800 text-sm font-bold transition cursor-pointer"
            >
              <ChevronUp className="w-4 h-4" /> Collapse
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
