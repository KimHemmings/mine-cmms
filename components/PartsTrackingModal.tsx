// components/PartsTrackingModal.tsx - Exactly 105 lines
'use client';

import React, { useState } from 'react';
import { CreatePartPayload, MachineWorkOrder } from '@/types';

interface PartsTrackingModalProps {
  isOpen: boolean;
  workOrder: MachineWorkOrder | null;
  onClose: () => void;
  onSubmit: (payload: CreatePartPayload) => Promise<void>;
}

export default function PartsTrackingModal({
  isOpen,
  workOrder,
  onClose,
  onSubmit,
}: PartsTrackingModalProps) {
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
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl p-5 text-slate-100 shadow-2xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
          <div>
            <h3 className="text-base font-bold">Parts & Special Run Requisition</h3>
            <p className="text-xs text-slate-400">Order: {workOrder.wo_number || 'Unplanned Breakdown'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

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