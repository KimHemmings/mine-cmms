'use client';

import React from 'react';
import { CheckCircle2, Plus, Lock } from 'lucide-react';

interface MachineReleaseFooterProps {
  openOrdersCount: number;
  canRelease: boolean;
  isReleased: boolean;
  onRelease: () => void;
  onAddWorkOrder?: () => void;
}

export default function MachineReleaseFooter({
  openOrdersCount,
  canRelease,
  isReleased,
  onRelease,
  onAddWorkOrder,
}: MachineReleaseFooterProps) {
  if (isReleased) {
    return (
      <div className="p-4 bg-slate-100/90 border-t border-slate-200 text-sm font-bold text-slate-600 flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Released to production
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-100/90 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="text-sm">
        {canRelease ? (
          <span className="text-emerald-700 font-bold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" /> All jobs done. Ready to release.
          </span>
        ) : (
          <span className="text-slate-700 font-semibold flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-500" />
            {openOrdersCount} job{openOrdersCount === 1 ? '' : 's'} still open. Complete {openOrdersCount === 1 ? 'it' : 'them'} to release.
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        {onAddWorkOrder && (
          <button
            type="button"
            onClick={onAddWorkOrder}
            className="min-h-12 px-4 rounded-lg text-sm font-bold transition shadow-sm flex items-center justify-center gap-1.5 bg-white hover:bg-indigo-50 border-2 border-indigo-200 text-indigo-700 hover:text-indigo-800"
          >
            <Plus className="w-4 h-4" /> Add Work Order
          </button>
        )}

        <button
          type="button"
          disabled={!canRelease}
          onClick={onRelease}
          className={`min-h-12 px-5 rounded-lg text-sm font-black tracking-wider uppercase transition shadow-sm flex items-center justify-center gap-1.5 ${
            canRelease ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer' : 'bg-slate-300 text-slate-500 cursor-not-allowed'
          }`}
        >
          <CheckCircle2 className="w-5 h-5" /> Release Machine
        </button>
      </div>
    </div>
  );
}
