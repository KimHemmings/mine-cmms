'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';

export type SyncStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

interface UseRealtimeWorkboardOptions {
  onDataChange: () => Promise<void> | void;
  debounceMs?: number;
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
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          setSyncStatus('CONNECTED');
        } else if (status === 'CLOSED') {
          setSyncStatus('DISCONNECTED');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setSyncStatus('ERROR');
          console.error('[Supabase Realtime] Sync subscription error:', err);
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