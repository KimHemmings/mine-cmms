import React from 'react';
import { Wrench, AlertTriangle, AlertOctagon, Clipboard } from 'lucide-react';

export const STAGE_THEMES: Record<string, { label: string; badge: string; select: string }> = {
  IN_PROGRESS: {
    label: 'In Progress',
    badge: 'bg-blue-100 text-blue-900 border-blue-300',
    select: 'border-blue-300 bg-blue-50 text-blue-900',
  },
  WAITING_LABOUR: {
    label: 'Waiting on Labour',
    badge: 'bg-purple-100 text-purple-900 border-purple-300',
    select: 'border-purple-300 bg-purple-50 text-purple-900',
  },
  WAITING_PARTS: {
    label: 'Waiting on Parts',
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
    select: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  WAITING_OEM: {
    label: 'Waiting on OEM',
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
    select: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  WAITING_BAY: {
    label: 'Waiting on Bay / Crane',
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
    select: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  WAITING_PRODUCTION: {
    label: 'Waiting on Production',
    badge: 'bg-teal-100 text-teal-900 border-teal-300',
    select: 'border-teal-300 bg-teal-50 text-teal-900',
  },
  WEATHER_DELAY: {
    label: 'Weather Delay',
    badge: 'bg-slate-200 text-slate-800 border-slate-300',
    select: 'border-slate-300 bg-slate-100 text-slate-800',
  },
  COMPLETED: {
    label: 'Completed (sign off)',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    select: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  },
};

export function getEventConfig(orderType?: string | null, isPlanned?: boolean) {
  const raw = (orderType || '').toUpperCase();
  let type: 'ACCIDENT_DAMAGE' | 'INSPECTION' | 'PLANNED' | 'UNPLANNED' = isPlanned ? 'PLANNED' : 'UNPLANNED';

  // Specific event type on the work order takes precedence over asset-level status
  if (raw.includes('ACCIDENT') || raw.includes('DAMAGE')) {
    type = 'ACCIDENT_DAMAGE';
  } else if (raw.includes('INSPECT')) {
    type = 'INSPECTION';
  } else if (raw === 'PLANNED' || raw === 'PM02') {
    type = 'PLANNED';
  } else if (raw === 'UNPLANNED' || raw === 'PM01') {
    type = 'UNPLANNED';
  }

  const map = {
    PLANNED: {
      border: 'border-l-emerald-500',
      badge: 'bg-sky-100 text-sky-800 border border-sky-300',
      label: 'PLANNED PM',
      icon: <Wrench className="w-3 h-3" />,
    },
    INSPECTION: {
      border: 'border-l-sky-500',
      badge: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
      label: 'INSPECTION',
      icon: <Clipboard className="w-3 h-3" />,
    },
    ACCIDENT_DAMAGE: {
      border: 'border-l-orange-500',
      badge: 'bg-orange-600 text-white',
      label: 'ACCIDENT DAMAGE',
      icon: <AlertTriangle className="w-3 h-3" />,
    },
    UNPLANNED: {
      border: 'border-l-rose-600',
      badge: 'bg-rose-600 text-white',
      label: 'BREAKDOWN',
      icon: <AlertOctagon className="w-3 h-3" />,
    },
  };

  return map[type];
}

export function EventClassBadge({
  config,
}: {
  config: { badge: string; label: string; icon: React.ReactNode };
}) {
  return (
    <span className={`shrink-0 text-xs font-extrabold uppercase px-2 py-0.5 rounded inline-flex items-center gap-1 ${config.badge}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

/** Workshop board uses three tiers. Blank, P4, and any unknown value render as P3. */
export function workshopPriority(priority?: string | null): 'P1' | 'P2' | 'P3' {
  if (priority === 'P1' || priority === 'P2') return priority;
  return 'P3';
}

export function getPriorityConfig(priority?: string | null) {
  const tier = workshopPriority(priority);
  if (tier === 'P1') return { badge: 'bg-rose-600 text-white border-rose-700', label: 'P1 - HIGH' };
  if (tier === 'P2') return { badge: 'bg-amber-500 text-slate-950 border-amber-600', label: 'P2 - MEDIUM' };
  return { badge: 'bg-blue-700 text-white border-blue-800', label: 'P3 - LOW' };
}

export function formatWoDisplay(woNum?: string | null, emptyLabel?: string): string {
  if (!woNum || !woNum.trim()) return emptyLabel || 'No WO # yet';
  const clean = woNum.replace(/^WO-?/i, '').trim();
  return `WO #${clean}`;
}