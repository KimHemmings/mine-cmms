'use client';

import React from 'react';

interface SapDetailsInputsProps {
  workOrderNum: string;
  setWorkOrderNum: (val: string) => void;
  sapNotification: string;
  setSapNotification: (val: string) => void;
}

export default function SapDetailsInputs({
  workOrderNum,
  setWorkOrderNum,
  sapNotification,
  setSapNotification,
}: SapDetailsInputsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          SAP WORK ORDER # <span className="font-normal text-slate-400">(Optional)</span>
        </label>
        <input
          type="text"
          placeholder="e.g. 40082910"
          value={workOrderNum}
          onChange={(e) => setWorkOrderNum(e.target.value)}
          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          SAP NOTIF # <span className="font-normal text-slate-400">(Optional)</span>
        </label>
        <input
          type="text"
          placeholder="e.g. 1004821"
          value={sapNotification}
          onChange={(e) => setSapNotification(e.target.value)}
          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>
    </div>
  );
}