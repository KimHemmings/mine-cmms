import { useState, useMemo } from 'react';
import { Asset, DefectItem, HistoryNote } from '@/types';
import { FleetDossierHeader } from './fleet-directory/FleetDossierHeader';
import { FleetDossierGroup } from './fleet-directory/FleetDossierGroup';
import { RepeatScan } from './fleet-directory/RepeatFailureCallout';

interface FleetDossierTabProps {
  assets: Asset[];
  defects?: DefectItem[];
  notes?: HistoryNote[];
  openHistory: (asset: Asset) => void;
  onAssignJob?: (asset: Asset) => void;
}

export default function FleetDossierTab({
  assets,
  defects = [],
  notes = [],
  openHistory,
  onAssignJob,
}: FleetDossierTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPERATIONAL' | 'DOWN'>('ALL');
  const [selectedOwner, setSelectedOwner] = useState('ALL');
  const [expandedMachineIds, setExpandedMachineIds] = useState<Set<string>>(() => new Set());
  const [repeatCache, setRepeatCache] = useState<Record<string, RepeatScan>>({});
  const [openRepeatId, setOpenRepeatId] = useState<string | null>(null);
  const [scanningRepeatId, setScanningRepeatId] = useState<string | null>(null);

  async function scanRepeats(asset: Asset, force = false) {
    setOpenRepeatId(asset.id);
    if (!force && repeatCache[asset.id] && !repeatCache[asset.id].error) return;
    setScanningRepeatId(asset.id);
    try {
      const response = await fetch('/api/ai-repeat-failures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineId: asset.id,
          fleetId: asset.fleet_id,
          makeModel: asset.make_model,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setRepeatCache((current) => ({
          ...current,
          [asset.id]: { error: 'Could not scan that history.' },
        }));
        return;
      }
      setRepeatCache((current) => ({
        ...current,
        [asset.id]: {
          insufficientData: Boolean(data.insufficientData),
          message: typeof data.message === 'string' ? data.message : undefined,
          bullets: Array.isArray(data.bullets) ? data.bullets.filter((line: unknown) => typeof line === 'string') : [],
        },
      }));
    } catch {
      setRepeatCache((current) => ({
        ...current,
        [asset.id]: { error: 'Could not scan that history.' },
      }));
    } finally {
      setScanningRepeatId(null);
    }
  }

  const owners = useMemo(() => {
  const uniqueOwners = new Set<string>();
  assets.forEach((asset) => {
    if (asset.machine_owner) {
      uniqueOwners.add(asset.machine_owner);
    }
  });
  return Array.from(uniqueOwners).sort();
}, [assets]);

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const term = search.toLowerCase().trim();
      const matchesSearch =
        !term ||
        asset.fleet_id.toLowerCase().includes(term) ||
        asset.make_model.toLowerCase().includes(term) ||
        (asset.asset_type && asset.asset_type.toLowerCase().includes(term)) ||
        (asset.serial_number && asset.serial_number.toLowerCase().includes(term)) ||
        (asset.location && asset.location.toLowerCase().includes(term));

      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'DOWN'
          ? asset.status !== 'OPERATIONAL'
          : asset.status === 'OPERATIONAL';

      const matchesOwner =
        selectedOwner === 'ALL' || asset.machine_owner === selectedOwner;

      return matchesSearch && matchesStatus && matchesOwner;
    });
  }, [assets, search, statusFilter, selectedOwner]);

  const groupedAssets = useMemo(() => {
    const groups: Record<string, Asset[]> = {};
    filteredAssets.forEach((asset) => {
      const groupKey = asset.asset_type?.trim() || 'General Fleet';
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(asset);
    });
    return groups;
  }, [filteredAssets]);

  const counts = useMemo(() => {
    const down = assets.filter((a) => a.status !== 'OPERATIONAL').length;
    return { all: assets.length, down, running: assets.length - down };
  }, [assets]);

  const openDefectCounts = useMemo(() => {
    const map = new Map<string, number>();
    defects.forEach((defect) => {
      if (defect.status !== 'OPEN') return;
      map.set(defect.asset_id, (map.get(defect.asset_id) ?? 0) + 1);
    });
    return map;
  }, [defects]);

  const recordCounts = useMemo(() => {
    const map = new Map<string, number>();
    notes.forEach((note) => {
      map.set(note.asset_id, (map.get(note.asset_id) ?? 0) + 1);
    });
    return map;
  }, [notes]);

  const allVisibleOpen = filteredAssets.length > 0 && filteredAssets.every((asset) => expandedMachineIds.has(asset.id));
  const allClosed = expandedMachineIds.size === 0;

  function toggleMachine(id: string) {
    setExpandedMachineIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandVisible() {
    setExpandedMachineIds((current) => {
      const next = new Set(current);
      filteredAssets.forEach((asset) => next.add(asset.id));
      return next;
    });
  }

  return (
    <div className="w-full">
      <FleetDossierHeader
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        selectedOwner={selectedOwner}
        onOwnerChange={setSelectedOwner}
        owners={owners}
        counts={counts}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-sm font-bold text-slate-600">
        <span>
          {filteredAssets.length === assets.length
            ? `Fleet directory (${filteredAssets.length})`
            : `Showing ${filteredAssets.length} of ${assets.length} machines`}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={expandVisible}
            disabled={filteredAssets.length === 0 || allVisibleOpen}
            className="min-h-10 px-3 rounded-lg border border-slate-300 bg-white text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={() => setExpandedMachineIds(new Set())}
            disabled={allClosed}
            className="min-h-10 px-3 rounded-lg border border-slate-300 bg-white text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Collapse all
          </button>
        </span>
      </div>

      {filteredAssets.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200">
          <p className="text-base font-bold text-slate-800">No matching machines found</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your search query or owner filter.</p>
        </div>
      ) : (
        Object.keys(groupedAssets)
          .sort()
          .map((category) => (
            <FleetDossierGroup
              key={category}
              categoryTitle={category}
              assets={groupedAssets[category]}
              openHistory={openHistory}
              onAssignJob={onAssignJob}
              repeatCache={repeatCache}
              openRepeatId={openRepeatId}
              scanningRepeatId={scanningRepeatId}
              onSpotRepeats={(asset) => void scanRepeats(asset)}
              onHideRepeats={() => setOpenRepeatId(null)}
              onRefreshRepeats={(asset) => void scanRepeats(asset, true)}
              expandedMachineIds={expandedMachineIds}
              onToggleMachine={toggleMachine}
              openDefectCounts={openDefectCounts}
              recordCounts={recordCounts}
            />
          ))
      )}
    </div>
  );
}