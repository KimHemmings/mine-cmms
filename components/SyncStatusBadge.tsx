'use client';

import React from 'react';
import { SyncStatus } from '@/hooks/useRealtimeWorkboard';

export function SyncStatusBadge({
  status,
  pending = 0,
  onRefresh,
}: {
  status: SyncStatus;
  pending?: number;
  onRefresh?: () => void;
}) {
  const connected = status === 'CONNECTED';
  const connecting = status === 'CONNECTING';
  const label = connected ? 'Live' : connecting ? 'Connecting' : 'Offline';
  const tone = connected
    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
    : connecting
      ? 'bg-amber-50 text-amber-800 border-amber-300'
      : 'bg-rose-50 text-rose-800 border-rose-300';
  const dot = connected ? 'bg-emerald-500' : connecting ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <button
      type="button"
      onClick={onRefresh}
      title="Reload the latest data"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${tone}`}
    >
      <span className={`h-2 w-2 rounded-full ${dot} ${connected ? 'animate-pulse' : ''}`} />
      {label}
      {pending > 0 && <span className="font-black">· {pending} on this tablet</span>}
    </button>
  );
}
