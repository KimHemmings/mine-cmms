'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Asset, MachineWorkOrder, DefectItem, HistoryNote, ShiftRecord } from '@/types';
import { useRealtimeWorkboard, SyncStatus } from '@/hooks/useRealtimeWorkboard';

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
      const sorted = data.sort((a, b) => {
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
    await Promise.all([
      fetchShift(),
      fetchFleet(),
      fetchWorkOrders(),
      fetchDefects(),
      fetchNotes(),
    ]);
    setLoading(false);
  }, [fetchShift, fetchFleet, fetchWorkOrders, fetchDefects, fetchNotes]);

  // Initial load
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Bind Realtime subscription
  const { syncStatus } = useRealtimeWorkboard({
    onDataChange: fetchAllData,
    debounceMs: 300,
  });

  async function updateWorkOrderStage(woId: string, assetId: string, newStage: string) {
    const { error } = await supabase
      .from('machine_work_orders')
      .update({ stage: newStage })
      .eq('id', woId);

    if (!error) {
      await supabase.from('asset_history_notes').insert([
        {
          asset_id: assetId,
          fitter_name: activeFitter || 'Fitter',
          note: `Work order stage updated to ${newStage.replace('_', ' ')}`,
          stage: newStage,
        },
      ]);
      fetchWorkOrders();
      fetchNotes();
    }
  }

  async function signOffWorkOrder(woId: string, assetId: string) {
    const { error } = await supabase
      .from('machine_work_orders')
      .update({
        status: 'COMPLETED',
        stage: 'COMPLETED',
        completed_at: new Date().toISOString(),
        completed_by: activeFitter || 'Signoff Fitter',
      })
      .eq('id', woId);

    if (!error) {
      await supabase.from('asset_history_notes').insert([
        {
          asset_id: assetId,
          fitter_name: activeFitter || 'Signoff Fitter',
          note: `Work order completed and signed off.`,
          stage: 'COMPLETED',
        },
      ]);
      fetchWorkOrders();
      fetchNotes();
    }
  }

  async function releaseMachineToProduction(assetId: string) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('assets')
      .update({
        in_shift: false,
        status: 'OPERATIONAL',
        actual_up: now,
        priority: null,
      })
      .eq('id', assetId);

    if (!error) {
      await supabase.from('asset_history_notes').insert([
        {
          asset_id: assetId,
          fitter_name: activeFitter || 'Supervisor',
          note: `All scopes and defects signed off. Machine released to production.`,
          stage: 'OPERATIONAL',
        },
      ]);
      fetchAllData();
    }
  }

  async function handleRolloverShift() {
    if (!activeShift) return;

    await supabase
      .from('shift_records')
      .update({
        status: 'HANDED_OVER',
        closed_at: new Date().toISOString(),
      })
      .eq('id', activeShift.id);

    const nextShiftName = activeShift.shift_name.toLowerCase().includes('day')
      ? 'Night Shift'
      : 'Day Shift';

    const { data: newShift } = await supabase
      .from('shift_records')
      .insert([
        {
          shift_name: nextShiftName,
          supervisor: activeFitter || 'Supervisor',
          status: 'ACTIVE',
        },
      ])
      .select()
      .single();

    if (newShift) {
      await supabase
        .from('machine_work_orders')
        .update({ shift_id: newShift.id })
        .eq('status', 'OPEN');
    }

    alert(`Shift successfully rolled over to ${nextShiftName}. All active breakdowns carried forward.`);
    fetchAllData();
  }

  const shiftJobs = allAssets.filter((a) => a.in_shift);
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
    updateWorkOrderStage,
    signOffWorkOrder,
    releaseMachineToProduction,
    handleRolloverShift,
  };
}