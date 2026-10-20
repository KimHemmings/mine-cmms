import { CheckCircle2, Clock, MapPin, User, AlertCircle, History } from 'lucide-react';
import { Asset, STAGES } from '@/types';
import { formatDateTime, getElapsedDown, getEtuStatus } from '@/utils/helpers';

interface WorkboardTabProps {
  shiftJobs: Asset[];
  loading: boolean;
  updateStage: (id: string, newStage: string) => void;
  openHistory: (asset: Asset) => void;
  completeShiftJob: (id: string) => void;
}

export default function WorkboardTab({ shiftJobs, loading, updateStage, openHistory, completeShiftJob }: WorkboardTabProps) {
  if (loading) return <p className="text-slate-400 text-sm py-8 text-center">Loading shift jobs...</p>;

  if (shiftJobs.length === 0) {
    return (
      <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl max-w-xl mx-auto mt-8">
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white">No Open Work on this Shift</h2>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {shiftJobs.map((asset) => {
        const isP1 = asset.priority === 'P1';
        const etu = getEtuStatus(asset.expected_up);

        return (
          <div key={asset.id} className={`p-5 rounded-2xl border flex flex-col xl:flex-row xl:items-center justify-between gap-5 transition ${isP1 ? 'bg-rose-950/20 border-rose-800/80 shadow-lg' : 'bg-slate-900/60 border-slate-800'}`}>
            <div className="flex items-start gap-3.5 min-w-52.5">
              {asset.priority && (
                <span className={`text-xs font-black px-2.5 py-1.5 rounded-lg border uppercase tracking-wider ${isP1 ? 'bg-rose-600 text-white border-rose-500' : 'bg-amber-600 text-white border-amber-500'}`}>
                  {asset.priority}
                </span>
              )}
              <div>
                <div className="text-2xl font-black text-white tracking-wider flex flex-col gap-1">
                  {asset.fleet_id}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300 w-fit">
                    {asset.component_system || 'General'}
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-semibold mt-1">{asset.make_model}</div>
              </div>
            </div>

            <div className="flex-1 min-w-50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Work Scope</span>
              <p className="text-sm font-bold text-slate-100 mt-0.5">{asset.shift_task}</p>
              <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mt-1.5"><User className="w-3.5 h-3.5 text-amber-500" /> {asset.fitter_assigned || 'Unassigned'}</p>
            </div>

            <div className="min-w-32.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3 text-rose-400" /> Down Since</span>
              <div className="text-xs font-bold text-slate-200 mt-0.5">{formatDateTime(asset.down_since)}</div>
              <div className="text-xs font-mono font-bold text-rose-400 mt-0.5">Elapsed: {getElapsedDown(asset.down_since)}</div>
            </div>

            <div className="min-w-37.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Current Stage</span>
              <select
                value={asset.shift_stage || 'DIAGNOSING'}
                onChange={(e) => updateStage(asset.id, e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-amber-400 font-bold text-xs p-2.5 rounded-xl focus:outline-none focus:border-amber-500"
              >
                {STAGES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <button onClick={() => openHistory(asset)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5">
                <History className="w-4 h-4 text-amber-400" /> History & Notes
              </button>
              <button onClick={() => completeShiftJob(asset.id)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black tracking-wider uppercase rounded-xl flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Actual Up
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}