'use client';

import React from 'react';
import { User } from 'lucide-react';
import { HistoryNote } from '@/types';
import { formatDateTime } from '@/utils/helpers';

interface HistoryTimelineListProps {
  notes: HistoryNote[];
}

const STAGE_BADGES: Record<string, string> = {
  IN_PROGRESS: 'bg-blue-100 text-blue-900 border-blue-300',
  WAITING_PARTS: 'bg-amber-100 text-amber-900 border-amber-300',
  WAITING_LABOUR: 'bg-purple-100 text-purple-900 border-purple-300',
  WAITING_PRODUCTION: 'bg-teal-100 text-teal-900 border-teal-300',
  WEATHER_DELAY: 'bg-slate-200 text-slate-800 border-slate-300',
  COMPLETED: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  DIAGNOSING: 'bg-amber-50 text-amber-900 border-amber-200',
};

function formatStageLabel(rawStage?: string): string {
  if (!rawStage) return 'IN PROGRESS';
  return rawStage.replace(/_/g, ' ').toUpperCase();
}

export default function HistoryTimelineList({ notes }: HistoryTimelineListProps) {
  if (notes.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 text-xs">
        No shift notes found matching the selected scope or system filter.
      </div>
    );
  }

  return (
    <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-white">
      {notes.map((n) => {
        const cleanStage = (n.stage || 'IN_PROGRESS').toUpperCase();
        const badgeTheme = STAGE_BADGES[cleanStage] || STAGE_BADGES.IN_PROGRESS;

        return (
          <div
            key={n.id}
            className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2 shadow-2xs"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-600" /> {n.fitter_name}
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {formatDateTime(n.created_at)}
              </span>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {n.note}
            </p>

            <div className="pt-1">
              <span
                className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${badgeTheme}`}
              >
                STAGE: {formatStageLabel(n.stage)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}