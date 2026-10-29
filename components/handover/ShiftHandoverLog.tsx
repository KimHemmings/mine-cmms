'use client';

import React, { useState, useEffect } from 'react';
import { HandoverLogEntry, HandoverLogCategory } from '@/types';
import { Plus, Trash2, ClipboardList, AlertTriangle } from 'lucide-react';

const CATEGORY_CONFIG: Record<
  HandoverLogCategory,
  { label: string; bg: string; text: string; border: string }
> = {
  SAFETY: { label: 'Safety & Hazards', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  WEATHER: { label: 'Weather & Roads', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  MANNING: { label: 'Manning & Crew', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  WATCHLIST: { label: '12-Hr Watch', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' },
  BRAKE_TEST: { label: 'Brake Test', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' },
  TOOLING: { label: 'Tooling & Rigging', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  PRIORITY: { label: 'Shift Priority', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
};

interface ShiftHandoverLogProps {
  entries: HandoverLogEntry[];
  onAddEntry: (entry: Omit<HandoverLogEntry, 'id' | 'logged_at'>) => void;
  onUpdateCategory: (id: string, category: HandoverLogCategory) => void;
  onDeleteEntry: (id: string) => void;
}

export default function ShiftHandoverLog({
  entries,
  onAddEntry,
  onUpdateCategory,
  onDeleteEntry,
}: ShiftHandoverLogProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [category, setCategory] = useState<HandoverLogCategory>('SAFETY');
  const [fleetId, setFleetId] = useState('');
  const [details, setDetails] = useState('');
  const [actionRequired, setActionRequired] = useState('');

  const handleSave = () => {
    if (!details.trim()) return;
    onAddEntry({
      category,
      fleet_id: fleetId.trim() ? fleetId.toUpperCase() : undefined,
      details,
      action_required: actionRequired.trim() ? actionRequired : undefined,
    });
    setFleetId('');
    setDetails('');
    setActionRequired('');
    setIsAdding(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm print:border-black print:shadow-none overflow-hidden font-sans">
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between print:bg-white print:border-black">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-slate-700" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 print:text-black">
            Shift Handover & Compliance Register
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-white border border-slate-300 text-slate-700 px-2.5 py-1 rounded hover:bg-slate-100 transition print:hidden cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-amber-600" /> Add Entry
        </button>
      </div>

      {isAdding && (
        <div className="p-3 bg-amber-50/40 border-b border-amber-200 flex flex-wrap gap-2 items-end print:hidden">
          <div className="w-40">
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as HandoverLogCategory)}
              className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded focus:outline-none"
            >
              {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>

          <div className="w-28">
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Fleet ID (Opt)</label>
            <input
              type="text"
              placeholder="e.g. DT-041"
              value={fleetId}
              onChange={(e) => setFleetId(e.target.value)}
              className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded focus:outline-none"
            />
          </div>

          <div className="flex-1 min-w-50">
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Details / Condition</label>
            <input
              type="text"
              placeholder="e.g. Pit 27 closed due to wet conditions, or strut weep observed"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded focus:outline-none"
            />
          </div>

          <div className="flex-1 min-w-50">
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Action / Check Required</label>
            <input
              type="text"
              placeholder="e.g. Check nitrogen collar at changeover, order seal kit"
              value={actionRequired}
              onChange={(e) => setActionRequired(e.target.value)}
              className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded hover:bg-amber-700 cursor-pointer"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 text-xs font-bold rounded hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        {entries.length === 0 ? (
          <div className="p-4 text-xs text-slate-500 italic text-center">
            Zero compliance or situational items logged. Click "+ Add Entry" or flag equipment from the Workboard.
          </div>
        ) : (
          <table className="w-full text-left text-xs text-slate-800 print:text-[10px]">
            <thead className="bg-slate-50 print:bg-gray-100 text-[10px] font-black uppercase text-slate-500 print:text-black border-b border-slate-200 print:border-black">
              <tr>
                <th className="p-2.5 w-36">Category</th>
                <th className="p-2.5 w-24">Fleet ID</th>
                <th className="p-2.5">Details / Condition</th>
                <th className="p-2.5">Mandatory Action / Follow-up</th>
                <th className="p-2.5 w-20 text-right print:hidden">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 print:divide-black">
              {entries.map((item) => {
                const cfg = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.SAFETY;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/60">
                    <td className="p-2.5">
                      <select
                        value={item.category}
                        onChange={(e) => onUpdateCategory(item.id, e.target.value as HandoverLogCategory)}
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${cfg.bg} ${cfg.text} ${cfg.border} print:border-none print:bg-transparent print:p-0 cursor-pointer`}
                      >
                        {Object.entries(CATEGORY_CONFIG).map(([k, c]) => (
                          <option key={k} value={k}>{c.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2.5 font-black text-slate-900 print:text-black">
                      {item.fleet_id || <span className="text-slate-400 font-normal italic">Site-wide</span>}
                    </td>
                    <td className="p-2.5 text-slate-700 print:text-black">{item.details}</td>
                    <td className="p-2.5 font-medium text-amber-900 print:text-black">
                      {item.action_required || '-'}
                    </td>
                    <td className="p-2.5 text-right print:hidden">
                      <button
                        type="button"
                        onClick={() => onDeleteEntry(item.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition cursor-pointer"
                        title="Remove Entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}