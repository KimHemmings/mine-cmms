import { CheckCircle2, Clock, User, History, FileText, AlertTriangle } from 'lucide-react';
import { Asset, STAGES, DefectItem } from '@/types';
import { formatDateTime, getElapsedDown, getEtuStatus } from '@/utils/helpers';

interface WorkboardTabProps {
  shiftJobs: Asset[];
  defects: DefectItem[];
  loading: boolean;
  updateStage: (id: string, newStage: string) => void;
  openHistory: (asset: Asset) => void;
  openDefects: (asset: Asset) => void;
  completeShiftJob: (id: string) => void;
}

export default function WorkboardTab({
  shiftJobs,
  defects,
  loading,
  updateStage,
  openHistory,
  openDefects,
  completeShiftJob
}: WorkboardTabProps) {
  if (loading) return <p className="text-slate-400 text-sm py-12 text-center">Loading shift workboard...</p>;

  if (shiftJobs.length === 0) {
    return (
      <div className="p-12 text-center bg-slate-800/60 border border-slate-700 rounded-2xl max-w-xl mx-auto mt-8 shadow-md">
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-100">No Open Work on this Shift</h2>
        <p className="text-xs text-slate-400 mt-1">All fleet units operational or ready for deployment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {shiftJobs.map((asset) => {
        const isP1 = asset.priority === 'P1';
        const isP2 = asset.priority === 'P2';
        const etu = getEtuStatus(asset.expected_up);

        // Fetch defects tied to this machine
        const machineDefects = defects.filter((d) => d.asset_id === asset.id);
        const openDefectsCount = machineDefects.filter((d) => d.status === 'OPEN').length;

        // Multi-component systems array
        const systems = asset.component_systems && asset.component_systems.length > 0
          ? asset.component_systems
          : asset.component_system ? [asset.component_system] : ['General'];

        return (
          <div
            key={asset.id}
            className={`p-5 rounded-2xl border transition shadow-md ${
              isP1
                ? 'bg-rose-950/30 border-rose-600/80'
                : isP2
                ? 'bg-slate-800/90 border-amber-600/60'
                : 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
              {/* Machine ID, Priority, Multi-Area Systems & SAP */}
              <div className="flex items-start gap-4 min-w-65">
                {asset.priority ? (
                  <span
                    className={`text-xs font-black px-3 py-1.5 rounded-lg border uppercase tracking-wider shrink-0 ${
                      isP1
                        ? 'bg-rose-600 text-white border-rose-500'
                        : isP2
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-slate-700 text-slate-200 border-slate-600'
                    }`}
                  >
                    {asset.priority}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-700/60 text-slate-400 border border-slate-600 shrink-0">
                    ROUTINE
                  </span>
                )}

                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl font-black text-white tracking-wide">{asset.fleet_id}</span>
                    <span className="text-xs text-slate-400 font-semibold">({asset.make_model})</span>
                  </div>

                  {/* Multi-Component Area Tags */}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {systems.map((sys) => (
                      <span
                        key={sys}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-700 text-amber-300 border border-slate-600"
                      >
                        {sys}
                      </span>
                    ))}
                  </div>

                  {/* Work Order & SAP Notification Badges */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {asset.work_order_num && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-sky-300 bg-sky-950/60 border border-sky-800/80 px-2 py-0.5 rounded">
                        <FileText className="w-3 h-3 text-sky-400" />
                        {asset.work_order_num}
                      </span>
                    )}
                    {asset.sap_notification && (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                        {asset.sap_notification}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Work Scope & Fitter */}
              <div className="flex-1 min-w-55">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Work Scope</span>
                <p className="text-sm font-bold text-slate-100 mt-0.5">{asset.shift_task || 'No task logged'}</p>
                <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mt-2">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span>Fitter: <strong className="text-white">{asset.fitter_assigned || 'Unassigned'}</strong></span>
                </p>
              </div>

              {/* Down Time & Elapsed */}
              <div className="min-w-35 bg-slate-900/80 p-3 rounded-xl border border-slate-700/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-rose-400" /> Down Since
                </span>
                <div className="text-xs font-bold text-slate-200 mt-1">{formatDateTime(asset.down_since)}</div>
                <div className="text-xs font-mono font-bold text-rose-400 mt-0.5">
                  Elapsed: {getElapsedDown(asset.down_since)}
                </div>
              </div>

              {/* ETU */}
              <div className="min-w-40 bg-slate-900/80 p-3 rounded-xl border border-slate-700/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Expected Up (ETU)
                </span>
                <div className="text-xs font-bold text-slate-200 mt-1">{formatDateTime(asset.expected_up)}</div>
                {etu && (
                  <div
                    className={`text-[10px] font-bold mt-1 inline-flex items-center px-2 py-0.5 rounded border ${
                      etu.overdue
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    {etu.label}
                  </div>
                )}
              </div>

              {/* Stage Dropdown */}
              <div className="min-w-35">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Current Stage
                </span>
                <select
                  value={asset.shift_stage || 'DIAGNOSING'}
                  onChange={(e) => updateStage(asset.id, e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-amber-400 font-bold text-xs p-2.5 rounded-xl focus:outline-none focus:border-amber-500 cursor-pointer shadow-inner"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s} className="bg-slate-900 text-white">
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions: Defects, History, Actual Up */}
              <div className="flex flex-col sm:flex-row xl:flex-col gap-2 shrink-0">
                <div className="flex gap-2">
                  <button
                    onClick={() => openDefects(asset)}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      openDefectsCount > 0
                        ? 'bg-rose-950/70 text-rose-300 border-rose-600 hover:bg-rose-900'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600'
                    }`}
                    title="Manage Machine Defects"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    Defects ({openDefectsCount})
                  </button>

                  <button
                    onClick={() => openHistory(asset)}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition"
                  >
                    <History className="w-3.5 h-3.5 text-amber-400" />
                    Notes
                  </button>
                </div>

                <button
                  onClick={() => completeShiftJob(asset.id)}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black tracking-wider uppercase rounded-xl transition shadow flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Actual Up
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}