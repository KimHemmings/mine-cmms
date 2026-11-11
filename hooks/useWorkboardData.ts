// hooks/useWorkboardData.ts - Exactly 116 lines
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Asset, Authorisation, CrewAuthorisation, CrewSupervision, MachineWorkOrder, DefectItem, HistoryNote, ShiftRecord, CrewMember, HandoverLogEntry, OperatorPassout, ShiftMachineOperator } from '@/types';
import { useRealtimeWorkboard } from '@/hooks/useRealtimeWorkboard';
import { beginStageFlush, dropQueuedStage, endStageFlush, isNetworkError, readStageQueue } from '@/utils/stageQueue';
import { logAssetHistory } from '@/utils/helpers';
import { useWorkboardActions } from '@/hooks/useWorkboardActions';

interface UseWorkboardDataOptions {
  activeFitter: string;
}

function withQueuedStages(orders: MachineWorkOrder[]): MachineWorkOrder[] {
  const pending = readStageQueue();
  if (pending.length === 0) return orders;
  const byId = new Map(pending.map((item) => [item.woId, item.newStage]));
  return orders.map((order) => {
    const stage = byId.get(order.id);
    if (!stage) return order;
    return {
      ...order,
      stage: stage as MachineWorkOrder['stage'],
      status: stage === 'COMPLETED' ? 'COMPLETED' : 'OPEN',
    };
  });
}

export function useWorkboardData({ activeFitter }: UseWorkboardDataOptions) {
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [workOrders, setWorkOrders] = useState<MachineWorkOrder[]>([]);
  const [defects, setDefects] = useState<DefectItem[]>([]);
  const [notes, setNotes] = useState<HistoryNote[]>([]);
  const [activeShift, setActiveShift] = useState<ShiftRecord | null>(null);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [onShiftCrewIds, setOnShiftCrewIds] = useState<Set<string>>(new Set());
  const [handoverLog, setHandoverLog] = useState<HandoverLogEntry[]>([]);
  const [authorisations, setAuthorisations] = useState<Authorisation[]>([]);
  const [holdings, setHoldings] = useState<CrewAuthorisation[]>([]);
  const [passouts, setPassouts] = useState<OperatorPassout[]>([]);
  const [machineOperators, setMachineOperators] = useState<ShiftMachineOperator[]>([]);
  const [supervision, setSupervision] = useState<CrewSupervision[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingStages, setPendingStages] = useState(0);
  const [queuedWorkOrderIds, setQueuedWorkOrderIds] = useState<string[]>([]);

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
      .select('*, parts:work_order_parts(*), crew:work_order_assignments(crew_member_id)')
      .order('created_at', { ascending: true });

    if (data) setWorkOrders(withQueuedStages(data as MachineWorkOrder[]));
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

  const fetchCrew = useCallback(async () => {
    const [{ data: members }, { data: onShift }] = await Promise.all([
      supabase.from('crew_members').select('*').order('display_name', { ascending: true }),
      supabase
        .from('shift_crew')
        .select('crew_member_id, shift_records!inner(status)')
        .eq('shift_records.status', 'ACTIVE'),
    ]);

    if (members) setCrew(members as CrewMember[]);
    if (onShift) setOnShiftCrewIds(new Set(onShift.map((r) => r.crew_member_id as string)));
  }, [supabase]);

  const fetchHandoverLog = useCallback(async () => {
    const { data, error } = await supabase
      .from('handover_log_entries')
      .select('id, category, fleet_id, details, action_required, logged_at, shift_records!inner(status)')
      .eq('shift_records.status', 'ACTIVE')
      .order('logged_at', { ascending: true });

    if (error) {
      console.error('Handover log load failed:', error.message);
      return;
    }

    setHandoverLog(
      (data ?? []).map((row) => ({
        id: row.id,
        category: row.category as HandoverLogEntry['category'],
        fleet_id: row.fleet_id ?? undefined,
        details: row.details,
        action_required: row.action_required ?? undefined,
        logged_at: row.logged_at,
      }))
    );
  }, [supabase]);

  const fetchAuthorisations = useCallback(async () => {
    const [{ data: auths, error: authError }, { data: held, error: heldError }] = await Promise.all([
      supabase.from('authorisations').select('id, name, sort_order, kind').order('sort_order'),
      supabase.from('crew_authorisations').select('id, crew_member_id, authorisation_id, expires_on'),
    ]);
    if (authError || heldError) return;
    setAuthorisations((auths ?? []) as Authorisation[]);
    setHoldings((held ?? []) as CrewAuthorisation[]);
  }, [supabase]);

  const fetchSupervision = useCallback(async () => {
    const { data, error } = await supabase.from('crew_supervision').select('crew_member_id, level, skill, assessor_id');
    if (error) return;
    setSupervision((data ?? []) as CrewSupervision[]);
  }, [supabase]);

  const fetchProduction = useCallback(async () => {
    const [{ data: passes, error: passError }, { data: assigned, error: assignedError }] = await Promise.all([
      supabase.from('operator_passouts').select('id, crew_member_id, asset_id, expires_on'),
      supabase.from('shift_machine_operators').select('id, shift_id, asset_id, crew_member_id'),
    ]);
    if (passError || assignedError) return;
    setPassouts((passes ?? []) as OperatorPassout[]);
    setMachineOperators((assigned ?? []) as ShiftMachineOperator[]);
  }, [supabase]);

  const fetchAllData = useCallback(async () => {
    await Promise.all([
      fetchShift(),
      fetchFleet(),
      fetchWorkOrders(),
      fetchDefects(),
      fetchNotes(),
      fetchCrew(),
      fetchHandoverLog(),
      fetchAuthorisations(),
      fetchProduction(),
      fetchSupervision(),
    ]);
    setLoading(false);
  }, [fetchShift, fetchFleet, fetchWorkOrders, fetchDefects, fetchNotes, fetchCrew, fetchHandoverLog, fetchAuthorisations, fetchProduction, fetchSupervision]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    const refreshCount = () => {
      const pending = readStageQueue();
      setPendingStages(pending.length);
      setQueuedWorkOrderIds(pending.map((item) => item.woId));
      setWorkOrders((current) => withQueuedStages(current));
    };
    refreshCount();
    window.addEventListener('stage-queue-changed', refreshCount);
    return () => window.removeEventListener('stage-queue-changed', refreshCount);
  }, []);

  useEffect(() => {
    let stopped = false;
    async function flush() {
      if (!beginStageFlush()) return;
      const pending = readStageQueue();
      try {
        for (const item of pending) {
          if (stopped) return;
          const woUpdate = item.newStage === 'COMPLETED'
            ? { stage: 'COMPLETED', status: 'COMPLETED', completed_at: item.at, completed_by: item.fitter }
            : { stage: item.newStage, status: 'OPEN', completed_at: null, completed_by: null };
          const { error } = await supabase.from('machine_work_orders').update(woUpdate).eq('id', item.woId);
          if (error && isNetworkError(error)) return;
          dropQueuedStage(item.woId);
          if (!error) {
            const note = item.newStage === 'COMPLETED'
              ? 'Work order completed and signed off.'
              : `Work order updated to ${item.newStage.replace(/_/g, ' ')}.`;
            await logAssetHistory(supabase, item.assetId, item.fitter, note, item.newStage);
          }
        }
        if (!stopped && readStageQueue().length === 0 && pending.length > 0) await fetchWorkOrders();
      } finally {
        endStageFlush();
      }
    }
    const first = setTimeout(() => { void flush(); }, 0);
    window.addEventListener('online', flush);
    return () => {
      stopped = true;
      clearTimeout(first);
      window.removeEventListener('online', flush);
    };
  }, [supabase, fetchWorkOrders]);

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

  const completedJobs = useMemo(() => {
    const shiftStarted = activeShift?.started_at ? new Date(activeShift.started_at).getTime() : null;
    if (shiftStarted === null) return [];
    return allAssets.filter((asset) => {
      if (asset.in_shift || asset.status !== 'OPERATIONAL' || !asset.actual_up) return false;
      return new Date(asset.actual_up).getTime() >= shiftStarted;
    });
  }, [allAssets, activeShift]);
  const unassignedMachines = allAssets.filter((a) => !a.in_shift);

  return {
    allAssets,
    workOrders,
    defects,
    notes,
    activeShift,
    crew,
    onShiftCrewIds,
    handoverLog,
    authorisations,
    holdings,
    passouts,
    machineOperators,
    supervision,
    loading,
    pendingStages,
    queuedWorkOrderIds,
    syncStatus,
    shiftJobs,
    completedJobs,
    unassignedMachines,
    fetchAllData,
    ...actions,
  };
}