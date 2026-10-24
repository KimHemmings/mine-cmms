'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Asset, MachineWorkOrder, DefectItem, HistoryNote, ShiftRecord } from '@/types';
import { useRealtimeWorkboard } from '@/hooks/useRealtimeWorkboard';
import { useWorkboardActions } from '@/hooks/useWorkboardActions';

interface UseWorkboardDataOptions {
  activeFitter: string;
}

export function useWorkboardData({ activeFitter }: UseWorkboardDataOptions) {
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [workOrders, setWorkOrders] = useState<MachineWorkOrder[]>([]);
  const [defects, setDefects] = useState<DefectItem[]>([]);
  const [notes, setNotes] = useState<HistoryNote[]>([]);
  const [activeShift, setActiveShift] = useState<ShiftRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  const fetchShift = useCallback(async () => {
    const { data } = await supabase
      .from('shift_records')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) setActiveShift(data as ShiftRecord);
  }, [supabase]);

  const fetchFleet = useCallback(async () => {
    const { data } = await supabase
      .from('assets')
      .select('*')
      .order('fleet_id', { ascending: true });

    if (data) {
      const sorted = [...data].sort((a, b) => {
        const pOrder = { P1: 1, P2: 2, P3: 3, P4: 4 };
        const valA = a.priority ? pOrder[a.priority as keyof typeof pOrder] : 5;
        const valB = b.priority ? pOrder[b.priority as keyof typeof pOrder] : 5;
        if (valA !== valB) return valA - valB;
        if (a.down_since && b.down_since) {
          return new Date(a.down_since).getTime() - new Date(b.down_since).getTime();
        }
        return 0;
      });
      setAllAssets(sorted as Asset[]);
    }
  }, [supabase]);

  const fetchWorkOrders = useCallback(async () => {
    const { data } = await supabase
      .from('machine_work_orders')
      .select('*')
      .order('created_at', { ascending: true });

    if (data) setWorkOrders(data as MachineWorkOrder[]);
  }, [supabase]);

  const fetchDefects = useCallback(async () => {
    const { data } = await supabase
      .from('defect_watchlist')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setDefects(data as DefectItem[]);
  }, [supabase]);

  const fetchNotes = useCallback(async () => {
    const { data } = await supabase
      .from('asset_history_notes')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setNotes(data as HistoryNote[]);
  }, [supabase]);

  const fetchAllData = useCallback(async () => {
    await Promise.all([fetchShift(), fetchFleet(), fetchWorkOrders(), fetchDefects(), fetchNotes()]);
    setLoading(false);
  }, [fetchShift, fetchFleet, fetchWorkOrders, fetchDefects, fetchNotes]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const { syncStatus } = useRealtimeWorkboard({
    onDataChange: fetchAllData,
    debounceMs: 300,
  });

  const actions = useWorkboardActions({
    supabase,
    activeFitter,
    activeShift,
    fetchAllData,
  });

  const shiftJobs = useMemo(() => {
    return allAssets.filter((a) => {
      // Rule: An asset MUST have at least one work order to be on the shift workboard
      const hasWorkOrder = workOrders.some((wo) => wo.asset_id === a.id);
      if (!hasWorkOrder) return false;

      if (a.in_shift) return true;
      if (a.status === 'OPERATIONAL' && a.actual_up) {
        if (activeShift?.started_at) {
          return new Date(a.actual_up) >= new Date(activeShift.started_at);
        }
        return Date.now() - new Date(a.actual_up).getTime() < 14 * 60 * 60 * 1000;
      }
      return false;
    });
  }, [allAssets, activeShift, workOrders]);

  const completedJobs = allAssets.filter((a) => !a.in_shift && a.actual_up);
  const unassignedMachines = allAssets.filter((a) => !a.in_shift);

  return {
    allAssets,
    workOrders,
    defects,
    notes,
    activeShift,
    loading,
    syncStatus,
    shiftJobs,
    completedJobs,
    unassignedMachines,
    fetchAllData,
    ...actions,
  };
}