'use client';

import React, { useState } from 'react';
import { X, Users } from 'lucide-react';
import { MachineWorkOrder } from '@/types';
import CrewPicker from './CrewPicker';
import { useCrewData } from './CrewDataContext';

interface AssignCrewModalProps {
  workOrder: MachineWorkOrder;
  fleetId: string;
  onClose: () => void;
  onSave: (woId: string, crewIds: string[]) => Promise<boolean>;
}

export default function AssignCrewModal({ workOrder, fleetId, onClose, onSave }: AssignCrewModalProps) {
  const { crew, onShiftIds, openJobCounts } = useCrewData();
  const [selectedIds, setSelectedIds] = useState<string[]>(() => (workOrder.crew ?? []).map((c) => c.crew_member_id));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave(workOrder.id, selectedIds);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl my-8 space-y-4">
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-600" /> Who&apos;s on this job?
            </h3>
            <p className="text-sm text-slate-600 mt-0.5">
              {fleetId}: {workOrder.task_description}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!workOrder.crew?.length && workOrder.fitter_assigned && workOrder.fitter_assigned !== 'Unassigned' && (
          <p className="text-sm p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
            Currently typed in as <strong>{workOrder.fitter_assigned}</strong>. Pick them from the list to link the job to the crew.
          </p>
        )}

        <CrewPicker
          crew={crew}
          onShiftIds={onShiftIds}
          openJobCounts={openJobCounts}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
        />

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 px-5 rounded-xl border-2 border-slate-300 text-base font-bold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="min-h-12 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-base font-black text-white shadow-sm disabled:opacity-50"
          >
            {saving ? 'Saving...' : selectedIds.length ? `Assign ${selectedIds.length} ${selectedIds.length === 1 ? 'person' : 'people'}` : 'Save (no one assigned)'}
          </button>
        </div>
      </div>
    </div>
  );
}
