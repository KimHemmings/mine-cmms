'use client';

import React from 'react';
import { STAGE_OPTIONS, WorkOrderStage } from '@/types';
import { STAGE_THEMES } from './workboardTheme';

interface JobStatusSelectProps {
  stage: WorkOrderStage | null | undefined;
  isDone: boolean;
  onChange: (newStage: string) => void;
}

export default function JobStatusSelect({ stage, isDone, onChange }: JobStatusSelectProps) {
  const value = isDone ? 'COMPLETED' : stage || 'IN_PROGRESS';
  const theme = STAGE_THEMES[value] || STAGE_THEMES.IN_PROGRESS;

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Job status</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`min-h-11 min-w-48 text-sm font-bold rounded-lg border-2 px-3 cursor-pointer outline-none focus:ring-2 focus:ring-slate-400 transition ${theme.select}`}
      >
        {STAGE_OPTIONS.filter((o) => o.value !== 'COMPLETED').map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        <option value="COMPLETED">✓ Completed (sign off)</option>
      </select>
    </label>
  );
}
