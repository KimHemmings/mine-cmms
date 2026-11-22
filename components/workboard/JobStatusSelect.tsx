'use client';

import React, { useEffect, useState } from 'react';
import { OPERATIONAL_STAGE_OPTIONS, STAGE_OPTIONS, WorkOrderStage } from '@/types';
import { createClient } from '@/utils/supabase/client';
import { holdBadge, isHoldStage } from '@/utils/jobHold';
import { STAGE_THEMES } from './workboardTheme';

interface JobStatusSelectProps {
  stage: WorkOrderStage | null | undefined;
  isDone: boolean;
  onChange: (newStage: string) => void;
  locked?: boolean;
}

export function HoldPill({ label }: { label: string }) {
  return (
    <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300">
      {label}
    </span>
  );
}

export default function JobStatusSelect({ stage, isDone, onChange, locked = false }: JobStatusSelectProps) {
  const value = isDone ? 'COMPLETED' : stage || 'IN_PROGRESS';
  const theme = STAGE_THEMES[value] || STAGE_THEMES.IN_PROGRESS;
  const label = STAGE_OPTIONS.find((option) => option.value === value)?.label ?? 'In Progress';
  const choices = OPERATIONAL_STAGE_OPTIONS.some((option) => option.value === value)
    ? OPERATIONAL_STAGE_OPTIONS
    : [...OPERATIONAL_STAGE_OPTIONS, { value, label }];

  if (locked) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Job status</span>
        <span className={`min-h-11 min-w-48 inline-flex items-center text-sm font-bold rounded-lg border-2 px-3 ${theme.select}`}>
          {label}
        </span>
      </div>
    );
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Job status</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`min-h-11 min-w-48 text-sm font-bold rounded-lg border-2 px-3 cursor-pointer outline-none focus:ring-2 focus:ring-slate-400 transition ${theme.select}`}
      >
        {choices.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function HoldEtaField({
  workOrderId,
  value,
  onSaved,
}: {
  workOrderId: string;
  value?: string | null;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  async function save() {
    const next = draft.trim();
    if (next === (value ?? '').trim()) return;
    const supabase = createClient();
    const { error } = await supabase.from('machine_work_orders').update({ hold_eta: next || null }).eq('id', workOrderId);
    if (!error) onSaved();
  }

  return (
    <label className="flex flex-col gap-1 min-w-56 flex-1">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Hold ETA</span>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void save();
          }
        }}
        placeholder="Parts / Hold ETA (e.g. 14:30 or Tomorrow AM)"
        className="min-h-11 rounded-lg border-2 border-amber-300 bg-amber-50 px-3 text-sm font-bold text-amber-950"
      />
    </label>
  );
}

export function JobHoldControls({
  stage,
  isDone,
  holdEta,
  workOrderId,
  locked = false,
  onChange,
  onSaved,
}: {
  stage: WorkOrderStage | null | undefined;
  isDone: boolean;
  holdEta?: string | null;
  workOrderId: string;
  locked?: boolean;
  onChange: (newStage: string) => void;
  onSaved: () => void;
}) {
  const badge = !isDone ? holdBadge(stage, holdEta) : null;
  return (
    <div className="flex flex-col items-stretch gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <JobStatusSelect stage={stage} isDone={isDone} onChange={onChange} locked={locked} />
        {!locked && !isDone && isHoldStage(stage) && (
          <HoldEtaField workOrderId={workOrderId} value={holdEta} onSaved={onSaved} />
        )}
      </div>
      {badge && <HoldPill label={badge} />}
    </div>
  );
}
