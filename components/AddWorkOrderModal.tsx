'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { Asset } from '@/types';
import { createClient } from '@/utils/supabase/client';
import OrderMetaInputs from './add-work-order/OrderMetaInputs';
import ComponentSystemsPicker from './add-work-order/ComponentSystemsPicker';

interface AddWorkOrderModalProps {
  asset: Asset | null;
  activeShiftId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddWorkOrderModal({
  asset,
  activeShiftId,
  onClose,
  onSuccess,
}: AddWorkOrderModalProps) {
  const [woNumber, setWoNumber] = useState('');
  const [notificationNum, setNotificationNum] = useState('');
  const [orderType, setOrderType] = useState('UNPLANNED');
  const [taskDescription, setTaskDescription] = useState('');
  const [selectedSystems, setSelectedSystems] = useState<string[]>(['Hydraulics']);
  const [fitterAssigned, setFitterAssigned] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (asset) {
      setWoNumber('');
      setNotificationNum('');
      setOrderType('UNPLANNED');
      setTaskDescription('');
      setSelectedSystems(['Hydraulics']);
      setFitterAssigned('');
    }
  }, [asset]);

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
    if (!asset || !taskDescription.trim()) return;
    setSubmitting(true);

    const cleanWo = woNumber.trim() || null;

    const { error: woError } = await supabase.from('machine_work_orders').insert([
      {
        asset_id: asset.id,
        shift_id: activeShiftId,
        wo_number: cleanWo,
        notification_num: notificationNum.trim() || null,
        order_type: orderType,
        task_description: taskDescription.trim(),
        component_systems: selectedSystems,
        fitter_assigned: fitterAssigned.trim() || asset.fitter_assigned || 'Unassigned',
        stage: 'IN_PROGRESS',
        status: 'OPEN',
      },
    ]);

    if (!woError) {
      await supabase.from('asset_history_notes').insert([
        {
          asset_id: asset.id,
          fitter_name: fitterAssigned.trim() || 'Maintenance Planner',
          note: `Added work order [${cleanWo ? `WO #\${cleanWo}` : 'No WO'} - ${orderType}]: ${taskDescription.trim()}`,
          stage: 'IN_PROGRESS',
        },
      ]);
      setSubmitting(false);
      onSuccess();
      onClose();
    } else {
      alert('Error creating work order: ' + woError.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Add Work Order to {asset.fleet_id}
            </h3>
            <p className="text-xs text-slate-500">
              Add a secondary repair, service, inspection, or damage scope under this machine.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleAddWorkOrder} className="space-y-4 mt-4">
          <OrderMetaInputs
            orderType={orderType}
            setOrderType={setOrderType}
            woNumber={woNumber}
            setWoNumber={setWoNumber}
            notificationNum={notificationNum}
            setNotificationNum={setNotificationNum}
          />

          <ComponentSystemsPicker
            selectedSystems={selectedSystems}
            toggleSystem={toggleSystem}
          />

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              WORK ORDER TASK DESCRIPTION *
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Replace blown hydraulic hose, reseal cylinder, inspect alternator..."
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              FITTER ASSIGNED
            </label>
            <input
              type="text"
              placeholder="e.g. D. Kelly / Apprentice"
              value={fitterAssigned}
              onChange={(e) => setFitterAssigned(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> {submitting ? 'Adding...' : 'Add Work Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}