'use client';

import { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, CheckCircle, Search, X } from 'lucide-react';
import { Asset, CrewMember, MachineWorkOrder, HistoryNote } from '@/types';
import MachineWorkboardCard from '@/components/MachineWorkboardCard';

interface WorkboardTabProps {
  shiftJobs: Asset[];
  workOrders: MachineWorkOrder[];
  notes: HistoryNote[];
  loading: boolean;
  activeFitter: string;
  myName: string;
  updateWorkOrderStage: (woId: string, assetId: string, newStage: string, jobLabel?: string) => void;
  openAddWorkOrder: (asset: Asset) => void;
  openHistory: (asset: Asset) => void;
  openDefects: (asset: Asset) => void;
  openQuickEdit: (asset: Asset) => void;
  myCrewMemberId?: string | null;
  crew?: CrewMember[];
  onLinkCrew?: (crewMemberId: string) => Promise<void>;
  openPartsModal?: (wo: MachineWorkOrder) => void;
  openCrewPicker?: (wo: MachineWorkOrder) => void;
  releaseMachineToProduction: (assetId: string, fleetId?: string) => void;
  onRefresh: () => void;
  queuedWorkOrderIds?: string[];
}

type QuickFilter = 'all' | 'mine' | 'overdue' | 'parts' | 'ready';
type SortMode = 'urgent' | 'longest' | 'fleet';

const STORAGE_KEY = 'mine_cmms_expanded_cards';
const PRIORITY_RANK: Record<string, number> = { P1: 1, P2: 2, P3: 3, P4: 4 };

const isReleasedAsset = (a: Asset) => a.status === 'OPERATIONAL' && !a.in_shift;
const isOverdue = (a: Asset, now: number) => !!a.expected_up && new Date(a.expected_up).getTime() < now;
const timeOf = (iso: string | null) => (iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY);

export default function WorkboardTab({
  shiftJobs,
  workOrders,
  notes,
  loading,
  activeFitter,
  myName,
  updateWorkOrderStage,
  openAddWorkOrder,
  openHistory,
  openDefects,
  openQuickEdit,
  myCrewMemberId,
  crew = [],
  onLinkCrew,
  openPartsModal,
  openCrewPicker,
  releaseMachineToProduction,
  onRefresh,
  queuedWorkOrderIds = [],
}: WorkboardTabProps) {
  const [expandedAssetIds, setExpandedAssetIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) return new Set(JSON.parse(saved));
      } catch {}
    }
    return new Set();
  });
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('urgent');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(expandedAssetIds)));
    } catch {}
  }, [expandedAssetIds]);

  const toggleExpand = (assetId: string) => {
    setExpandedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  const ordersByAsset = useMemo(() => {
    const map = new Map<string, MachineWorkOrder[]>();
    for (const wo of workOrders) {
      const list = map.get(wo.asset_id);
      if (list) list.push(wo);
      else map.set(wo.asset_id, [wo]);
    }
    return map;
  }, [workOrders]);

  const { activeFleet, releasedFleet, counts } = useMemo(() => {
    const me = myName.trim().toLowerCase();
    const term = search.trim().toLowerCase();

    const openOrdersOf = (a: Asset) => (ordersByAsset.get(a.id) ?? []).filter((w) => w.status === 'OPEN');
    const matchers: Record<Exclude<QuickFilter, 'all'>, (a: Asset) => boolean> = {
      mine: (a) => {
        const person = crew.find((member) => member.id === myCrewMemberId);
        const name = (person?.display_name || me).toLowerCase();
        return (ordersByAsset.get(a.id) ?? []).some((order) => {
          if (myCrewMemberId && order.crew?.some((row) => row.crew_member_id === myCrewMemberId)) return true;
          return !!name && (order.fitter_assigned || '').toLowerCase().includes(name);
        });
      },
      overdue: (a) => isOverdue(a, now),
      parts: (a) => openOrdersOf(a).some((w) => w.stage === 'WAITING_PARTS'),
      ready: (a) => openOrdersOf(a).length === 0,
    };

    const matchesSearch = (a: Asset) => {
      if (!term) return true;
      const fields = [a.fleet_id, a.make_model, a.location, a.machine_owner];
      for (const w of ordersByAsset.get(a.id) ?? []) {
        fields.push(w.wo_number, w.task_description, w.fitter_assigned);
      }
      return fields.some((f) => f?.toLowerCase().includes(term));
    };

    const compare = (a: Asset, b: Asset) => {
      if (sortMode === 'fleet') return a.fleet_id.localeCompare(b.fleet_id, undefined, { numeric: true });
      if (sortMode === 'longest') return timeOf(a.down_since) - timeOf(b.down_since);

      const aOver = isOverdue(a, now);
      const bOver = isOverdue(b, now);
      if (aOver !== bOver) return aOver ? -1 : 1;
      const pa = PRIORITY_RANK[a.priority ?? ''] ?? 5;
      const pb = PRIORITY_RANK[b.priority ?? ''] ?? 5;
      if (pa !== pb) return pa - pb;
      if (aOver && bOver) return timeOf(a.expected_up) - timeOf(b.expected_up);
      return timeOf(a.down_since) - timeOf(b.down_since);
    };

    const searched = shiftJobs.filter(matchesSearch);
    const active = searched.filter((a) => !isReleasedAsset(a));

    return {
      activeFleet: (quickFilter === 'all' ? active : active.filter(matchers[quickFilter])).sort(compare),
      releasedFleet: quickFilter === 'all' ? searched.filter(isReleasedAsset) : [],
      counts: {
        all: active.length,
        mine: active.filter(matchers.mine).length,
        overdue: active.filter(matchers.overdue).length,
        parts: active.filter(matchers.parts).length,
        ready: active.filter(matchers.ready).length,
      } satisfies Record<QuickFilter, number>,
    };
  }, [shiftJobs, ordersByAsset, search, quickFilter, sortMode, myName, now, crew, myCrewMemberId]);

  if (loading && shiftJobs.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-500 border-t-transparent mb-3" />
        <p className="text-slate-600 text-base font-semibold">Loading the workboard...</p>
      </div>
    );
  }

  if (shiftJobs.length === 0) {
    return (
      <div className="p-12 text-center bg-white border border-slate-300 rounded-2xl max-w-xl mx-auto mt-8 shadow-md">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900">No machines on the board</h2>
        <p className="text-sm text-slate-500 mt-1">Every machine is running. Use Assign Machine to log a new job.</p>
      </div>
    );
  }

  const filterChips: { id: QuickFilter; label: string }[] = [
    { id: 'all', label: 'All machines' },
    { id: 'mine', label: 'My jobs' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'parts', label: 'Waiting on parts' },
    { id: 'ready', label: 'Ready to release' },
  ];

  const isFiltering = quickFilter !== 'all' || search.trim() !== '';

  const renderCard = (asset: Asset) => (
    <MachineWorkboardCard
      key={asset.id}
      asset={asset}
      workOrders={workOrders}
      notes={notes}
      activeFitter={activeFitter}
      isDetailsExpanded={expandedAssetIds.has(asset.id)}
      toggleExpandDetails={() => toggleExpand(asset.id)}
      updateWorkOrderStage={updateWorkOrderStage}
      openAddWorkOrder={openAddWorkOrder}
      openHistory={openHistory}
      openDefects={openDefects}
      openQuickEdit={openQuickEdit}
      openPartsModal={openPartsModal}
      openCrewPicker={openCrewPicker}
      releaseMachineToProduction={releaseMachineToProduction}
      onRefresh={onRefresh}
      heldOnTablet={workOrders.some((order) => order.asset_id === asset.id && queuedWorkOrderIds.includes(order.id))}
    />
  );

  return (
    <div className="space-y-6 font-sans">
      {onLinkCrew && !myCrewMemberId && (
        <label className="bg-white border border-slate-300 rounded-xl p-3 shadow-2xs flex flex-col sm:flex-row sm:items-center gap-2 text-sm font-bold text-slate-700">
          I am
          <select
            value=""
            onChange={(event) => {
              if (event.target.value) void onLinkCrew(event.target.value);
            }}
            className="min-h-12 rounded-lg border-2 border-slate-300 bg-white px-3 text-base font-bold text-slate-900 cursor-pointer"
          >
            <option value="">Choose your name so My jobs is your work</option>
            {crew
              .filter((member) => member.active && member.department !== 'Production' && member.trade !== 'Operator')
              .map((member) => (
                <option key={member.id} value={member.id}>
                  {member.display_name}{member.panel ? ` · ${member.panel}` : ''}
                </option>
              ))}
          </select>
        </label>
      )}
      <div className="bg-white border border-slate-300 rounded-xl p-3 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <label className="relative flex-1">
            <span className="sr-only">Search the board</span>
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search fleet number, fitter, WO number or job..."
              className="w-full min-h-12 pl-11 pr-11 rounded-lg border-2 border-slate-300 bg-slate-50 text-base text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-500 hover:bg-slate-200"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </label>

          <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
            Sort
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="min-h-12 rounded-lg border-2 border-slate-300 bg-white px-3 text-base font-bold text-slate-900 cursor-pointer"
            >
              <option value="urgent">Most urgent first</option>
              <option value="longest">Down the longest</option>
              <option value="fleet">Fleet number</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick filters">
          {filterChips.map((chip) => {
            const active = quickFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setQuickFilter(chip.id)}
                aria-pressed={active}
                className={`min-h-11 px-4 rounded-full border-2 text-sm font-bold transition ${
                  active
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-300 text-slate-700 hover:border-slate-500'
                }`}
              >
                {chip.label}
                <span className={`ml-2 px-1.5 rounded ${active ? 'bg-white/20' : 'bg-slate-100'}`}>{counts[chip.id]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-slate-600">
          <span>
            {isFiltering
              ? `Showing ${activeFleet.length} of ${counts.all} machines being worked on`
              : `Machines being worked on (${activeFleet.length})`}
          </span>
          {isFiltering && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setQuickFilter('all');
              }}
              className="min-h-10 px-3 rounded-lg text-slate-700 underline hover:bg-slate-300/50"
            >
              Clear search and filters
            </button>
          )}
        </div>

        {activeFleet.length === 0 ? (
          <div
            className={`p-6 rounded-xl text-center text-base font-bold border ${
              isFiltering ? 'bg-white border-slate-300 text-slate-600' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {isFiltering ? 'No machines match. Try a different search or filter.' : 'All machines have been released to production!'}
          </div>
        ) : (
          activeFleet.map(renderCard)
        )}
      </div>

      {releasedFleet.length > 0 && (
        <div className="pt-6 space-y-4 border-t-2 border-dashed border-slate-300">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span>Released to production this shift ({releasedFleet.length})</span>
          </div>
          <div className="space-y-4">{releasedFleet.map(renderCard)}</div>
        </div>
      )}
    </div>
  );
}
