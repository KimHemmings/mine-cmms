'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';

export type SyncStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

interface UseRealtimeWorkboardOptions {
  onDataChange: () => Promise<void> | void;
  debounceMs?: number;
}

function isTransientSocketClose(err: unknown) {
  const message = err instanceof Error ? err.message : '';
  // 1001 = going away (navigation or hot reload). 1006 = closed without a goodbye.
  return message.startsWith('socket closed: 1001') || message.startsWith('socket closed: 1006');
}

export function useRealtimeWorkboard({
  onDataChange,
  debounceMs = 300,
}: UseRealtimeWorkboardOptions) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('CONNECTING');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onDataChangeRef = useRef(onDataChange);

  // Initialize client instance from your helper
  const supabase = useMemo(() => createClient(), []);

  // Maintain latest callback reference
  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  const triggerChange = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onDataChangeRef.current();
    }, debounceMs);
  }, [debounceMs]);

  useEffect(() => {
    const channel = supabase
      .channel('shift-workboard-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assets' },
        () => triggerChange()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'machine_work_orders' },
        () => triggerChange()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'defect_watchlist' },
        () => triggerChange()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'asset_history_notes' },
        () => triggerChange()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crew_members' },
        () => triggerChange()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_crew' },
        () => triggerChange()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'handover_log_entries' },
        () => triggerChange()
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          setSyncStatus('CONNECTED');
          return;
        }
        if (status === 'CLOSED' || isTransientSocketClose(err)) {
          // The client reconnects on its own. A dropped socket is not a failed save.
          setSyncStatus('CONNECTING');
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setSyncStatus('ERROR');
          console.warn('[Supabase Realtime] Live updates unavailable:', err);
        }
      });

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [supabase, triggerChange]);

  return { syncStatus };
}