'use client';

import React from 'react';
import { Wrench, AlertOctagon, FileText, AlertTriangle } from 'lucide-react';
import { OrderType } from '@/types';

interface OrderTypeSelectorProps {
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
}

const ORDER_TYPE_CONFIG: {
  type: OrderType;
  label: string;
  icon: React.ReactNode;
  activeClass: string;
}[] = [
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

export default function OrderTypeSelector({ orderType, setOrderType }: OrderTypeSelectorProps) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1.5">EVENT CLASSIFICATION</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {ORDER_TYPE_CONFIG.map((item) => {
          const isSelected = orderType === item.type;
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => setOrderType(item.type)}
              className={`py-2 px-2.5 rounded-lg border-2 flex items-center justify-center gap-1.5 text-xs font-black transition cursor-pointer ${
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
  );
}