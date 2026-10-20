import { useState } from 'react';
import { 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  FileText, 
  User, 
  Copy, 
  Check, 
  Send 
} from 'lucide-react';
import { Asset, DefectItem, COMPONENT_SYSTEMS, STAGES, HistoryNote } from '@/types';
import { createClient } from '@/utils/supabase/client';
import { formatDateTime } from '@/utils/helpers';
import { generateSapNotesText, copyToClipboard } from '@/utils/sapFormatter';

interface DefectsModalProps {
  asset: Asset | null;
  defects: DefectItem[];
  notes?: HistoryNote[];
  onClose: () => void;
  onRefresh: () => void;
}

export default function DefectsModal({ asset, defects, notes = [], onClose, onRefresh }: DefectsModalProps) {
  // New Defect Form State
  const [severity, setSeverity] = useState<'CAT1' | 'CAT2' | 'CAT3'>('CAT2');
  const [description, setDescription] = useState('');
  const [reportedBy, setReportedBy] = useState('');
  const [woNumber, setWoNumber] = useState('');
  const [notificationNum, setNotificationNum] = useState('');
  const [fitterAssigned, setFitterAssigned] = useState('');
  const [selectedSystems, setSelectedSystems] = useState<string[]>(['Hydraulics']);

  // Editing existing defect state
  const [editingDefectId, setEditingDefectId] = useState<string | null>(null);
  const [editWoNum, setEditWoNum] = useState('');
  const [editNotifNum, setEditNotifNum] = useState('');
  const [newDefectNote, setNewDefectNote] = useState('');
  const [copiedDefectId, setCopiedDefectId] = useState<string | null>(null);

  const supabase = createClient();

  if (!asset) return null;

  const machineDefects = defects.filter((d) => d.asset_id === asset.id);

  function toggleSystem(sys: string) {
    if (selectedSystems.includes(sys)) {
      if (selectedSystems.length > 1) setSelectedSystems(selectedSystems.filter((s) => s !== sys));
    } else {
      setSelectedSystems([...selectedSystems, sys]);
    }
  }

  async function handleAddDefect(e: React.FormEvent) {
    e.preventDefault();
    if (!asset || !description.trim() || !reportedBy.trim()) return;

    const { error } = await supabase.from('defect_watchlist').insert([{
      asset_id: asset.id,
      severity,
      description: description.trim(),
      reported_by: reportedBy.trim(),
      wo_number: woNumber.trim() || null,
      notification_num: notificationNum.trim() || null,
      order_type: 'PM03',
      component_systems: selectedSystems,
      fitter_assigned: fitterAssigned.trim() || reportedBy.trim(),
      stage: 'DIAGNOSING',
      status: 'OPEN'
    }]);

    if (!error) {
      await supabase.from('asset_history_notes').insert([{
        asset_id: asset.id,
        fitter_name: reportedBy.trim(),
        note: `Defect logged [${severity}]: ${description.trim()} ${woNumber ? '(WO: ' + woNumber + ')' : ''}`,
        stage: 'DIAGNOSING'
      }]);

      setDescription('');
      setWoNumber('');
      setNotificationNum('');
      setFitterAssigned('');
      onRefresh();
    }
  }

  async function handleUpdateDefectStage(defectId: string, newStage: string) {
    await supabase.from('defect_watchlist').update({ stage: newStage }).eq('id', defectId);
    await supabase.from('asset_history_notes').insert([{
      asset_id: asset?.id,
      fitter_name: 'Fitter / Dispatcher',
      note: `Defect stage updated to ${newStage.replace('_', ' ')}`,
      stage: newStage
    }]);
    onRefresh();
  }

  async function handleAssignWoToDefect(defectId: string) {
    if (!editWoNum.trim()) return;
    await supabase.from('defect_watchlist').update({
      wo_number: editWoNum.trim(),
      notification_num: editNotifNum.trim() || null,
    }).eq('id', defectId);

    await supabase.from('asset_history_notes').insert([{
      asset_id: asset?.id,
      fitter_name: 'Maintenance Dispatcher',
      note: `Assigned SAP Work Order ${editWoNum.trim()} to defect.`,
      stage: 'IN_REPAIR'
    }]);

    setEditingDefectId(null);
    setEditWoNum('');
    setEditNotifNum('');
    onRefresh();
  }

  async function handleAddNoteToDefect(defect: DefectItem) {
    if (!newDefectNote.trim()) return;
    await supabase.from('asset_history_notes').insert([{
      asset_id: asset?.id,
      fitter_name: defect.fitter_assigned || 'Shift Fitter',
      note: `[Defect Note - ${defect.severity}]: ${newDefectNote.trim()}`,
      stage: defect.stage || 'IN_REPAIR'
    }]);
    setNewDefectNote('');
    onRefresh();
  }

  async function toggleDefectFixed(defect: DefectItem) {
    const isNowFixed = defect.status === 'OPEN';
    const nextStatus = isNowFixed ? 'FIXED_THIS_SHIFT' : 'OPEN';

    await supabase.from('defect_watchlist').update({
      status: nextStatus,
      rectified_by: isNowFixed ? (defect.fitter_assigned || 'Shift Fitter') : null,
      rectified_at: isNowFixed ? new Date().toISOString() : null,
      stage: isNowFixed ? 'COMPLETED' : 'IN_REPAIR'
    }).eq('id', defect.id);

    await supabase.from('asset_history_notes').insert([{
      asset_id: asset?.id,
      fitter_name: defect.fitter_assigned || 'Shift Fitter',
      note: isNowFixed ? `Defect [${defect.severity}] marked FIXED: ${defect.description}` : `Defect [${defect.severity}] REOPENED.`,
      stage: isNowFixed ? 'COMPLETED' : 'IN_REPAIR'
    }]);

    onRefresh();
  }

  // UPDATED: Now uses generateSapNotesText to only copy clean notes
  async function handleCopyDefectSap(defect: DefectItem) {
    if (!asset) return;
    const defectNotes = notes.filter((n) => n.asset_id === asset.id && n.note.includes(defect.description.slice(0, 15)));
    const text = generateSapNotesText(defectNotes);
    
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedDefectId(defect.id);
      setTimeout(() => setCopiedDefectId(null), 2000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-300 rounded-2xl max-w-3xl w-full p-6 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              {asset.fleet_id} Defect & Work Order Manager
            </h3>
            <p className="text-xs text-slate-500">
              Manage defect rectification, assign SAP work orders (PM03), log progress notes, and clear defects.
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Existing Defects */}
        <div className="mt-4 max-h-72 overflow-y-auto space-y-3 pr-1">
          {machineDefects.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">No Recorded Defects</p>
              <p className="text-[11px] text-slate-500">All incidental inspections clear on this machine.</p>
            </div>
          ) : (
            machineDefects.map((defect) => {
              const isFixed = defect.status === 'FIXED_THIS_SHIFT';
              const isEditingThis = editingDefectId === defect.id;

              return (
                <div
                  key={defect.id}
                  className={`p-4 rounded-xl border transition shadow-sm ${
                    isFixed ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase ${
                          defect.severity === 'CAT1'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : defect.severity === 'CAT2'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-sky-100 text-sky-800 border-sky-300'
                        }`}
                      >
                        {defect.severity}
                      </span>

                      {defect.wo_number ? (
                        <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded flex items-center gap-1">
                          <FileText className="w-3 h-3" /> {defect.wo_number} ({defect.order_type || 'PM03'})
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingDefectId(defect.id);
                            setEditWoNum('');
                          }}
                          className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded hover:bg-amber-100"
                        >
                          + Assign SAP WO
                        </button>
                      )}

                      {defect.component_systems?.map((sys) => (
                        <span key={sys} className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {sys}
                        </span>
                      ))}

                      <span className="text-[10px] text-slate-400">{formatDateTime(defect.created_at)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Copy Defect SAP Notes */}
                      <button
                        onClick={() => handleCopyDefectSap(defect)}
                        className="flex items-center gap-1.5 p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold transition"
                        title="Copy clean SAP Notes for this defect"
                      >
                        {copiedDefectId === defect.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedDefectId === defect.id ? 'Copied' : 'SAP Notes'}
                      </button>

                      {/* Stage Selector */}
                      {!isFixed && (
                        <select
                          value={defect.stage || 'DIAGNOSING'}
                          onChange={(e) => handleUpdateDefectStage(defect.id, e.target.value)}
                          className="bg-slate-50 border border-slate-300 text-slate-700 font-bold text-[11px] p-1.5 rounded-lg"
                        >
                          {STAGES.map((s) => (
                            <option key={s} value={s}>
                              {s.replace('_', ' ')}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Sign Off / Fixed Button */}
                      <button
                        onClick={() => toggleDefectFixed(defect)}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition ${
                          isFixed ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isFixed ? 'Reopen' : 'Mark Fixed'}
                      </button>
                    </div>
                  </div>

                  {/* Defect Description */}
                  <p className={`text-sm mt-2 text-slate-800 ${isFixed ? 'line-through text-slate-400' : 'font-semibold'}`}>
                    {defect.description}
                  </p>

                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>Reported by: <strong className="text-slate-700">{defect.reported_by}</strong></span>
                    <span>• Assigned Fitter: <strong className="text-slate-700">{defect.fitter_assigned || 'Unassigned'}</strong></span>
                    {isFixed && <span className="text-emerald-700 font-bold ml-1">(Rectified by {defect.rectified_by || 'Fitter'})</span>}
                  </p>

                  {/* Inline Form to Attach WO to Defect */}
                  {isEditingThis && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="SAP WO # (e.g. 40089104)"
                        value={editWoNum}
                        onChange={(e) => setEditWoNum(e.target.value)}
                        className="bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-mono font-bold w-44"
                      />
                      <input
                        type="text"
                        placeholder="Notification # (Optional)"
                        value={editNotifNum}
                        onChange={(e) => setEditNotifNum(e.target.value)}
                        className="bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-mono w-40"
                      />
                      <button
                        onClick={() => handleAssignWoToDefect(defect.id)}
                        className="px-3 py-1.5 bg-indigo-600 text-white font-bold text-xs rounded hover:bg-indigo-500"
                      >
                        Save WO
                      </button>
                      <button
                        onClick={() => setEditingDefectId(null)}
                        className="px-2 py-1.5 text-xs text-slate-400 hover:text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Form: Record New Defect with Full Work Order Details */}
        <form onSubmit={handleAddDefect} className="mt-5 pt-4 border-t border-slate-200 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
            Record New Defect / Down Time Event:
          </span>

          <div className="grid grid-cols-3 gap-2">
            {(['CAT1', 'CAT2', 'CAT3'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSeverity(cat)}
                className={`py-1.5 rounded-lg text-xs font-bold border transition ${
                  severity === cat
                    ? 'bg-amber-100 border-amber-500 text-amber-900 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {cat} {cat === 'CAT1' ? '(Stop / Critical)' : cat === 'CAT2' ? '(Production Risk)' : '(Routine Backlog)'}
              </button>
            ))}
          </div>

          <textarea
            rows={2}
            placeholder="Describe defect in detail (e.g. Cracked track roller frame mount, A/C compressor belt squeal, hydraulic leak)..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800"
            required
          />

          {/* Area Tags */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">SYSTEM / COMPONENT</label>
            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto p-1.5 bg-slate-50 rounded-lg border border-slate-200">
              {COMPONENT_SYSTEMS.map((sys) => {
                const isSelected = selectedSystems.includes(sys);
                return (
                  <button
                    key={sys}
                    type="button"
                    onClick={() => toggleSystem(sys)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                      isSelected ? 'bg-amber-100 border-amber-500 text-amber-900' : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    {sys}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Work Order and Fitter Fields right at creation */}
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="SAP WO # (Optional)"
              value={woNumber}
              onChange={(e) => setWoNumber(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-800"
            />
            <input
              type="text"
              placeholder="Fitter Assigned"
              value={fitterAssigned}
              onChange={(e) => setFitterAssigned(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
            />
            <input
              type="text"
              placeholder="Your Name / Inspector *"
              value={reportedBy}
              onChange={(e) => setReportedBy(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Save Defect Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}