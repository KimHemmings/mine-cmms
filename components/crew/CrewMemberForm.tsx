'use client';

import React, { useEffect, useState } from 'react';
import { UserPlus, Save, X } from 'lucide-react';
import { ACCESS_LEVELS, CREW_PANELS, CREW_TRADES, CrewMember, CrewMemberInput } from '@/types';
import { Department, departmentLabel, normalizeAccessLevel } from '@/utils/permissions';

interface CrewMemberFormProps {
  editing: CrewMember | null;
  department: Department;
  defaultPanel: string;
  onSave: (input: CrewMemberInput, id?: string) => Promise<boolean>;
  onClose: () => void;
  onRemove?: () => void;
}

const inputClass =
  'w-full min-h-11 rounded-lg border-2 border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:border-amber-500';

function blank(department: Department, panel: string): CrewMemberInput {
  return { display_name: '', employee_id: '', email: '', department, access_level: 2, trade: 'Fitter', panel };
}

function toInput(member: CrewMember | null, department: Department, defaultPanel: string): CrewMemberInput {
  return member
    ? {
        display_name: member.display_name,
        employee_id: member.employee_id ?? '',
        email: member.email ?? '',
        department,
        access_level: normalizeAccessLevel(member.access_level),
        trade: member.trade,
        panel: member.panel && (CREW_PANELS as readonly string[]).includes(member.panel) ? member.panel : defaultPanel,
      }
    : blank(department, defaultPanel);
}

export default function CrewMemberForm({ editing, department, defaultPanel, onSave, onClose, onRemove }: CrewMemberFormProps) {
  const [form, setForm] = useState<CrewMemberInput>(() => toInput(editing, department, defaultPanel));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (field: keyof CrewMemberInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.display_name.trim()) return;
    setSaving(true);
    const ok = await onSave({ ...form, department }, editing?.id);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl my-8 space-y-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crew-member-title"
      >
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
          <h3 id="crew-member-title" className="text-xl font-black text-slate-900">
            {editing ? 'Edit Crew Member' : 'Add Crew Member'}
          </h3>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-bold text-slate-600">Name *</span>
            <input value={form.display_name} onChange={set('display_name')} placeholder="e.g. Robbie D" className={inputClass} required autoFocus />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-600">Email</span>
            <input type="email" value={form.email ?? ''} onChange={set('email')} placeholder="Optional" className={inputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-600">Employee ID</span>
            <input value={form.employee_id ?? ''} onChange={set('employee_id')} placeholder="Optional" className={`${inputClass} font-mono`} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-600">Department</span>
            <div className={`${inputClass} flex items-center bg-slate-100 text-slate-700`}>{departmentLabel(department)}</div>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-600">Crew</span>
            <select value={form.panel ?? defaultPanel} onChange={set('panel')} className={`${inputClass} cursor-pointer`}>
              {CREW_PANELS.map((panel) => (
                <option key={panel} value={panel}>{panel}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-600">Trade / Role</span>
            <select value={form.trade} onChange={set('trade')} className={`${inputClass} cursor-pointer`}>
              {CREW_TRADES.map((trade) => (
                <option key={trade} value={trade}>{trade}</option>
              ))}
              {form.trade && !(CREW_TRADES as readonly string[]).includes(form.trade) && (
                <option value={form.trade}>{form.trade}</option>
              )}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-600">Access level</span>
            <select
              value={form.access_level}
              onChange={(event) => setForm((prev) => ({ ...prev, access_level: normalizeAccessLevel(Number(event.target.value)) }))}
              className={`${inputClass} cursor-pointer`}
            >
              {ACCESS_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>{level.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
          {editing && onRemove ? (
            <button type="button" onClick={onRemove} className="min-h-11 px-3 text-sm font-bold text-rose-700 hover:text-rose-800">
              Remove from crew
            </button>
          ) : <span />}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onClose} className="min-h-11 px-4 rounded-lg border-2 border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.display_name.trim()}
              className="min-h-11 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black flex items-center gap-2 disabled:opacity-50"
            >
              {editing ? <Save className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Add to crew'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
