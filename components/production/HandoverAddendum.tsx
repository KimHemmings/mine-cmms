'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { formatDateTime } from '@/utils/helpers';

interface Amendment {
  id: string;
  amended_by: string;
  amendment_note: string;
  created_at: string;
}

export default function HandoverAddendum({
  handoverId,
  actorName,
  canAdd,
}: {
  handoverId: string | null;
  actorName: string;
  canAdd: boolean;
}) {
  const [rows, setRows] = useState<Amendment[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!handoverId) return;
    const supabase = createClient();
    void supabase
      .from('handover_amendments')
      .select('id, amended_by, amendment_note, created_at')
      .eq('handover_id', handoverId)
      .order('created_at', { ascending: true })
      .then(({ data, error: loadError }) => {
        if (loadError) {
          setError('Addendums could not be loaded.');
          return;
        }
        setError('');
        setRows((data ?? []) as Amendment[]);
      });
  }, [handoverId]);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const text = note.trim();
    if (!text || !handoverId || !canAdd) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from('handover_amendments')
      .insert({ handover_id: handoverId, amended_by: actorName || 'Supervisor', amendment_note: text })
      .select('id, amended_by, amendment_note, created_at')
      .single();
    setSaving(false);
    if (insertError || !data) {
      setError('That addendum did not save.');
      return;
    }
    setError('');
    setNote('');
    setRows((current) => [...current, data as Amendment]);
  };

  return (
    <section className="rounded-xl border border-amber-400 bg-amber-50 p-4 space-y-3">
      <p className="text-sm font-black uppercase tracking-wide text-amber-950">STATUTORY RECORD LOCKED (SIGNED OFF)</p>
      <p className="text-sm text-amber-950">The signed checks stay as they were. A later note is an addendum under the signatures.</p>
      {rows.length > 0 && (
        <ol className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-lg border border-amber-200 bg-white px-3 py-2">
              <p className="text-sm text-slate-900 whitespace-pre-wrap">{row.amendment_note}</p>
              <p className="mt-1 text-[11px] font-bold text-slate-500">{row.amended_by} · {formatDateTime(row.created_at)}</p>
            </li>
          ))}
        </ol>
      )}
      {error && <p className="text-sm font-bold text-rose-700">{error}</p>}
      {canAdd && (
        <form onSubmit={(event) => void add(event)} className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            Add Post-Sign-Off Addendum
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <button type="submit" disabled={saving || !note.trim() || !handoverId} className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-50">
            {saving ? 'Saving...' : 'Add Post-Sign-Off Addendum'}
          </button>
        </form>
      )}
    </section>
  );
}
