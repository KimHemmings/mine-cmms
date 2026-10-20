import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { Asset, COMPONENT_SYSTEMS } from '@/types';
import { createClient } from '@/utils/supabase/client';

interface AddWorkOrderModalProps {
  asset: Asset | null;
  activeShiftId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddWorkOrderModal({ asset, activeShiftId, onClose, onSuccess }: AddWorkOrderModalProps) {
  const [woNumber, setWoNumber] = useState('');
  const [notificationNum, setNotificationNum] = useState('');
  const [orderType, setOrderType] = useState('PM01');
  const [taskDescription, setTaskDescription] = useState('');
  const [selectedSystems, setSelectedSystems] = useState<string[]>(['Hydraulics']);
  const [fitterAssigned, setFitterAssigned] = useState('');

  const supabase = createClient();

  if (!asset) return null;

  function toggleSystem(sys: string) {
    if (selectedSystems.includes(sys)) {
      if (selectedSystems.length > 1) {
        setSelectedSystems(selectedSystems.filter((s) => s !== sys));
      }
    } else {
      setSelectedSystems([...selectedSystems, sys]);
    }
  }

  async function handleAddWorkOrder(e: React.FormEvent) {
    e.preventDefault();
    
    // FIX: Tell TypeScript asset absolutely exists here
    if (!asset || !taskDescription.trim()) return;

    const { error } = await supabase.from('machine_work_orders').insert([{
      asset_id: asset.id,
      shift_id: activeShiftId,
      wo_number: woNumber.trim() || null,
      notification_num: notificationNum.trim() || null,
      order_type: orderType,
      task_description: taskDescription.trim(),
      component_systems: selectedSystems,
      fitter_assigned: fitterAssigned.trim() || asset.fitter_assigned || 'Unassigned',
      stage: 'DIAGNOSING',
      status: 'OPEN'
    }]);

    if (!error) {
      await supabase.from('asset_history_notes').insert([{
        asset_id: asset.id,
        fitter_name: fitterAssigned.trim() || 'Maintenance Planner',
        note: `Added extra work order [${woNumber || 'No WO'} - ${orderType}]: ${taskDescription.trim()}`,
        stage: 'DIAGNOSING'
      }]);
      onSuccess();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Add Work Order to {asset.fleet_id}</h3>
            <p className="text-xs text-slate-500">Attach an additional repair, service, or defect scope under this machine.</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleAddWorkOrder} className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ORDER TYPE</label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
              >
                <option value="PM01">PM01 - Breakdown</option>
                <option value="PM02">PM02 - Scheduled PM</option>
                <option value="PM03">PM03 - Defect Rect</option>
                <option value="PM04">PM04 - Modification</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">SAP WORK ORDER #</label>
              <input
                type="text"
                placeholder="e.g. 40082915"
                value={woNumber}
                onChange={(e) => setWoNumber(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">SAP NOTIF #</label>
              <input
                type="text"
                placeholder="e.g. 1004830"
                value={notificationNum}
                onChange={(e) => setNotificationNum(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              AREAS BEING WORKED ON <span className="text-slate-500 font-normal">(Select multiple)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
              {COMPONENT_SYSTEMS.map((sys) => {
                const isSelected = selectedSystems.includes(sys);
                return (
                  <button
                    key={sys}
                    type="button"
                    onClick={() => toggleSystem(sys)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition flex items-center gap-1 ${
                      isSelected
                        ? 'bg-amber-100 border-amber-500 text-amber-900'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-amber-600" />}
                    {sys}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">WORK ORDER TASK DESCRIPTION</label>
            <textarea
              rows={2}
              placeholder="e.g. Replace blown hydraulic hose, reseal cylinder, inspect alternator..."
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">FITTER ASSIGNED</label>
            <input
              type="text"
              placeholder="e.g. D. Kelly / Apprentice"
              value={fitterAssigned}
              onChange={(e) => setFitterAssigned(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg shadow-sm"
            >
              Attach Work Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}