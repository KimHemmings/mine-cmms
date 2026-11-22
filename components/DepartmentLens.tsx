'use client';

import { useState } from 'react';
import { Department, departmentLabel } from '@/utils/permissions';
import ManagementDirectives from '@/components/ManagementDirectives';
import TargetsRatesPanel from '@/components/TargetsRatesPanel';

export type LensSurface = 'board' | 'handover' | 'crew';

const ORDER: Department[] = ['workshop', 'production', 'training'];

const THEME: Record<Department, { bar: string; active: string; idle: string }> = {
  workshop: { bar: 'bg-orange-600', active: 'bg-white text-orange-800', idle: 'bg-orange-800/50 text-white' },
  production: { bar: 'bg-emerald-700', active: 'bg-white text-emerald-900', idle: 'bg-emerald-900/40 text-white' },
  training: { bar: 'bg-indigo-700', active: 'bg-white text-indigo-900', idle: 'bg-indigo-900/40 text-white' },
};

const SURFACE_COPY: Record<LensSurface, Record<Department, string>> = {
  board: {
    workshop: 'Workshop Bay / Field Breakdown Whiteboard',
    production: 'Pit Fleet & ETAs Whiteboard',
    training: 'Operator Pass-Out Matrix',
  },
  handover: {
    workshop: 'Maintenance Shift Handover',
    production: 'Statutory OCE / Pit Shift Handover',
    training: 'Operator Pass-Out Matrix',
  },
  crew: {
    workshop: 'Trades Roster',
    production: 'Operator Allocations',
    training: 'Operator Pass-Out Matrix',
  },
};

export default function DepartmentLens({
  surface,
  department,
  onChange,
  actorName,
  canEditRates = false,
}: {
  surface: LensSurface;
  department: Department;
  onChange: (department: Department) => void;
  actorName: string;
  canEditRates?: boolean;
}) {
  const theme = THEME[department];
  const [action, setAction] = useState<'directive' | 'rates' | null>(null);
  return (
    <div className="space-y-3">
      <section className={`rounded-xl px-4 py-3 text-white ${theme.bar}`}>
        <p className="text-[11px] font-black uppercase tracking-wide">Viewing department</p>
        <div className="mt-2 flex flex-wrap gap-2" role="tablist" aria-label="Viewing department">
          {ORDER.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={department === item}
              onClick={() => onChange(item)}
              className={`min-h-11 rounded-full px-4 text-sm font-black ${department === item ? theme.active : theme.idle}`}
            >
              {departmentLabel(item)}
            </button>
          ))}
        </div>
        <p className="mt-3 text-base font-black">{SURFACE_COPY[surface][department]}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setAction((current) => current === 'directive' ? null : 'directive')} className="min-h-10 rounded-lg bg-white/15 px-3 text-sm font-black">
            Flag Directive
          </button>
          <button type="button" onClick={() => setAction((current) => current === 'rates' ? null : 'rates')} className="min-h-10 rounded-lg bg-white/15 px-3 text-sm font-black">
            Targets & Rates ($)
          </button>
        </div>
      </section>
      {action === 'directive' && (
        <ManagementDirectives actorName={actorName} department={department} lockDepartment canIssue submitLabel="Flag directive" />
      )}
      {action === 'rates' && <TargetsRatesPanel actorName={actorName} readOnly={!canEditRates} />}
    </div>
  );
}
