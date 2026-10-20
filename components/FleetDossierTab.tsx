import { useState, useMemo } from 'react';
import { Asset } from '@/types';
import { FleetDossierHeader } from './fleet-directory/FleetDossierHeader';
import { FleetDossierGroup } from './fleet-directory/FleetDossierGroup';

interface FleetDossierTabProps {
  assets: Asset[];
  openHistory: (asset: Asset) => void;
  onAssignJob?: (asset: Asset) => void;
}

export default function FleetDossierTab({
  assets,
  openHistory,
  onAssignJob,
}: FleetDossierTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPERATIONAL' | 'DOWN'>('ALL');
  const [selectedOwner, setSelectedOwner] = useState('ALL');

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
            />
          ))
      )}
    </div>
  );
}