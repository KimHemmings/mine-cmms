'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { formatDateTime } from '@/utils/helpers';

const LABEL: Record<string, string> = {
  operator_passouts: 'Pass-out',
  crew_supervision: 'Supervision',
  crew_authorisations: 'Authorisation',
  shift_handovers: 'Workshop handover',
  production_handovers: 'Production handover',
  oce_reports: 'OCE report',
};

interface RecordEvent {
  id: string;
  table_name: string;
  action: string;
  previous: Record<string, unknown> | null;
  next: Record<string, unknown> | null;
  changed_by: string | null;
  changed_at: string;
}

function detail(row: RecordEvent) {
  const previous = row.previous ?? {};
  const next = row.next ?? {};
  if (typeof previous.expires_on === 'string' || typeof next.expires_on === 'string') {
    return `${previous.expires_on ?? 'none'} → ${next.expires_on ?? 'removed'}`;
  }
  if (typeof next.level === 'string') {
    return `${next.level} · ${typeof next.skill === 'string' ? next.skill : ''}`.trim();
  }
  if (typeof next.file_name === 'string') return next.file_name;
  if (typeof next.shift_name === 'string') return `${next.shift_name}${row.action === 'update' ? ' · saved again' : ''}`;
  return row.action;
}

export default function RecordTrail({ tables, title }: { tables: string[]; title: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<RecordEvent[]>([]);

  const tableKey = tables.join('|');
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('record_events')
      .select('id, table_name, action, previous, next, changed_by, changed_at')
      .in('table_name', tableKey.split('|'))
      .order('changed_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setRows((data ?? []) as RecordEvent[]);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, tableKey]);

  return (
    <section className="bg-white border border-slate-300 rounded-2xl p-4 shadow-sm space-y-2">
      <h2 className="text-lg font-black text-slate-900">{title}</h2>
      <p className="text-sm text-slate-600">Each save keeps the previous value. This list is the last 20 changes.</p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No changes recorded yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
          {rows.map((row) => (
            <li key={row.id} className="px-3 py-2 text-sm">
              <span className="font-bold">{LABEL[row.table_name] ?? row.table_name}</span>
              <span className="text-slate-600"> · {detail(row)}</span>
              <span className="block text-xs text-slate-500">
                {formatDateTime(row.changed_at)}{row.changed_by ? ` · ${row.changed_by}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
