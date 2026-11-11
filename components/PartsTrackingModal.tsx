// components/PartsTrackingModal.tsx - Exactly 105 lines
'use client';

import React, { useState } from 'react';
import { CreatePartPayload, MachineWorkOrder, PartStatus } from '@/types';
import { formatDateTime } from '@/utils/helpers';

interface PartsTrackingModalProps {
  isOpen: boolean;
  workOrder: MachineWorkOrder | null;
  onClose: () => void;
  onSubmit: (payload: CreatePartPayload) => Promise<void>;
  onUpdatePartStatus?: (partId: string, status: PartStatus) => Promise<void>;
}

const PART_STATUS_LABEL: Record<PartStatus, string> = {
  ORDERED: 'Ordered',
  IN_TRANSIT: 'On the way',
  RECEIVED: 'Received',
};

export default function PartsTrackingModal({
  isOpen,
  workOrder,
  onClose,
  onSubmit,
  onUpdatePartStatus,
}: PartsTrackingModalProps) {
  const [updatingPartId, setUpdatingPartId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [poOrReservation, setPoOrReservation] = useState('');
  const [isSpecialRun, setIsSpecialRun] = useState(false);
  const [carrierDetails, setCarrierDetails] = useState('');
  const [eta, setEta] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !workOrder) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({
        workOrderId: workOrder.id,
        description,
        partNumber: partNumber.trim() || undefined,
        poOrReservation: poOrReservation.trim() || undefined,
        isSpecialRun,
        carrierDetails: isSpecialRun ? carrierDetails.trim() : undefined,
        eta: isSpecialRun && eta ? new Date(eta).toISOString() : undefined,
      });
      setDescription('');
      setPartNumber('');
      setPoOrReservation('');
      setIsSpecialRun(false);
      setCarrierDetails('');
      setEta('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl p-5 text-slate-100 shadow-2xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
          <div>
            <h3 className="text-lg font-bold">Parts for this job</h3>
            <p className="text-sm text-slate-400">
              {workOrder.task_description} · {workOrder.wo_number ? `WO #${workOrder.wo_number}` : 'No SAP WO yet'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white" aria-label="Close">✕</button>
        </div>

        {!!workOrder.parts?.length && (
          <div className="mb-4 space-y-2">
            <h4 className="text-xs uppercase font-semibold text-slate-400">Already logged</h4>
            {workOrder.parts.map((part) => {
              const received = part.status === 'RECEIVED';
              return (
                <div
                  key={part.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-800 border border-slate-700"
                >
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${received ? 'text-slate-400 line-through' : 'text-slate-100'}`}>
                      {part.description}
                      {part.part_number && <span className="ml-2 font-mono text-xs text-slate-400">#{part.part_number}</span>}
                    </p>
                    <p className="text-xs text-slate-400">
                      {PART_STATUS_LABEL[part.status]}
                      {part.eta && !received && ` · ETA ${formatDateTime(part.eta)}`}
                    </p>
                  </div>
                  {received ? (
                    <span className="text-sm font-bold text-emerald-400 shrink-0">✓ Received</span>
                  ) : (
                    onUpdatePartStatus && (
                      <button
                        type="button"
                        disabled={updatingPartId === part.id}
                        onClick={async () => {
                          setUpdatingPartId(part.id);
                          try {
                            await onUpdatePartStatus(part.id, 'RECEIVED');
                          } finally {
                            setUpdatingPartId(null);
                          }
                        }}
                        className="min-h-11 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white shrink-0 disabled:opacity-50"
                      >
                        {updatingPartId === part.id ? 'Saving...' : 'Mark received'}
                      </button>
                    )
                  )}
                </div>
              );
            })}
            <h4 className="pt-2 text-xs uppercase font-semibold text-slate-400">Log another part</h4>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-sm">
          <div>
            <label className="text-xs uppercase font-semibold text-slate-400">Part Description *</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Track tensioner valve cartridge, seal kit"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 mt-1 text-sm focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase font-semibold text-slate-400">Part # (Optional)</label>
              <input
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                placeholder="e.g. 245-8901"
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 mt-1 text-sm"
              />
            </div>
            <div>
              <label className="text-xs uppercase font-semibold text-slate-400">PO / Reservation #</label>
              <input
                value={poOrReservation}
                onChange={(e) => setPoOrReservation(e.target.value)}
                placeholder="e.g. RES-994821"
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 mt-1 text-sm"
              />
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700 p-3 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-amber-400 text-xs uppercase">
              <input
                type="checkbox"
                checked={isSpecialRun}
                onChange={(e) => setIsSpecialRun(e.target.checked)}
                className="h-4 w-4 rounded accent-amber-500"
              />
              ⚡ Special Run / Hotshot Required
            </label>

            {isSpecialRun && (
              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-700">
                <div>
                  <label className="text-xs text-slate-400 uppercase">Carrier / Driver Details</label>
                  <input
                    value={carrierDetails}
                    onChange={(e) => setCarrierDetails(e.target.value)}
                    placeholder="e.g. Toll Hotshot / Driver Dave"
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs mt-1"
                    required={isSpecialRun}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 uppercase">Target ETA</label>
                  <input
                    type="datetime-local"
                    value={eta}
                    onChange={(e) => setEta(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs mt-1"
                    required={isSpecialRun}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 rounded font-semibold text-xs text-white disabled:bg-slate-700">
              {isSubmitting ? 'Saving...' : 'Save Parts Requirement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}