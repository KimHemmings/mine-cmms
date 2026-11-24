'use client';

import React, { useState, useEffect, useRef } from 'react';
import { HandoverLogEntry, HandoverLogCategory } from '@/types';
import { Plus, Trash2, ClipboardList, AlertTriangle, Printer } from 'lucide-react';
import DictationMicButton, { useDictationTarget } from '@/components/ui/DictationMicButton';
import ManagementDirectives from '@/components/ManagementDirectives';
import { clearHandoverDraft, handoverDraftKey, readHandoverDraft, writeHandoverDraft } from '@/utils/handoverDraft';

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
  onAddEntry: (entry: Omit<HandoverLogEntry, 'id' | 'logged_at'>) => void | Promise<boolean | void>;
  onUpdateCategory: (id: string, category: HandoverLogCategory) => void;
  onDeleteEntry: (id: string) => void;
  manning?: {
    panel: string | null;
    onShift: string[];
    away: string[];
    overtime: string[];
    unallocated: string[];
    assigned: string[];
  } | null;
  signers?: { id: string; name: string }[];
  outgoingId?: string;
  oncomingId?: string;
  onOutgoing?: (id: string) => void;
  onOncoming?: (id: string) => void;
  readOnly?: boolean;
  actorName?: string;
  shiftDate?: string | null;
  shiftName?: string | null;
  department?: string;
  canPrint?: boolean;
}

export default function ShiftHandoverLog({
  entries,
  onAddEntry,
  onUpdateCategory,
  onDeleteEntry,
  manning = null,
  signers = [],
  outgoingId = '',
  oncomingId = '',
  onOutgoing,
  onOncoming,
  readOnly = false,
  actorName = 'Supervisor',
  shiftDate = null,
  shiftName = null,
  department = 'workshop',
  canPrint = false,
}: ShiftHandoverLogProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [category, setCategory] = useState<HandoverLogCategory>('SAFETY');
  const [fleetId, setFleetId] = useState('');
  const detailsField = useDictationTarget();
  const details = detailsField.value;
  const [actionRequired, setActionRequired] = useState('');
  const draftKey = shiftDate && shiftName ? handoverDraftKey(shiftDate, shiftName, department) : '';
  const skipDraftWrite = useRef(0);

  useEffect(() => {
    if (!draftKey) return;
    const draft = readHandoverDraft<{ category: HandoverLogCategory; fleetId: string; details: string; actionRequired: string; isAdding: boolean }>(draftKey);
    if (!draft) return;
    skipDraftWrite.current += 1;
    setCategory(draft.category);
    setFleetId(draft.fleetId);
    detailsField.setValue(draft.details);
    setActionRequired(draft.actionRequired);
    setIsAdding(draft.isAdding);
    // Restore once per shift. setValue changes identity every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    if (skipDraftWrite.current > 0) {
      skipDraftWrite.current -= 1;
      return;
    }
    if (!details && !fleetId && !actionRequired) {
      clearHandoverDraft(draftKey);
      return;
    }
    writeHandoverDraft(draftKey, { category, fleetId, details, actionRequired, isAdding: true });
  }, [draftKey, category, fleetId, details, actionRequired]);

  const handleSave = async () => {
    if (!details.trim()) return;
    const saved = await onAddEntry({
      category,
      fleet_id: fleetId.trim() ? fleetId.toUpperCase() : undefined,
      details,
      action_required: actionRequired.trim() ? actionRequired : undefined,
    });
    if (saved === false) return;
    if (draftKey) clearHandoverDraft(draftKey);
    skipDraftWrite.current += 1;
    setFleetId('');
    detailsField.setValue('');
    setActionRequired('');
    setIsAdding(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm print:border-black print:shadow-none overflow-hidden font-sans">
      <div className="p-3 border-b border-slate-200">
        <ManagementDirectives actorName={actorName} department="workshop" />
      </div>
      {manning && (
        <div className="p-3 border-b border-slate-200 bg-white space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
            Workshop crew{manning.panel ? ` · ${manning.panel}` : ''}
          </h3>
          <ManningLine title={`On-shift trades (${manning.onShift.length})`} names={manning.onShift} empty="No workshop trades are on this crew." />
          <ManningLine title="Away / sick / leave" names={manning.away} empty="No one from the workshop is away." />
          <ManningLine title="Overtime and labour hire" names={manning.overtime} empty="No workshop overtime or labour hire on this crew." />
          <ManningLine title="Unallocated" names={manning.unallocated} empty="Every workshop trade on this crew is on a job." />
          <ManningLine title="Bay-assigned" names={manning.assigned} empty="No workshop trade is on a job yet." />
          <div className="grid gap-3 sm:grid-cols-2">
            <SignOffSelect label="Outgoing" people={signers} value={outgoingId} disabled={readOnly} onChange={onOutgoing} />
            <SignOffSelect label="Oncoming" people={signers} value={oncomingId} disabled={readOnly} onChange={onOncoming} />
          </div>
        </div>
      )}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between print:bg-white print:border-black">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-slate-700" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 print:text-black">
            Shift Handover & Compliance Register
          </h3>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          {canPrint && (
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-slate-900 text-white px-2.5 py-1 rounded cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Print Handover
            </button>
          )}
          {!readOnly && <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-white border border-slate-300 text-slate-700 px-2.5 py-1 rounded hover:bg-slate-100 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-amber-600" /> Add Entry
          </button>}
        </div>
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
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="text-[10px] font-bold uppercase text-slate-600">Details / Condition</label>
              <DictationMicButton {...detailsField.mic} />
            </div>
            <input
              type="text"
              placeholder="e.g. Pit 27 closed due to wet conditions, or strut weep observed"
              value={details}
              onChange={detailsField.onChange}
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
                      {!readOnly && <button
                        type="button"
                        onClick={() => onDeleteEntry(item.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition cursor-pointer"
                        title="Remove Entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>}
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

function ManningLine({ title, names, empty }: { title: string; names: string[]; empty: string }) {
  return (
    <p className="text-sm text-slate-800">
      <span className="font-black">{title}. </span>
      {names.length === 0 ? empty : names.join(', ')}
    </p>
  );
}

function SignOffSelect({
  label,
  people,
  value,
  disabled,
  onChange,
}: {
  label: string;
  people: { id: string; name: string }[];
  value: string;
  disabled?: boolean;
  onChange?: (id: string) => void;
}) {
  return (
    <label className="block text-xs font-black uppercase tracking-wide text-slate-600">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        className="mt-1 block w-full min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold normal-case text-slate-900 disabled:bg-slate-100"
      >
        <option value="">Workshop supervisor, leading hand, or tradesperson</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>{person.name}</option>
        ))}
      </select>
    </label>
  );
}