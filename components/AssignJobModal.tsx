'use client';

import React, { useState, useEffect } from 'react';
import { X, Star, Loader2 } from 'lucide-react';
import { Asset, OrderType, PRIORITY_OPTIONS } from '@/types';
import { createClient } from '@/utils/supabase/client';
import OrderTypeSelector from './assign-job/OrderTypeSelector';
import EtuPresetsPicker from './assign-job/EtuPresetsPicker';
import ComponentSystemsPicker from './assign-job/ComponentSystemsPicker';
import StatusImpactSelector from './assign-job/StatusImpactSelector';
import SapDetailsInputs from './assign-job/SapDetailsInputs';
import CrewPicker from './crew/CrewPicker';
import DictationMicButton, { useDictationTarget } from './ui/DictationMicButton';
import { useCrewData, crewNames } from './crew/CrewDataContext';

interface AssignJobModalProps {
  isOpen: boolean;
  activeShiftId: string | null;
  onClose: () => void;
  onSuccess: () => void;
  unassignedMachines: Asset[];
  preselectedAssetId?: string;
  preselectedAsset?: Asset | null;
}

export default function AssignJobModal({
  isOpen,
  activeShiftId,
  onClose,
  onSuccess,
  unassignedMachines,
  preselectedAssetId,
  preselectedAsset,
}: AssignJobModalProps) {
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('P3');
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('UNPLANNED');
  const [isMachineDown, setIsMachineDown] = useState(true);
  const [workOrderNum, setWorkOrderNum] = useState('');
  const [sapNotification, setSapNotification] = useState('');
  const [location, setLocation] = useState('');
  const task = useDictationTarget();
  const taskDesc = task.value;
  const [crewIds, setCrewIds] = useState<string[]>([]);
  const [downSinceInput, setDownSinceInput] = useState('');
  const [expectedUpInput, setExpectedUpInput] = useState('');
  const [activePreset, setActivePreset] = useState<string | null>('4h');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const supabase = createClient();
  const { crew, onShiftIds, openJobCounts } = useCrewData();

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setDownSinceInput(localNow);
      const target = new Date(Date.now() + 4 * 60 * 60 * 1000);
      setExpectedUpInput(new Date(target.getTime() - target.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
      setActivePreset('4h');
      const id = preselectedAssetId || '';
      setSelectedAssetId(id);
      const chosen = unassignedMachines.find((machine) => machine.id === id) || preselectedAsset;
      setLocation(chosen?.location || '');
      setSelectedPriority('P3');
      setSelectedSystems([]);
      setCrewIds([]);
      setFormError(null);
    }
  }, [isOpen, preselectedAssetId, preselectedAsset]);

  if (!isOpen) return null;

  async function handleAssignToShift(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!selectedAssetId) return setFormError('Please select a machine.');
    if (!taskDesc.trim()) return setFormError('Please enter a scope/reason.');

    setIsSubmitting(true);
    const assetStatus = !isMachineDown
      ? 'OPERATIONAL'
      : orderType === 'PLANNED' ? 'DOWN_PLANNED' : 'DOWN_UNPLANNED';

    const { error: assetError } = await supabase
      .from('assets')
      .update({
        in_shift: true,
        status: assetStatus,
        priority: selectedPriority || 'P3',
        location: location.trim(),
        down_since: isMachineDown ? new Date(downSinceInput).toISOString() : null,
        expected_up: isMachineDown && expectedUpInput ? new Date(expectedUpInput).toISOString() : null,
      })
      .eq('id', selectedAssetId);

    if (assetError) {
      setIsSubmitting(false);
      return setFormError('Failed to update machine: ' + assetError.message);
    }

    const cleanWo = workOrderNum.trim();
    const cleanNotif = sapNotification.trim();

    const assignedNames = crewNames(crew, crewIds);

    await supabase
      .from('machine_work_orders')
      .update({ is_main_event: false })
      .eq('asset_id', selectedAssetId)
      .eq('is_main_event', true);

    const { data: newWo, error: woError } = await supabase
      .from('machine_work_orders')
      .insert({
        asset_id: selectedAssetId,
        shift_id: activeShiftId,
        wo_number: cleanWo || null,
        notification_num: cleanNotif || null,
        order_type: orderType,
        task_description: taskDesc.trim(),
        component_systems: selectedSystems,
        fitter_assigned: assignedNames || 'Unassigned',
        stage: 'IN_PROGRESS',
        status: 'OPEN',
        is_main_event: true,
        takes_machine_down: isMachineDown,
      })
      .select('id')
      .single<{ id: string }>();

    if (woError) {
      setIsSubmitting(false);
      return setFormError('Failed to create work order: ' + woError.message);
    }

    if (crewIds.length > 0) {
      const { error: crewError } = await supabase.rpc('set_work_order_crew', {
        p_work_order_id: newWo.id,
        p_crew_ids: crewIds,
      });
      if (crewError) alert('Machine assigned, but assigning crew failed: ' + crewError.message);
    }

    await supabase.from('asset_history_notes').insert([{
      asset_id: selectedAssetId,
      fitter_name: assignedNames || 'Shift Fitter',
      note: 'Main Event [' + orderType + ' | ' + (cleanWo || 'No WO') + ']: ' + taskDesc.trim(),
      stage: 'IN_PROGRESS',
    }]);

    setIsSubmitting(false);
    onSuccess();
    onClose();
  }

  const machineChoices = preselectedAsset && !unassignedMachines.some((machine) => machine.id === preselectedAsset.id)
    ? [preselectedAsset, ...unassignedMachines]
    : unassignedMachines;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-400" /> Create downtime event
            </h3>
            <p className="text-xs text-slate-500">Record a downtime event or in-service inspection on the shift workboard.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleAssignToShift} className="flex flex-col min-h-0 flex-1">
          <div className="overflow-y-auto px-6 py-4 space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">MACHINE *</label>
              <select
                value={selectedAssetId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedAssetId(id);
                  const chosen = machineChoices.find((machine) => machine.id === id);
                  setLocation(chosen?.location || '');
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                required
              >
                <option value="">-- Choose Unit --</option>
                {machineChoices.map((a) => (
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
                  <option key={p.label} value={p.value || ''}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">LOCATION</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Workshop bay or pad"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
          </div>

          <StatusImpactSelector isMachineDown={isMachineDown} onChange={setIsMachineDown} />
          <OrderTypeSelector orderType={orderType} setOrderType={setOrderType} />
          <SapDetailsInputs
            workOrderNum={workOrderNum}
            setWorkOrderNum={setWorkOrderNum}
            sapNotification={sapNotification}
            setSapNotification={setSapNotification}
          />
          <ComponentSystemsPicker selectedSystems={selectedSystems} onChange={setSelectedSystems} />

          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="text-xs font-bold text-slate-700">MAIN EVENT SCOPE / REASON *</label>
              <DictationMicButton {...task.mic} />
            </div>
            <textarea
              value={taskDesc}
              onChange={task.onChange}
              rows={2}
              placeholder="e.g. 500hr PM Service Pack, check tyre pressure, front LH strut swap out..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
              required
            />
          </div>

          <div>
            <p className="block text-xs font-bold text-slate-700 mb-1">
              WHO&apos;S ON THIS JOB <span className="font-normal text-slate-400">(tap to select, optional)</span>
            </p>
            <CrewPicker
              crew={crew}
              onShiftIds={onShiftIds}
              openJobCounts={openJobCounts}
              selectedIds={crewIds}
              onChange={setCrewIds}
            />
          </div>

          {isMachineDown && (
            <EtuPresetsPicker
              downSinceInput={downSinceInput}
              setDownSinceInput={setDownSinceInput}
              expectedUpInput={expectedUpInput}
              setExpectedUpInput={setExpectedUpInput}
              activePreset={activePreset}
              setActivePreset={setActivePreset}
            />
          )}
          </div>

          <div className="shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-white rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isSubmitting ? 'Assigning...' : 'Log Main Event'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}