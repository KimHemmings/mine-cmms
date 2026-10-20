import React, { useState } from 'react';
import { Asset } from '@/types';
import { FleetDossierCard } from './FleetDossierCard';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FleetDossierGroupProps {
  categoryTitle: string;
  assets: Asset[];
  openHistory: (asset: Asset) => void;
  onAssignJob?: (asset: Asset) => void;
}

export const FleetDossierGroup: React.FC<FleetDossierGroupProps> = ({
  categoryTitle,
  assets,
  openHistory,
  onAssignJob,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  if (assets.length === 0) return null;

  const downCount = assets.filter((a) => a.status !== 'OPERATIONAL').length;
  const runningCount = assets.length - downCount;

  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50/70 overflow-hidden shadow-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-white border-b border-slate-200 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
            {categoryTitle}
          </h3>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {assets.length} Units
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {runningCount} Running
            </span>
            {downCount > 0 && (
              <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                {downCount} Down
              </span>
            )}
          </div>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {assets.map((asset) => (
            <FleetDossierCard
              key={asset.id}
              asset={asset}
              openHistory={openHistory}
              onAssignJob={onAssignJob}
            />
          ))}
        </div>
      )}
    </div>
  );
};