'use client';

import React, { useState, useEffect } from 'react';
import { AssetWatchItem } from '@/types';
import { AlertTriangle, Plus, X, CheckCircle2 } from 'lucide-react';
import { ShiftRecord } from '@/types';

interface WatchlistCardProps {
  activeShift: ShiftRecord | null;
}

export default function WatchlistCard({ activeShift }: WatchlistCardProps) {
  const [items, setItems] = useState<AssetWatchItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newFleetId, setNewFleetId] = useState('');
  const [newDefect, setNewDefect] = useState('');
  const [newAction, setNewAction] = useState('');

  // 1. Load persisted data
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('mine_cmms_watchlist');
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse watchlist');
      }
    }
  }, []);

  // 2. Auto-save
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('mine_cmms_watchlist', JSON.stringify(items));
  }, [items]);

  const handleAdd = () => {
    if (!newFleetId || !newDefect || !newAction) return;

    const newItem: AssetWatchItem = {
      id: crypto.randomUUID(),
      fleet_id: newFleetId.toUpperCase(),
      date_logged: new Date().toLocaleDateString(),
      issue_description: newDefect,
      inspection_action: newAction,
    };

    setItems((prev) => [...prev, newItem]);
    setNewFleetId('');
    setNewDefect('');
    setNewAction('');
    setIsAdding(false);
  };

  const handleClear = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="bg-white border border-amber-200 rounded-xl shadow-sm print:border-black print:shadow-none overflow-hidden font-sans">
      <div className="bg-amber-50/50 p-3 border-b border-amber-200 flex items-center justify-between print:bg-white print:border-black">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <h3 className="text-xs font-black uppercase tracking-wider text-amber-900">
            Machines on 12-Hr Watchlist (Running with Defects)
          </h3>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-white border border-amber-300 text-amber-700 px-2 py-1 rounded hover:bg-amber-100 transition print:hidden cursor-pointer"
        >
          <Plus className="w-3 h-3" /> Add Machine
        </button>
      </div>

      <div className="p-3">
        {isAdding && (
          <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap gap-2 items-end print:hidden">
            <div className="flex-1 min-w-30">
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Fleet ID</label>
              <input type="text" value={newFleetId} onChange={(e) => setNewFleetId(e.target.value)} placeholder="e.g. DT-041" className="w-full text-xs p-1.5 border border-slate-300 rounded" />
            </div>
            <div className="flex-1 min-w-50">
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Defect / Condition</label>
              <input type="text" value={newDefect} onChange={(e) => setNewDefect(e.target.value)} placeholder="e.g. LH strut weep" className="w-full text-xs p-1.5 border border-slate-300 rounded" />
            </div>
            <div className="flex-1 min-w-50">
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Mandatory Hot-Seat Action</label>
              <input type="text" value={newAction} onChange={(e) => setNewAction(e.target.value)} placeholder="e.g. Check collar & pressure" className="w-full text-xs p-1.5 border border-slate-300 rounded" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAdd} className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded hover:bg-amber-700 cursor-pointer">Save</button>
              <button onClick={() => setIsAdding(false)} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 text-xs font-bold rounded hover:bg-slate-50 cursor-pointer">Cancel</button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            No units flagged on deferred defect watch. Pit fleet operating within standard parameters.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] font-black uppercase text-slate-500 border-b border-slate-200 print:text-black print:border-black">
              <tr>
                <th className="py-2">Fleet ID</th>
                <th className="py-2">Defect / Condition</th>
                <th className="py-2">Mandatory Hot-Seat Action</th>
                <th className="py-2">Logged</th>
                <th className="py-2 text-right print:hidden">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 print:divide-black">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="py-2 font-bold text-slate-900">{item.fleet_id}</td>
                  <td className="py-2 text-slate-700">{item.issue_description}</td>
                  <td className="py-2 text-amber-800 font-medium">{item.inspection_action}</td>
                  <td className="py-2 text-slate-500 text-[10px]">{item.date_logged}</td>
                  <td className="py-2 text-right print:hidden">
                    <button onClick={() => handleClear(item.id)} className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer" title="Clear Watch Item">
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}