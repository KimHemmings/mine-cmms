'use client';

import React from 'react';
import { SyncStatus } from '@/hooks/useRealtimeWorkboard';

export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  switch (status) {
    case 'CONNECTED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          LIVE SYNC
        </span>
      );
    case 'CONNECTING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          CONNECTING
        </span>
      );
    case 'DISCONNECTED':
    case 'ERROR':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-300">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          OFFLINE (LOCAL)
        </span>
      );
  }
}