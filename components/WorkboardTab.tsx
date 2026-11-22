'use client';

import { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, CheckCircle, Clock, Search, X } from 'lucide-react';
import { Asset, CrewMember, MachineWorkOrder, HistoryNote } from '@/types';
import MachineWorkboardCard, { workOrdersForActiveCard } from '@/components/MachineWorkboardCard';
import BreakdownHistorySearch from '@/components/workboard/BreakdownHistorySearch';
import SiteDictionaryPanel from '@/components/workboard/SiteDictionaryPanel';
import { getEventConfig, workshopPriority } from '@/components/workboard/workboardTheme';
import { Permissions, isProductionDepartment, isWorkshopRoster } from '@/utils/permissions';
import { seatLabel } from '@/utils/crewAllocation';
import LocationPill, { parkUpNeedsConfirm } from '@/components/production/LocationPill';
import CircuitPill from '@/components/production/CircuitPill';
import BulkPasteModal from '@/components/BulkPasteModal';
import ServiceAlertPills from '@/components/StatutoryDueBadge';

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
  permissions: Permissions;
  historyAssets?: Asset[];
  activeShiftId?: string | null;
  onUpdateLocation?: (assetId: string, location: string) => Promise<boolean>;
  onUpdateCircuit?: (assetId: string, circuit: string) => Promise<boolean>;
}

type SortMode = 'urgent' | 'longest' | 'fleet';

const PRIORITY_RANK: Record<'P1' | 'P2' | 'P3', number> = { P1: 1, P2: 2, P3: 3 };

function newestOpenJob(orders: MachineWorkOrder[]) {
  const open = orders.filter((order) => order.status !== 'COMPLETED');
  const pool = open.length > 0 ? open : orders;
  const flagged = pool.filter((order) => order.is_main_event);
  const chosen = flagged.length > 0 ? flagged : pool;
  return [...chosen].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];
}

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
  permissions,
  historyAssets = [],
  activeShiftId = null,
  onUpdateLocation,
  onUpdateCircuit,
}: WorkboardTabProps) {
  const [expandedAssetIds, setExpandedAssetIds] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('urgent');
  const [gearFilter, setGearFilter] = useState<'all' | 'critical'>('all');
  const [fleetView, setFleetView] = useState<'all' | 'down' | 'spare'>('all');
  const [bulkImport, setBulkImport] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const productionBoard = permissions.isReadOnlyWorkshop;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

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
    for (const wo of workOrdersForActiveCard(workOrders, activeShiftId)) {
      const list = map.get(wo.asset_id);
      if (list) list.push(wo);
      else map.set(wo.asset_id, [wo]);
    }
    return map;
  }, [workOrders, activeShiftId]);

  const { activeFleet, releasedFleet, counts, mineIds } = useMemo(() => {
    const me = myName.trim().toLowerCase();
    const term = search.trim().toLowerCase();
    const person = crew.find((member) => member.id === myCrewMemberId);
    const myLabel = (person?.display_name || me).toLowerCase();

    const isMine = (asset: Asset) =>
      (ordersByAsset.get(asset.id) ?? []).some((order) => {
        if (order.status === 'COMPLETED') return false;
        if (myCrewMemberId && order.crew?.some((row) => row.crew_member_id === myCrewMemberId)) return true;
        return !!myLabel && (order.fitter_assigned || '').toLowerCase().includes(myLabel);
      });

    const isBreakdown = (asset: Asset) => {
      const main = newestOpenJob(ordersByAsset.get(asset.id) ?? []);
      return getEventConfig(main?.order_type, asset.status === 'DOWN_PLANNED').label === 'BREAKDOWN';
    };

    const matchesSearch = (a: Asset) => {
      if (!term) return true;
      const fields = [a.fleet_id, a.make_model, a.location, a.machine_owner];
      for (const w of ordersByAsset.get(a.id) ?? []) {
        fields.push(w.wo_number, w.task_description, w.fitter_assigned);
      }
      return fields.some((f) => f?.toLowerCase().includes(term));
    };

    const isCritical = (asset: Asset) => {
      if (asset.priority === 'P1') return true;
      const main = newestOpenJob(ordersByAsset.get(asset.id) ?? []);
      const label = getEventConfig(main?.order_type, asset.status === 'DOWN_PLANNED').label;
      return label === 'BREAKDOWN' || label === 'ACCIDENT DAMAGE';
    };

    const floatMyJobs = permissions.department === 'workshop' && permissions.accessLevel === 2;
    const supervisorBoard = permissions.canManageSiteDictionary;

    const compare = (a: Asset, b: Asset) => {
      if (floatMyJobs) {
        const aMine = isMine(a);
        const bMine = isMine(b);
        if (aMine !== bMine) return aMine ? -1 : 1;
        const aBreak = isBreakdown(a);
        const bBreak = isBreakdown(b);
        if (aBreak !== bBreak) return aBreak ? -1 : 1;
      } else if (supervisorBoard && sortMode === 'fleet') {
        return a.fleet_id.localeCompare(b.fleet_id, undefined, { numeric: true });
      } else if (supervisorBoard && sortMode === 'longest') {
        return timeOf(a.down_since) - timeOf(b.down_since);
      }

      const aOver = isOverdue(a, now);
      const bOver = isOverdue(b, now);
      if (supervisorBoard && aOver !== bOver) return aOver ? -1 : 1;
      const pa = PRIORITY_RANK[workshopPriority(a.priority)];
      const pb = PRIORITY_RANK[workshopPriority(b.priority)];
      if (pa !== pb) return pa - pb;
      if (supervisorBoard && aOver && bOver) return timeOf(a.expected_up) - timeOf(b.expected_up);
      return timeOf(a.down_since) - timeOf(b.down_since);
    };

    const searched = shiftJobs.filter(matchesSearch).filter((asset) => !productionBoard || gearFilter === 'all' || isCritical(asset));
    const active = searched.filter((a) => !isReleasedAsset(a));

    return {
      activeFleet: [...active].sort(compare),
      releasedFleet: searched.filter(isReleasedAsset),
      mineIds: new Set(active.filter(isMine).map((asset) => asset.id)),
      counts: { all: active.length },
    };
  }, [shiftJobs, ordersByAsset, search, sortMode, gearFilter, productionBoard, myName, now, crew, myCrewMemberId, permissions]);

  if (loading && shiftJobs.length === 0 && historyAssets.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-500 border-t-transparent mb-3" />
        <p className="text-slate-600 text-base font-semibold">Loading the workboard...</p>
      </div>
    );
  }

  if (shiftJobs.length === 0 && !productionBoard) {
    return (
      <div className="p-12 text-center bg-white border border-slate-300 rounded-2xl max-w-xl mx-auto mt-8 shadow-md">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900">No machines on the board</h2>
        <p className="text-sm text-slate-500 mt-1">{productionBoard ? 'Nothing is down in the workshop.' : 'Every machine is running. Use Create downtime event to log a new job.'}</p>
      </div>
    );
  }

  const isFiltering = search.trim() !== '';
  const downIds = new Set(shiftJobs.filter((asset) => !isReleasedAsset(asset)).map((asset) => asset.id));
  const spareTerm = search.trim().toLowerCase();
  const spareFleet = historyAssets
    .filter((asset) => !downIds.has(asset.id))
    .filter((asset) => !spareTerm || [asset.fleet_id, asset.make_model, asset.location].some((field) => field?.toLowerCase().includes(spareTerm)))
    .sort((a, b) => a.fleet_id.localeCompare(b.fleet_id, undefined, { numeric: true }));
  const showDown = !productionBoard || fleetView !== 'spare';
  const showSpare = productionBoard && fleetView !== 'down';
  const visibleIds = activeFleet.concat(releasedFleet).map((asset) => asset.id);
  const allVisibleOpen = visibleIds.length > 0 && visibleIds.every((id) => expandedAssetIds.has(id));

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
      compact
      yours={mineIds.has(asset.id)}
      copyLabel="Copy Work Order Notes"
      activeShiftId={activeShiftId}
      permissions={permissions}
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
              .filter((member) => member.active && isWorkshopRoster(member))
              .map((member) => (
                <option key={member.id} value={member.id}>
                  {member.display_name}{member.panel ? ` · ${member.panel}` : ''}
                </option>
              ))}
          </select>
        </label>
      )}
      <div className="bg-sky-100 border border-slate-300 rounded-xl p-3 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <label className="relative flex-1">
            <span className="sr-only">Search the board</span>
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={productionBoard ? 'Search fleet number, pit location or fault...' : 'Search fleet number, fitter, WO number or job...'}
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

          {productionBoard && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Fleet view">
              {([
                ['all', 'All Fleet'],
                ['down', `Down Gear (${downIds.size})`],
                ['spare', `Ready / Spare Gear (${historyAssets.filter((asset) => !downIds.has(asset.id)).length})`],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFleetView(id)}
                  aria-pressed={fleetView === id}
                  className={`min-h-10 px-3 rounded-full text-sm font-black border ${fleetView === id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {productionBoard && fleetView !== 'spare' && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Down gear filter">
              {([
                ['all', 'All Down Gear'],
                ['critical', 'Critical / Breakdowns Only'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setGearFilter(id)}
                  className={`min-h-10 px-3 rounded-full text-sm font-black border ${
                    gearFilter === id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                  aria-pressed={gearFilter === id}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {permissions.canManageFleet && (
            <button type="button" onClick={() => setBulkImport(true)} className="min-h-12 px-4 rounded-lg border-2 border-slate-300 bg-white text-sm font-black text-slate-800">
              Bulk Import (CSV / Paste)
            </button>
          )}
          {permissions.canManageSiteDictionary && (
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
          )}
        </div>

        {permissions.canManageSiteDictionary && <BreakdownHistorySearch assets={historyAssets} workOrders={workOrders} />}
        {permissions.canManageSiteDictionary && <SiteDictionaryPanel />}
      </div>

      {showDown && (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-slate-600">
          <span>
            {isFiltering || (productionBoard && gearFilter === 'critical')
              ? `Showing ${activeFleet.length} down`
              : productionBoard
                ? `Down fleet (${activeFleet.length})`
                : `Machines being worked on (${activeFleet.length})`}
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setExpandedAssetIds(new Set(visibleIds))}
              disabled={allVisibleOpen}
              className="min-h-10 px-3 rounded-lg border border-slate-300 bg-white text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={() => setExpandedAssetIds(new Set())}
              disabled={expandedAssetIds.size === 0}
              className="min-h-10 px-3 rounded-lg border border-slate-300 bg-white text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Collapse all
            </button>
            {isFiltering && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="min-h-10 px-3 rounded-lg text-slate-700 underline hover:bg-slate-300/50"
            >
              Clear search
            </button>
            )}
          </span>
        </div>

        {activeFleet.length === 0 ? (
          <div
            className={`p-6 rounded-xl text-center text-base font-bold border ${
              isFiltering ? 'bg-white border-slate-300 text-slate-600' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {isFiltering ? 'No machines match. Try a different search or filter.' : productionBoard ? 'Nothing is down in the workshop.' : 'All machines have been released to production!'}
          </div>
        ) : (
          activeFleet.map(renderCard)
        )}
      </div>
      )}

      {showSpare && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Ready / Spare fleet ({spareFleet.length})</h3>
          {spareFleet.length === 0 ? (
            <p className="p-4 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-600">No healthy machines match.</p>
          ) : (
            <ul className="divide-y divide-slate-200 rounded-xl border border-slate-300 bg-white">
              {spareFleet.map((asset) => {
                const operators = crew
                  .filter((member) => member.active && !member.away && member.allocated_machine_id === asset.id && isProductionDepartment(member.department))
                  .sort((a, b) => (a.allocated_role === 'Trainee (Buddy Seat)' ? 2 : a.allocated_role === 'Hot Seat' ? 1 : 0) - (b.allocated_role === 'Trainee (Buddy Seat)' ? 2 : b.allocated_role === 'Hot Seat' ? 1 : 0) || a.display_name.localeCompare(b.display_name));
                const manned = operators.map((member) => `${member.display_name} (${seatLabel(member.allocated_role)})`).join(', ');
                return (
                  <li key={asset.id} className="px-3 py-2 flex flex-wrap items-center gap-2">
                    <span className="text-base font-black text-slate-900">{asset.fleet_id}</span>
                    <span className="text-sm font-bold text-slate-500">{asset.make_model}</span>
                    {manned ? (
                      <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white text-[11px] font-black">MANNED · {manned}</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-black">SPARE / UNMANNED</span>
                    )}
                    {permissions.canUpdateMachineLocation && onUpdateLocation && (
                      <LocationPill location={asset.location || ''} onSave={(location) => onUpdateLocation(asset.id, location)} />
                    )}
                    {parkUpNeedsConfirm(asset.location_updated_at, now) && (
                      <span title="Verify Park-Up" className="inline-flex items-center gap-1 text-amber-700">
                        <Clock className="w-3.5 h-3.5" aria-hidden />
                        <span className="text-[10px] font-black uppercase tracking-wide">Verify Park-Up</span>
                      </span>
                    )}
                    <span className="ml-auto inline-flex"><ServiceAlertPills asset={asset} /></span>
                    {manned && permissions.canUpdateMachineLocation && onUpdateCircuit && (
                      <CircuitPill
                        circuit={asset.circuit || ''}
                        assets={historyAssets}
                        onSave={(circuit) => onUpdateCircuit(asset.id, circuit)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {!productionBoard && releasedFleet.length > 0 && (
        <div className="pt-6 space-y-4 border-t-2 border-dashed border-slate-300">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span>Released to production this shift ({releasedFleet.length})</span>
          </div>
          <div className="space-y-4">{releasedFleet.map(renderCard)}</div>
        </div>
      )}
      {bulkImport && (
        <BulkPasteModal kind="fleet" onClose={() => setBulkImport(false)} onImported={onRefresh} />
      )}
    </div>
  );
}
