// components/workboard/PartsBadge.tsx - Exactly 52 lines
import React from 'react';
import { Zap, Package } from 'lucide-react';
import { WorkOrderPart } from '@/types';
import { formatDateTime } from '@/utils/helpers';

interface PartsBadgeProps {
  parts?: WorkOrderPart[];
  onClick?: () => void;
}

export default function PartsBadge({ parts, onClick }: PartsBadgeProps) {
  if (!parts || parts.length === 0) return null;

  const hotshotPart = parts.find((p) => p.is_special_run && p.status !== 'RECEIVED');
  const pendingPartsCount = parts.filter((p) => p.status !== 'RECEIVED').length;

  if (pendingPartsCount === 0) return null;

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      {hotshotPart ? (
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg text-sm font-black uppercase tracking-wide bg-amber-500 text-slate-950 border border-amber-600 shadow-2xs hover:bg-amber-400 transition cursor-pointer"
          title={`Carrier: ${hotshotPart.carrier_details || 'Pending'} | ETA: ${hotshotPart.eta || 'TBD'}`}
        >
          <Zap className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
          <span>Hotshot</span>
          {hotshotPart.eta && (
            <span className="font-mono font-bold border-l border-amber-700/40 pl-1 ml-0.5">
              ETA {formatDateTime(hotshotPart.eta)}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg text-sm font-bold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition cursor-pointer"
        >
          <Package className="w-4 h-4 text-amber-600" />
          <span>{pendingPartsCount} part{pendingPartsCount > 1 ? 's' : ''} on order</span>
        </button>
      )}
    </div>
  );
}