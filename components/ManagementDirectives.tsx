'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export interface ManagementDirective {
  id: string;
  target_department: 'production' | 'workshop' | 'training';
  title: string;
  details: string | null;
  priority: 'Critical' | 'High' | 'Normal';
  status: 'Open' | 'Resolved';
  created_by: string;
  created_at: string;
  resolved_by: string | null;
  resolved_at: string | null;
}

const PRIORITY_CLASS: Record<ManagementDirective['priority'], string> = {
  Critical: 'bg-rose-700 text-white',
  High: 'bg-amber-500 text-amber-950',
  Normal: 'bg-slate-200 text-slate-800',
};

export default function ManagementDirectives({
  actorName,
  department,
  canIssue = false,
  lockDepartment = false,
  submitLabel = 'Send directive',
}: {
  actorName: string;
  department?: ManagementDirective['target_department'];
  canIssue?: boolean;
  lockDepartment?: boolean;
  submitLabel?: string;
}) {
  const [rows, setRows] = useState<ManagementDirective[]>([]);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [target, setTarget] = useState<ManagementDirective['target_department']>(department ?? 'production');
  const [priority, setPriority] = useState<ManagementDirective['priority']>('High');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const supabase = createClient();
    let query = supabase.from('management_directives').select('*').eq('status', 'Open').order('created_at', { ascending: false });
    if (department) query = query.eq('target_department', department);
    const { data, error: loadError } = await query;
    if (loadError) {
      setError('Directives are not available yet.');
      return;
    }
    setError('');
    setRows((data ?? []) as ManagementDirective[]);
  };

  useEffect(() => {
    if (department) setTarget(department);
    void load();
  }, [department]);

  const issue = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { error: insertError } = await supabase.from('management_directives').insert({
      target_department: target,
      title: title.trim(),
      details: details.trim() || null,
      priority,
      created_by: actorName || 'Management',
    });
    setSaving(false);
    if (insertError) {
      setError('That directive did not save.');
      return;
    }
    setTitle('');
    setDetails('');
    await load();
  };

  const resolve = async (row: ManagementDirective) => {
    const supabase = createClient();
    const { error: updateError } = await supabase.from('management_directives').update({
      status: 'Resolved',
      resolved_by: actorName || 'Supervisor',
      resolved_at: new Date().toISOString(),
    }).eq('id', row.id);
    if (updateError) {
      setError('That directive did not close.');
      return;
    }
    await load();
  };

  return (
    <section className="rounded-xl border border-slate-300 bg-white p-4 space-y-3">
      <h2 className="text-sm font-black uppercase tracking-wide text-slate-800">Management directives</h2>
      {error && <p className="text-sm font-bold text-rose-700">{error}</p>}
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No open directives{department ? ` for ${department}` : ''}.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900">
                  <span className={`mr-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${PRIORITY_CLASS[row.priority]}`}>{row.priority}</span>
                  {row.title}
                </p>
                <p className="text-xs font-bold text-slate-500">{row.target_department} · {row.created_by}</p>
                {row.details && <p className="mt-1 text-sm text-slate-700">{row.details}</p>}
              </div>
              <button type="button" onClick={() => void resolve(row)} className="min-h-9 shrink-0 rounded-lg border border-slate-300 px-3 text-xs font-black text-slate-800">
                Mark resolved
              </button>
            </li>
          ))}
        </ul>
      )}
      {canIssue && (
        <form onSubmit={(event) => void issue(event)} className="grid gap-2 border-t border-slate-200 pt-3 md:grid-cols-2">
          {lockDepartment ? (
            <p className="text-xs font-bold text-slate-600">Department <span className="mt-1 block text-sm font-black capitalize text-slate-900">{target}</span></p>
          ) : (
          <label className="text-xs font-bold text-slate-600">
            Department
            <select value={target} onChange={(event) => setTarget(event.target.value as ManagementDirective['target_department'])} className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 px-2 text-sm font-bold text-slate-900">
              <option value="production">Production</option>
              <option value="workshop">Workshop</option>
              <option value="training">Training</option>
            </select>
          </label>
          )}
          <label className="text-xs font-bold text-slate-600">
            Priority
            <select value={priority} onChange={(event) => setPriority(event.target.value as ManagementDirective['priority'])} className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 px-2 text-sm font-bold text-slate-900">
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Normal">Normal</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 md:col-span-2">
            Directive
            <input value={title} onChange={(event) => setTitle(event.target.value)} required className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 px-2 text-sm text-slate-900" />
          </label>
          <label className="text-xs font-bold text-slate-600 md:col-span-2">
            Details
            <textarea value={details} onChange={(event) => setDetails(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-900" />
          </label>
          <button type="submit" disabled={saving || !title.trim()} className="min-h-10 rounded-lg bg-slate-900 px-3 text-sm font-black text-white disabled:opacity-50 md:col-span-2">
            {saving ? 'Sending...' : submitLabel}
          </button>
        </form>
      )}
    </section>
  );
}
