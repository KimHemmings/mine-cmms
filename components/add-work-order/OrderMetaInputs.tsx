'use client';

import React from 'react';
import { ORDER_TYPES } from '@/types';

interface OrderMetaInputsProps {
  orderType: string;
  setOrderType: (val: string) => void;
  woNumber: string;
  setWoNumber: (val: string) => void;
  notificationNum: string;
  setNotificationNum: (val: string) => void;
}

export default function OrderMetaInputs({
  orderType,
  setOrderType,
  woNumber,
  setWoNumber,
  notificationNum,
  setNotificationNum,
}: OrderMetaInputsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          ORDER TYPE
        </label>
        <select
          value={orderType}
          onChange={(e) => setOrderType(e.target.value)}
          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer"
        >
          {ORDER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          SAP WORK ORDER # <span className="font-normal text-slate-400">(Optional)</span>
        </label>
        <input
          type="text"
          placeholder="e.g. 40082915 (Optional)"
          value={woNumber}
          onChange={(e) => setWoNumber(e.target.value)}
          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          SAP NOTIF # <span className="font-normal text-slate-400">(Optional)</span>
        </label>
        <input
          type="text"
          placeholder="e.g. 1004830"
          value={notificationNum}
          onChange={(e) => setNotificationNum(e.target.value)}
          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>
    </div>
  );
}