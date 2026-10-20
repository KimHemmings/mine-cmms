import { useState } from 'react';
import { X, AlertTriangle, CheckCircle2, Plus } from 'lucide-react';
import { Asset, DefectItem } from '@/types';
import { createClient } from '@/utils/supabase/client';
import { formatDateTime } from '@/utils/helpers';

interface DefectsModalProps {
  asset: Asset | null;
  defects: DefectItem[];
  onClose: () => void;
  onRefresh: () => void;
}

export default function DefectsModal({ asset, defects, onClose, onRefresh }: DefectsModalProps) {
  const [severity, setSeverity] = useState<'CAT1' | 'CAT2' | 'CAT3'>('CAT2');
  const [description, setDescription] = useState('');
  const [reportedBy, setReportedBy] = useState('');
  const supabase = createClient();

  if (!asset) return null;

  const machineDefects = defects.filter((d) => d.asset_id === asset.id);

  async function handleAddDefect(e: React.FormEvent) {
    e.preventDefault();
    if (!asset || !description.trim() || !reportedBy.trim()) return;

    const { error } = await supabase.from('defect_watchlist').insert([{
      asset_id: asset.id,
      severity,
      description: description.trim(),
      reported_by: reportedBy.trim(),
      status: 'OPEN'
    }]);

    if (!error) {
      setDescription('');
      onRefresh();
    }
  }

  async function toggleDefectFixed(defect: DefectItem) {
    const isNowFixed = defect.status === 'OPEN';
    const nextStatus = isNowFixed ? 'FIXED_THIS_SHIFT' : 'OPEN';

    await supabase.from('defect_watchlist').update({
      status: nextStatus,
      rectified_by: isNowFixed ? (asset?.fitter_assigned || 'Shift Fitter') : null,
      rectified_at: isNowFixed ? new Date().toISOString() : null
    }).eq('id', defect.id);

    onRefresh();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {asset.fleet_id} Machine Defects Log
            </h3>
            <p className="text-xs text-slate-400">Record incidental defects discovered & mark items fixed during shift.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {/* List of Existing Defects */}
        <div className="mt-4 max-h-56 overflow-y-auto space-y-2 pr-1">
          {machineDefects.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No recorded defects on this machine.</p>
          ) : (
            machineDefects.map((defect) => {
              const isFixed = defect.status === 'FIXED_THIS_SHIFT';
              return (
                <div
                  key={defect.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                    isFixed ? 'bg-slate-950/60 border-slate-800 opacity-60' : 'bg-slate-800 border-slate-700'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase ${
                          defect.severity === 'CAT1'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : defect.severity === 'CAT2'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                        }`}
                      >
                        {defect.severity}
                      </span>
                      <span className="text-[10px] text-slate-400">{formatDateTime(defect.created_at)}</span>
                    </div>
                    <p className={`text-slate-200 ${isFixed ? 'line-through' : 'font-semibold'}`}>
                      {defect.description}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Reported by: <span className="text-slate-300">{defect.reported_by}</span>
                      {isFixed && ` • Fixed by ${defect.rectified_by || 'Fitter'}`}
                    </p>
                  </div>

                  <button
                    onClick={() => toggleDefectFixed(defect)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition ${
                      isFixed
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isFixed ? 'Reopen' : 'Mark Fixed'}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Form: Add New Defect */}
        <form onSubmit={handleAddDefect} className="mt-4 pt-4 border-t border-slate-800 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
            Record New Found Defect:
          </span>

          <div className="grid grid-cols-3 gap-2">
            {(['CAT1', 'CAT2', 'CAT3'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSeverity(cat)}
                className={`py-1.5 rounded-lg text-xs font-bold border transition ${
                  severity === cat
                    ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                {cat} {cat === 'CAT1' ? '(Stop)' : cat === 'CAT2' ? '(Monitor)' : '(Backlog)'}
              </button>
            ))}
          </div>

          <textarea
            rows={2}
            placeholder="Describe defect (e.g. Bleed nipple cracked, hose rubbing, light bracket bent)..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-amber-500"
            required
          />

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Your Name / Fitter ID"
              value={reportedBy}
              onChange={(e) => setReportedBy(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
              required
            />
            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg transition shrink-0 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Save Defect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}