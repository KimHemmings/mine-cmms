'use client';

import React, { useState } from 'react';
import { UserPlus, Save } from 'lucide-react';
import { CREW_DEPARTMENTS, CREW_PANELS, CREW_TRADES, CrewMember, CrewMemberInput } from '@/types';

interface CrewMemberFormProps {
  editing: CrewMember | null;
  onSave: (input: CrewMemberInput, id?: string) => Promise<boolean>;
  onCancelEdit: () => void;
}

const inputClass =
  'w-full min-h-11 rounded-lg border-2 border-slate-300 bg-slate-50 px-3 text-base text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white';

const EMPTY: CrewMemberInput = { display_name: '', employee_id: '', department: 'Workshop', trade: 'Fitter', panel: '' };

function toInput(member: CrewMember | null): CrewMemberInput {
  return member
    ? { display_name: member.display_name, employee_id: member.employee_id ?? '', department: member.department || 'Workshop', trade: member.trade, panel: member.panel ?? '' }
    : EMPTY;
}

export default function CrewMemberForm({ editing, onSave, onCancelEdit }: CrewMemberFormProps) {
  const [form, setForm] = useState<CrewMemberInput>(() => toInput(editing));
  const [saving, setSaving] = useState(false);

  const set = (field: keyof CrewMemberInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.display_name.trim()) return;
    setSaving(true);
    const ok = await onSave(form, editing?.id);
    setSaving(false);
    if (ok) {
      setForm(EMPTY);
      if (editing) onCancelEdit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 space-y-3">
      <h4 className="text-sm font-black uppercase tracking-wide text-slate-700">
        {editing ? `Edit ${editing.display_name}` : 'Add a person to the crew'}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-600">Name *</span>
          <input value={form.display_name} onChange={set('display_name')} placeholder="e.g. Robbie D" className={inputClass} required />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-600">Employee ID</span>
          <input value={form.employee_id ?? ''} onChange={set('employee_id')} placeholder="Optional" className={`${inputClass} font-mono`} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-600">Department</span>
          <select value={form.department} onChange={set('department')} className={`${inputClass} cursor-pointer`}>
            {CREW_DEPARTMENTS.map((department) => (
              <option key={department} value={department}>{department}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-600">Trade</span>
          <select value={form.trade} onChange={set('trade')} className={`${inputClass} cursor-pointer`}>
            {CREW_TRADES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-600">Panel</span>
          <select value={form.panel ?? ''} onChange={set('panel')} className={`${inputClass} cursor-pointer`}>
            <option value="">No panel</option>
            {CREW_PANELS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving || !form.display_name.trim()}
          className="min-h-11 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black flex items-center gap-2 disabled:opacity-50"
        >
          {editing ? <Save className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          {saving ? 'Saving...' : editing ? 'Save changes' : 'Add to crew'}
        </button>
        {editing && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="min-h-11 px-4 rounded-lg border-2 border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
