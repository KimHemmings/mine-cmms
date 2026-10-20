'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, Star } from 'lucide-react';
import { Asset, COMPONENT_SYSTEMS, OrderType, PRIORITY_OPTIONS } from '@/types';
import { createClient } from '@/utils/supabase/client';
import OrderTypeSelector from './assign-job/OrderTypeSelector';
import EtuPresetsPicker from './assign-job/EtuPresetsPicker';

interface AssignJobModalProps {
  isOpen: boolean;
  activeShiftId: string | null;
  onClose: () => void;
  onSuccess: () => void;
  unassignedMachines: Asset[];
  preselectedAssetId?: string;
}

export default function AssignJobModal({
  isOpen,
  activeShiftId,
  onClose,
  onSuccess,
  unassignedMachines,
  preselectedAssetId,
}: AssignJobModalProps) {
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedSystems, setSelectedSystems] = useState<string[]>(['Hydraulics']);
  const [orderType, setOrderType] = useState<OrderType>('UNPLANNED');
  const [workOrderNum, setWorkOrderNum] = useState('');
  const [sapNotification, setSapNotification] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [assignedFitter, setAssignedFitter] = useState('');
  const [downSinceInput, setDownSinceInput] = useState('');
  const [expectedUpInput, setExpectedUpInput] = useState('');
  const [activePreset, setActivePreset] = useState<string | null>('4h');

  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setDownSinceInput(localNow);

      const target = new Date(Date.now() + 4 * 60 * 60 * 1000);
      setExpectedUpInput(
        new Date(target.getTime() - target.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      );
      setActivePreset('4h');

      setSelectedAssetId(preselectedAssetId || '');
      setTaskDesc('');
      setAssignedFitter('');
      setSelectedPriority('');
      setWorkOrderNum('');
      setSapNotification('');
      setSelectedSystems(['Hydraulics']);
      setOrderType('UNPLANNED');
    }
  }, [isOpen, preselectedAssetId]);

  if (!isOpen) return null;

  function toggleSystem(sys: string) {
    if (selectedSystems.includes(sys)) {
      if (selectedSystems.length > 1) {
        setSelectedSystems(selectedSystems.filter((s) => s !== sys));
      }
    } else {
      setSelectedSystems([...selectedSystems, sys]);
    }
  }

  async function handleAssignToShift(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAssetId || !taskDesc.trim()) return;

    const assetStatus = orderType === 'PLANNED' ? 'DOWN_PLANNED' : 'DOWN_UNPLANNED';

    const { error: assetError } = await supabase
      .from('assets')
      .update({
        in_shift: true,
        status: assetStatus,
        priority: selectedPriority || null,
        down_since: new Date(downSinceInput).toISOString(),
        expected_up: expectedUpInput ? new Date(expectedUpInput).toISOString() : null,
        actual_up: null,
      })
      .eq('id', selectedAssetId);

    const { error: woError } = await supabase.from('machine_work_orders').insert([
      {
        asset_id: selectedAssetId,
        shift_id: activeShiftId,
        wo_number: workOrderNum.trim() || null,
        notification_num: sapNotification.trim() || null,
        order_type: orderType,
        task_description: taskDesc.trim(),
        component_systems: selectedSystems,
        fitter_assigned: assignedFitter.trim() || 'Unassigned',
        stage: 'IN_PROGRESS',
        status: 'OPEN',
        is_main_event: true,
      },
    ]);

    if (!assetError && !woError) {
      await supabase.from('asset_history_notes').insert([
        {
          asset_id: selectedAssetId,
          fitter_name: assignedFitter.trim() || 'Maintenance Planner',
          note: `Main Event logged [${orderType} - ${workOrderNum.trim() || 'No WO'}]: ${taskDesc.trim()}`,
          stage: 'IN_PROGRESS',
        },
      ]);
      onSuccess();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-300 rounded-2xl max-w-2xl w-full p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
              Assign Machine & Define Main Event
            </h3>
            <p className="text-xs text-slate-500">Record the primary reason for this unit being on the shift workboard.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleAssignToShift} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">EQUIPMENT</label>
              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                required
              >
                <option value="">-- Choose Unit --</option>
                {unassignedMachines.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.fleet_id} ({a.make_model}) [{a.machine_owner || 'Central'}]
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">PRIORITY</label>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.label} value={p.value || ''}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <OrderTypeSelector orderType={orderType} setOrderType={setOrderType} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                SAP WORK ORDER # <span className="font-normal text-slate-400">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 40082910 (Optional)"
                value={workOrderNum}
                onChange={(e) => setWorkOrderNum(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                SAP NOTIF # <span className="font-normal text-slate-400">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 1004821"
                value={sapNotification}
                onChange={(e) => setSapNotification(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              PRIMARY SYSTEM / COMPONENT <span className="text-slate-500 font-normal">(Select multiple)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
              {COMPONENT_SYSTEMS.map((sys) => {
                const isSelected = selectedSystems.includes(sys);
                return (
                  <button
                    key={sys}
                    type="button"
                    onClick={() => toggleSystem(sys)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition flex items-center gap-1 cursor-pointer ${
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
            <label className="block text-xs font-bold text-slate-700 mb-1">MAIN EVENT SCOPE / REASON *</label>
            <textarea
              value={taskDesc}
              onChange={(e) => setTaskDesc(e.target.value)}
              rows={2}
              placeholder="e.g. 500hr PM Service Pack, Front LH strut swap out, accident damage to steps..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">FITTER(S) ALLOCATED</label>
            <input
              type="text"
              placeholder="e.g. D. Kelly / Apprentice"
              value={assignedFitter}
              onChange={(e) => setAssignedFitter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          <EtuPresetsPicker
            downSinceInput={downSinceInput}
            setDownSinceInput={setDownSinceInput}
            expectedUpInput={expectedUpInput}
            setExpectedUpInput={setExpectedUpInput}
            activePreset={activePreset}
            setActivePreset={setActivePreset}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer">
              Log Main Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}