import React from 'react';
import { Asset } from '@/types';
import { Wrench, History, MapPin, Hash, User } from 'lucide-react';

interface FleetDossierCardProps {
  asset: Asset;
  openHistory: (asset: Asset) => void;
  onAssignJob?: (asset: Asset) => void;
}

export const FleetDossierCard: React.FC<FleetDossierCardProps> = ({
  asset,
  openHistory,
  onAssignJob,
}) => {
  const isDown = asset.status !== 'OPERATIONAL';
  const priorityText = asset.priority ? ' • ' + asset.priority : '';

  return (
    <div
      onClick={() => openHistory(asset)}
      className={
        'flex flex-col justify-between rounded-xl border-2 p-4 transition-all shadow-xs cursor-pointer select-none ' +
        (isDown
          ? 'bg-rose-50/40 border-rose-300 hover:border-rose-400'
          : 'bg-white border-slate-200 hover:border-slate-300')
      }
    >
      <div>
        {/* Header: Fleet ID & Status */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-2xl font-black tracking-tight text-slate-900">
            {asset.fleet_id}
          </span>
          <span
            className={
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ' +
              (isDown
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-300')
            }
          >
            <span
              className={
                'w-2 h-2 rounded-full ' +
                (isDown ? 'bg-white animate-pulse' : 'bg-emerald-600')
              }
            />
            {isDown ? 'DOWN' + priorityText : 'RUNNING'}
          </span>
        </div>

        {/* Make, Model & Type */}
        <p className="text-sm font-bold text-slate-800 leading-snug">{asset.make_model}</p>
        <p className="text-xs text-slate-500 mb-3 font-medium">{asset.asset_type}</p>

        {/* Operational Metadata */}
        <div className="grid grid-cols-1 gap-1.5 py-2.5 border-t border-b border-slate-200/80 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium text-slate-500">
              <User className="w-3.5 h-3.5 text-slate-400" /> Owner
            </span>
            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {asset.machine_owner || 'Unassigned'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium text-slate-500">
              <Hash className="w-3.5 h-3.5 text-slate-400" /> S/N
            </span>
            <span className="font-mono font-bold text-slate-800">
              {asset.serial_number || 'N/A'}
            </span>
          </div>

          {isDown && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium text-slate-500">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> Workshop Location
              </span>
              <span className="font-medium text-slate-700 truncate max-w-42.5">
                {asset.location || 'Workshop Yard'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="mt-3.5">
        {isDown ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openHistory(asset);
            }}
            className="w-full h-11 flex items-center justify-center gap-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold uppercase tracking-wider transition-colors border border-slate-300 cursor-pointer"
          >
            <History className="w-4 h-4 text-slate-600" />
            <span>Inspect History / Notes</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openHistory(asset);
              }}
              className="h-11 px-3.5 flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider transition-colors border border-slate-300 cursor-pointer"
              title="Inspect History / Notes"
            >
              <History className="w-4 h-4 text-slate-600" />
              <span>History</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAssignJob?.(asset);
              }}
              className="flex-1 h-11 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-xs cursor-pointer"
            >
              <Wrench className="w-4 h-4" />
              <span>+ Assign</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};