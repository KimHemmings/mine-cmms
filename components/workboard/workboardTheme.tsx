import React from 'react';
import { Wrench, AlertTriangle, AlertOctagon, FileText } from 'lucide-react';

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
    label: 'Wait on Parts',
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
    select: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  WAITING_PRODUCTION: {
    label: 'Wait on Production',
    badge: 'bg-teal-100 text-teal-900 border-teal-300',
    select: 'border-teal-300 bg-teal-50 text-teal-900',
  },
  WEATHER_DELAY: {
    label: 'Weather Delay',
    badge: 'bg-slate-200 text-slate-800 border-slate-300',
    select: 'border-slate-300 bg-slate-100 text-slate-800',
  },
  COMPLETED: {
    label: 'Complete',
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
      badge: 'bg-emerald-600 text-white',
      label: 'PLANNED',
      icon: <Wrench className="w-3.5 h-3.5" />,
    },
    INSPECTION: {
      border: 'border-l-sky-500',
      badge: 'bg-sky-600 text-white',
      label: 'INSPECTION',
      icon: <FileText className="w-3.5 h-3.5" />,
    },
    ACCIDENT_DAMAGE: {
      border: 'border-l-orange-500',
      badge: 'bg-orange-600 text-white',
      label: 'ACCIDENT DAMAGE',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
    },
    UNPLANNED: {
      border: 'border-l-rose-600',
      badge: 'bg-rose-600 text-white',
      label: 'BREAKDOWN',
      icon: <AlertOctagon className="w-3.5 h-3.5" />,
    },
  };

  return map[type];
}

export function getPriorityConfig(priority?: string | null) {
  const badge =
    priority === 'P1'
      ? 'bg-rose-100 text-rose-800 border-rose-300'
      : priority === 'P2'
      ? 'bg-orange-100 text-orange-800 border-orange-300'
      : priority === 'P3'
      ? 'bg-amber-100 text-amber-800 border-amber-300'
      : priority === 'P4'
      ? 'bg-blue-100 text-blue-800 border-blue-300'
      : 'bg-slate-100 text-slate-700 border-slate-300';

  const label =
    priority === 'P1'
      ? 'P1 - CRITICAL'
      : priority === 'P2'
      ? 'P2 - HIGH'
      : priority === 'P3'
      ? 'P3 - MEDIUM'
      : priority === 'P4'
      ? 'P4 - LOW'
      : 'NO PRIORITY';

  return { badge, label };
}

export function formatWoDisplay(woNum?: string | null): string {
  if (!woNum || !woNum.trim()) return 'NO SAP WO';
  const clean = woNum.replace(/^WO-?/i, '').trim();
  return `WO #${clean}`;
}