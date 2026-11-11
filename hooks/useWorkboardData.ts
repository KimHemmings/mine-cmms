// hooks/useWorkboardData.ts - Exactly 116 lines
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Asset, Authorisation, CrewAuthorisation, MachineWorkOrder, DefectItem, HistoryNote, ShiftRecord, CrewMember, HandoverLogEntry } from '@/types';
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
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [onShiftCrewIds, setOnShiftCrewIds] = useState<Set<string>>(new Set());
  const [handoverLog, setHandoverLog] = useState<HandoverLogEntry[]>([]);
  const [authorisations, setAuthorisations] = useState<Authorisation[]>([]);
  const [holdings, setHoldings] = useState<CrewAuthorisation[]>([]);
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
      .select('*, parts:work_order_parts(*), crew:work_order_assignments(crew_member_id)')
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
    ]);
    setLoading(false);
  }, [fetchShift, fetchFleet, fetchWorkOrders, fetchDefects, fetchNotes, fetchCrew, fetchHandoverLog, fetchAuthorisations]);

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
    loading,
    syncStatus,
    shiftJobs,
    completedJobs,
    unassignedMachines,
    fetchAllData,
    ...actions,
  };
}