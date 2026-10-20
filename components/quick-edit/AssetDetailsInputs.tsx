'use client';

import React from 'react';
import { MapPin, Shield, FileText, Wrench, AlertTriangle, AlertOctagon } from 'lucide-react';
import { OrderType } from '@/types';

interface AssetDetailsInputsProps {
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
  locationArea: string;
  setLocationArea: (val: string) => void;
  bay: string;
  setBay: (val: string) => void;
  machineOwner: string;
  setMachineOwner: (val: string) => void;
  woNumber: string;
  setWoNumber: (val: string) => void;
}

const EVENT_TYPES: { type: OrderType; label: string; icon: React.ReactNode; activeClass: string }[] = [
  {
    type: 'UNPLANNED',
    label: 'Breakdown',
    icon: <AlertOctagon className="w-3.5 h-3.5" />,
    activeClass: 'bg-rose-50 border-rose-500 text-rose-800 shadow-sm',
  },
  {
    type: 'PLANNED',
    label: 'Planned PM',
    icon: <Wrench className="w-3.5 h-3.5" />,
    activeClass: 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm',
  },
  {
    type: 'INSPECTION',
    label: 'Inspection',
    icon: <FileText className="w-3.5 h-3.5" />,
    activeClass: 'bg-sky-50 border-sky-500 text-sky-800 shadow-sm',
  },
  {
    type: 'ACCIDENT_DAMAGE',
    label: 'Accident Damage',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    activeClass: 'bg-orange-50 border-orange-500 text-orange-800 shadow-sm',
  },
];

export default function AssetDetailsInputs({
  orderType,
  setOrderType,
  locationArea,
  setLocationArea,
  bay,
  setBay,
  machineOwner,
  setMachineOwner,
  woNumber,
  setWoNumber,
}: AssetDetailsInputsProps) {
  return (
    <div className="space-y-3">
      {/* EVENT CLASSIFICATION SWITCHER */}
      <div>
        <label className="block font-bold text-slate-700 mb-1.5">EVENT CLASSIFICATION</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {EVENT_TYPES.map((item) => {
            const isSelected = orderType === item.type;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => setOrderType(item.type)}
                className={`py-1.5 px-2 rounded-lg border-2 flex items-center justify-center gap-1.5 text-xs font-black transition cursor-pointer ${
                  isSelected
                    ? item.activeClass
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SAP WORK ORDER # & MACHINE OWNER */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="flex items-center gap-1 font-bold text-slate-700 mb-1">
            <FileText className="w-3.5 h-3.5 text-indigo-500" /> SAP WORK ORDER #
          </label>
          <input
            type="text"
            placeholder="e.g. 40083501 (Optional)"
            value={woNumber}
            onChange={(e) => setWoNumber(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <div>
          <label className="flex items-center gap-1 font-bold text-slate-700 mb-1">
            <Shield className="w-3.5 h-3.5 text-indigo-500" /> MACHINE OWNER
          </label>
          <select
            value={machineOwner}
            onChange={(e) => setMachineOwner(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="Central">Central Mining</option>
            <option value="South">South Pit</option>
            <option value="North">North Cut</option>
            <option value="Contractor">Contractor Fleet</option>
          </select>
        </div>
      </div>

      {/* LOCATION & BAY */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="flex items-center gap-1 font-bold text-slate-700 mb-1">
            <MapPin className="w-3.5 h-3.5 text-slate-500" /> LOCATION
          </label>
          <input
            type="text"
            placeholder="e.g. Workshop, Pit Bench, Washpad"
            value={locationArea}
            onChange={(e) => setLocationArea(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <div>
          <label className="flex items-center gap-1 font-bold text-slate-700 mb-1">
            <MapPin className="w-3.5 h-3.5 text-slate-500" /> BAY
          </label>
          <input
            type="text"
            placeholder="e.g. Bay 1, Bay 2, Pad B"
            value={bay}
            onChange={(e) => setBay(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
      </div>
    </div>
  );
}