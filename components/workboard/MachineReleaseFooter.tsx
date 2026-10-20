'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface MachineReleaseFooterProps {
  assetId: string;
  openOrdersCount: number;
  canRelease: boolean;
  onRelease: (assetId: string) => void;
}

export default function MachineReleaseFooter({
  assetId,
  openOrdersCount,
  canRelease,
  onRelease,
}: MachineReleaseFooterProps) {
  return (
    <div className="p-3.5 bg-slate-100/90 rounded-b-xl border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs">
        {canRelease ? (
          <span className="text-emerald-700 font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Ready for release. All work orders cleared.
          </span>
        ) : (
          <span className="text-slate-700 font-medium flex items-center gap-1.5">
            Held Down: <strong className="text-slate-900">{openOrdersCount} work order(s)</strong> open.
          </span>
        )}
      </div>

      <button
        type="button"
        disabled={!canRelease}
        onClick={() => onRelease(assetId)}
        className={`px-5 py-2.5 rounded-lg text-xs font-black tracking-wider uppercase transition shadow-sm flex items-center justify-center gap-1.5 ${
          canRelease ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer' : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
        }`}
      >
        <CheckCircle2 className="w-4 h-4" /> Release Machine
      </button>
    </div>
  );
}