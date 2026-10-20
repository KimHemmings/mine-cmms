import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { Asset, COMPONENT_SYSTEMS } from '@/types';
import { createClient } from '@/utils/supabase/client';

interface AssignJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  unassignedMachines: Asset[];
}

export default function AssignJobModal({ isOpen, onClose, onSuccess, unassignedMachines }: AssignJobModalProps) {
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedSystems, setSelectedSystems] = useState<string[]>(['Hydraulics']);
  const [workOrderNum, setWorkOrderNum] = useState('');
  const [sapNotification, setSapNotification] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [assignedFitter, setAssignedFitter] = useState('');
  const [downSinceInput, setDownSinceInput] = useState('');
  const [expectedUpInput, setExpectedUpInput] = useState('');

  const supabase = createClient();

  function toggleSystem(sys: string) {
    if (selectedSystems.includes(sys)) {
      if (selectedSystems.length > 1) {
        setSelectedSystems(selectedSystems.filter((s) => s !== sys));
      }
    } else {
      setSelectedSystems([...selectedSystems, sys]);
    }
  }

  function applyEtuPreset(hoursFromNow: number) {
    const target = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    const localTarget = new Date(target.getTime() - target.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setExpectedUpInput(localTarget);
  }

  function setEndOfShiftEtu() {
    const now = new Date();
    const isDayShift = now.getHours() >= 6 && now.getHours() < 18;
    const target = new Date();
    if (isDayShift) {
      target.setHours(17, 30, 0, 0);
    } else {
      if (now.getHours() >= 18) target.setDate(target.getDate() + 1);
      target.setHours(5, 30, 0, 0);
    }
    const localTarget = new Date(target.getTime() - target.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setExpectedUpInput(localTarget);
  }

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setDownSinceInput(localNow);
      applyEtuPreset(4);
      setSelectedAssetId('');
      setTaskDesc('');
      setAssignedFitter('');
      setSelectedPriority('');
      setWorkOrderNum('');
      setSapNotification('');
      setSelectedSystems(['Hydraulics']);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleAssignToShift(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAssetId || !taskDesc) return;

    const { error } = await supabase.from('assets').update({
      in_shift: true,
      status: 'DOWN_UNPLANNED',
      priority: selectedPriority || null,
      component_systems: selectedSystems,
      work_order_num: workOrderNum.trim() || null,
      sap_notification: sapNotification.trim() || null,
      shift_task: taskDesc,
      fitter_assigned: assignedFitter || 'Unassigned',
      shift_stage: 'DIAGNOSING',
      down_since: new Date(downSinceInput).toISOString(),
      expected_up: expectedUpInput ? new Date(expectedUpInput).toISOString() : null,
      actual_up: null,
    }).eq('id', selectedAssetId);

    if (!error) {
      await supabase.from('asset_history_notes').insert([{
        asset_id: selectedAssetId,
        fitter_name: assignedFitter || 'Maintenance Planner',
        note: `Stood down for [${selectedSystems.join(', ')}]. WO: ${workOrderNum || 'N/A'}. Task: ${taskDesc}`,
        stage: 'DIAGNOSING'
      }]);
      onSuccess();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white">Assign Machine & Log Breakdown</h3>
            <p className="text-xs text-slate-400">Allocate fitters, assign SAP work orders, and tag multiple systems.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleAssignToShift} className="space-y-4 mt-4">
          {/* Equipment & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">EQUIPMENT</label>
              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-amber-500"
                required
              >
                <option value="">-- Choose Unit --</option>
                {unassignedMachines.map((a) => (
                  <option key={a.id} value={a.id}>{a.fleet_id} ({a.make_model})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                PRIORITY <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-amber-500"
              >
                <option value="">None (Routine Breakdown)</option>
                <option value="P1">P1 - Production Stopping</option>
                <option value="P2">P2 - High Production Choke</option>
                <option value="P3">P3 - Pit Floor & Support</option>
                <option value="P4">P4 - Ancillary & PM Backlog</option>
              </select>
            </div>
          </div>

          {/* SAP Work Order & Notification */}
          <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div>
              <label className="block text-xs font-bold text-sky-400 mb-1">SAP WORK ORDER #</label>
              <input
                type="text"
                placeholder="e.g. 40082910"
                value={workOrderNum}
                onChange={(e) => setWorkOrderNum(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">SAP NOTIF / ORDER TYPE</label>
              <input
                type="text"
                placeholder="e.g. Notif 1004821 (PM01)"
                value={sapNotification}
                onChange={(e) => setSapNotification(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
              />
            </div>
          </div>

          {/* Multi-System Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              AREAS BEING WORKED ON <span className="text-slate-400 font-normal">(Select all that apply)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-slate-950/80 rounded-xl border border-slate-800">
              {COMPONENT_SYSTEMS.map((sys) => {
                const isSelected = selectedSystems.includes(sys);
                return (
                  <button
                    key={sys}
                    type="button"
                    onClick={() => toggleSystem(sys)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition flex items-center gap-1 ${
                      isSelected
                        ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-amber-400" />}
                    {sys}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scope of Work */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">TASK / WORK SCOPE</label>
            <textarea
              value={taskDesc}
              onChange={(e) => setTaskDesc(e.target.value)}
              rows={2}
              placeholder="e.g. Blown hydraulic hose, replace strut valve, 250hr service..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
              required
            />
          </div>

          {/* Fitter Assigned */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">FITTER(S) ALLOCATED</label>
            <input
              type="text"
              placeholder="e.g. M. Campbell / D. Kelly"
              value={assignedFitter}
              onChange={(e) => setAssignedFitter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
            />
          </div>

          {/* Timing & Quick Presets */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">DATE & TIME DOWN</label>
              <input
                type="datetime-local"
                value={downSinceInput}
                onChange={(e) => setDownSinceInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">EXPECTED UP TIME (ETU)</label>
              <input
                type="datetime-local"
                value={expectedUpInput}
                onChange={(e) => setExpectedUpInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                required
              />
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Quick ETU Presets</span>
            <div className="grid grid-cols-4 gap-2">
              <button type="button" onClick={() => applyEtuPreset(1)} className="py-1 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-bold text-slate-300">+1 Hour</button>
              <button type="button" onClick={() => applyEtuPreset(2)} className="py-1 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-bold text-slate-300">+2 Hours</button>
              <button type="button" onClick={() => applyEtuPreset(4)} className="py-1 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-bold text-slate-300">+4 Hours</button>
              <button type="button" onClick={setEndOfShiftEtu} className="py-1 px-2 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 rounded text-xs font-bold text-amber-300">End of Shift</button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white">Cancel</button>
            <button type="submit" className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition">Assign to Shift</button>
          </div>
        </form>
      </div>
    </div>
  );
}