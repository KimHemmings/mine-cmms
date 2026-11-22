import React from 'react';
import { Asset } from '@/types';
import { Wrench, History, MapPin, Hash, User, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import RepeatFailureCallout, { RepeatScan } from './RepeatFailureCallout';

interface FleetDossierCardProps {
  asset: Asset;
  expanded: boolean;
  onToggle: () => void;
  openDefectCount: number;
  recordCount: number;
  openHistory: (asset: Asset) => void;
  onAssignJob?: (asset: Asset) => void;
  repeatResult?: RepeatScan | null;
  scanningRepeats?: boolean;
  onSpotRepeats: (asset: Asset) => void;
  onHideRepeats: () => void;
  onRefreshRepeats: (asset: Asset) => void;
}

export const FleetDossierCard: React.FC<FleetDossierCardProps> = ({
  asset,
  expanded,
  onToggle,
  openDefectCount,
  recordCount,
  openHistory,
  onAssignJob,
  repeatResult = null,
  scanningRepeats = false,
  onSpotRepeats,
  onHideRepeats,
  onRefreshRepeats,
}) => {
  const isDown = asset.status !== 'OPERATIONAL';
  const place = asset.location?.trim();
  const statusLabel = isDown
    ? `DOWN${asset.priority ? ` • ${asset.priority}` : ''}${place ? ` • ${place}` : ''}`
    : place
    ? `RUNNING • ${place}`
    : 'RUNNING';

  return (
    <div className={isDown ? 'bg-rose-50/40' : 'bg-white'}>
      <div className={`flex items-center gap-2 px-3 py-2 ${isDown ? 'hover:bg-rose-100/60' : 'hover:bg-slate-50'}`}>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onClick={onToggle}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onToggle();
            }
          }}
          className="min-w-0 flex-1 min-h-12 flex items-center gap-3 overflow-x-auto text-left cursor-pointer"
        >
          <span className="shrink-0 text-sm text-slate-800">
            <strong className="text-base font-black text-slate-900">{asset.fleet_id}</strong>
            <span className="text-slate-400"> • </span>
            <span className="font-bold text-slate-600">{asset.make_model}</span>
          </span>
          <span
            className={
              'shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-black uppercase ' +
              (isDown
                ? 'bg-rose-600 text-white'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-300')
            }
          >
            {statusLabel}
          </span>
          {openDefectCount > 0 && (
            <span className="shrink-0 px-1.5 py-0.5 rounded bg-rose-100 text-[11px] font-black text-rose-800">
              {openDefectCount} {openDefectCount === 1 ? 'defect' : 'defects'}
            </span>
          )}
          {recordCount > 0 && (
            <span className="shrink-0 px-1.5 py-0.5 rounded bg-slate-200 text-[11px] font-black text-slate-800">
              {recordCount} {recordCount === 1 ? 'record' : 'records'}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 shrink-0 ml-auto text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 shrink-0 ml-auto text-slate-500" />
          )}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSpotRepeats(asset);
          }}
          disabled={scanningRepeats}
          className="shrink-0 min-h-10 px-3 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 text-white text-xs font-bold disabled:opacity-70"
        >
          <AlertTriangle className="w-4 h-4" />
          {scanningRepeats ? 'Scanning 12-Mo History...' : 'Spot Repeat Failures'}
        </button>
      </div>

      {repeatResult && (
        <div className="px-3 pb-3" onClick={(event) => event.stopPropagation()}>
          <RepeatFailureCallout
            result={repeatResult}
            refreshing={scanningRepeats}
            onHide={onHideRepeats}
            onRefresh={() => onRefreshRepeats(asset)}
          />
        </div>
      )}

      {expanded && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 py-2.5 border-t border-slate-200/80 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-medium text-slate-500">
                <User className="w-3.5 h-3.5 text-slate-400" /> Owner
              </span>
              <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {asset.machine_owner || 'Unassigned'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-medium text-slate-500">
                <Hash className="w-3.5 h-3.5 text-slate-400" /> S/N
              </span>
              <span className="font-mono font-bold text-slate-800">{asset.serial_number || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-medium text-slate-500">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> Location
              </span>
              <span className="font-medium text-slate-700 truncate">{asset.location || 'No location set'}</span>
            </div>
          </div>

          <div className="mt-3">
            {isDown ? (
              <button
                type="button"
                onClick={() => openHistory(asset)}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold uppercase tracking-wider transition-colors border border-slate-300 cursor-pointer"
              >
                <History className="w-4 h-4 text-slate-600" />
                <span>Inspect History / Notes</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openHistory(asset)}
                  className="h-11 px-3.5 flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider transition-colors border border-slate-300 cursor-pointer"
                  title="Inspect History / Notes"
                >
                  <History className="w-4 h-4 text-slate-600" />
                  <span>History</span>
                </button>
                <button
                  type="button"
                  onClick={() => onAssignJob?.(asset)}
                  className="flex-1 h-11 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-xs cursor-pointer"
                >
                  <Wrench className="w-4 h-4" />
                  <span>+ Assign</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
