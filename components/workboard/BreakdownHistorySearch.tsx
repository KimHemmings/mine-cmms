'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Asset, COMPONENT_SYSTEMS } from '@/types';
import { formatDateTime } from '@/utils/helpers';

export interface BreakdownHistoryFilters {
  fleetId: string;
  component: string;
  from: string;
  to: string;
  keyword: string;
}

export const EMPTY_BREAKDOWN_HISTORY_FILTERS: BreakdownHistoryFilters = {
  fleetId: '',
  component: '',
  from: '',
  to: '',
  keyword: '',
};

/** Add a field here when the history search needs another filter. */
export const BREAKDOWN_HISTORY_FIELDS = [
  { key: 'fleetId', label: 'Machine', kind: 'fleet' },
  { key: 'component', label: 'Component', kind: 'component' },
  { key: 'from', label: 'From', kind: 'date' },
  { key: 'to', label: 'To', kind: 'date' },
  { key: 'keyword', label: 'Failure or keyword', kind: 'text' },
] as const satisfies readonly { key: keyof BreakdownHistoryFilters; label: string; kind: string }[];

interface HistoryHit {
  id: string;
  when: string;
  fleetId: string;
  kind: 'Work order' | 'Defect' | 'Note';
  summary: string;
}

const fieldClass = 'min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold text-slate-900';

export default function BreakdownHistorySearch({ assets }: { assets: Asset[] }) {
  const [filters, setFilters] = useState<BreakdownHistoryFilters>(EMPTY_BREAKDOWN_HISTORY_FILTERS);
  const [hits, setHits] = useState<HistoryHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const fleetIds = [...new Set(assets.map((asset) => asset.fleet_id))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  function setFilter<K extends keyof BreakdownHistoryFilters>(key: K, value: BreakdownHistoryFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function closeHistory() {
    setFilters(EMPTY_BREAKDOWN_HISTORY_FILTERS);
    setHits(null);
    setError('');
  }

  async function search() {
    setSearching(true);
    setError('');
    const supabase = createClient();
    const assetId = filters.fleetId ? assets.find((asset) => asset.fleet_id === filters.fleetId)?.id : null;
    const from = filters.from ? `${filters.from}T00:00:00` : null;
    const to = filters.to ? `${filters.to}T23:59:59` : null;

    let orders = supabase.from('machine_work_orders').select('id, asset_id, task_description, component_systems, created_at, status').order('created_at', { ascending: false }).limit(40);
    let defects = supabase.from('defect_watchlist').select('id, asset_id, description, component_systems, created_at').order('created_at', { ascending: false }).limit(40);
    let notes = supabase.from('asset_history_notes').select('id, asset_id, note, created_at').order('created_at', { ascending: false }).limit(40);

    if (assetId) {
      orders = orders.eq('asset_id', assetId);
      defects = defects.eq('asset_id', assetId);
      notes = notes.eq('asset_id', assetId);
    }
    if (from) {
      orders = orders.gte('created_at', from);
      defects = defects.gte('created_at', from);
      notes = notes.gte('created_at', from);
    }
    if (to) {
      orders = orders.lte('created_at', to);
      defects = defects.lte('created_at', to);
      notes = notes.lte('created_at', to);
    }
    if (filters.component) {
      orders = orders.contains('component_systems', [filters.component]);
      defects = defects.contains('component_systems', [filters.component]);
      notes = notes.ilike('note', `%${filters.component}%`);
    }
    if (filters.keyword.trim()) {
      const term = `%${filters.keyword.trim()}%`;
      orders = orders.ilike('task_description', term);
      defects = defects.ilike('description', term);
      notes = notes.ilike('note', term);
    }

    const [orderResult, defectResult, noteResult] = await Promise.all([orders, defects, notes]);
    setSearching(false);
    if (orderResult.error && defectResult.error && noteResult.error) {
      setError('Could not load history.');
      setHits([]);
      return;
    }

    const fleetFor = (id: string) => assets.find((asset) => asset.id === id)?.fleet_id ?? 'Machine';
    const rows: HistoryHit[] = [
      ...(orderResult.data ?? []).map((row) => ({
        id: `wo-${row.id}`,
        when: row.created_at,
        fleetId: fleetFor(row.asset_id),
        kind: 'Work order' as const,
        summary: row.task_description || 'Work order',
      })),
      ...(defectResult.data ?? []).map((row) => ({
        id: `defect-${row.id}`,
        when: row.created_at,
        fleetId: fleetFor(row.asset_id),
        kind: 'Defect' as const,
        summary: row.description || 'Defect',
      })),
      ...(noteResult.data ?? []).map((row) => ({
        id: `note-${row.id}`,
        when: row.created_at,
        fleetId: fleetFor(row.asset_id),
        kind: 'Note' as const,
        summary: row.note,
      })),
    ].sort((a, b) => b.when.localeCompare(a.when));
    setHits(rows);
  }

  return (
    <div className="space-y-3 border-t border-slate-200 pt-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-sm font-black text-slate-900">Breakdown and maintenance history</p>
        {hits && (
          <button type="button" onClick={closeHistory} className="min-h-10 px-3 rounded-lg border border-slate-300 text-sm font-bold text-slate-800">
            Clear / Close history
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {BREAKDOWN_HISTORY_FIELDS.map((field) => {
          if (field.kind === 'fleet') {
            return (
              <label key={field.key} className="text-xs font-bold text-slate-600">
                {field.label}
                <select value={filters.fleetId} onChange={(event) => setFilter('fleetId', event.target.value)} className={`mt-1 block ${fieldClass}`}>
                  <option value="">All machines</option>
                  {fleetIds.map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
              </label>
            );
          }
          if (field.kind === 'component') {
            return (
              <label key={field.key} className="text-xs font-bold text-slate-600">
                {field.label}
                <select value={filters.component} onChange={(event) => setFilter('component', event.target.value)} className={`mt-1 block ${fieldClass}`}>
                  <option value="">All components</option>
                  {COMPONENT_SYSTEMS.map((system) => <option key={system} value={system}>{system}</option>)}
                </select>
              </label>
            );
          }
          if (field.kind === 'date') {
            return (
              <label key={field.key} className="text-xs font-bold text-slate-600">
                {field.label}
                <input type="date" value={filters[field.key]} onChange={(event) => setFilter(field.key, event.target.value)} className={`mt-1 block ${fieldClass}`} />
              </label>
            );
          }
          return (
            <label key={field.key} className="text-xs font-bold text-slate-600">
              {field.label}
              <input value={filters.keyword} onChange={(event) => setFilter('keyword', event.target.value)} placeholder="Job, defect, or note" className={`mt-1 block ${fieldClass}`} />
            </label>
          );
        })}
        <button type="button" onClick={() => void search()} disabled={searching} className="min-h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-bold disabled:opacity-50">
          {searching ? 'Searching...' : 'Search history'}
        </button>
      </div>
      {error && <p className="text-sm font-bold text-rose-700">{error}</p>}
      {hits && hits.length === 0 && <p className="text-sm text-slate-500">Nothing matches that history search.</p>}
      {hits && hits.length > 0 && (
        <div className="max-h-64 overflow-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm text-left">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 font-bold">When</th>
                <th className="px-3 py-2 font-bold">Machine</th>
                <th className="px-3 py-2 font-bold">Record</th>
                <th className="px-3 py-2 font-bold">What happened</th>
              </tr>
            </thead>
            <tbody>
              {hits.map((hit) => (
                <tr key={hit.id} className="border-t border-slate-200">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(hit.when)}</td>
                  <td className="px-3 py-2 font-bold whitespace-nowrap">{hit.fleetId}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{hit.kind}</td>
                  <td className="px-3 py-2">{hit.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
