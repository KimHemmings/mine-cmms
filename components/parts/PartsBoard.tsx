'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Asset, PartsBoardKind, PartsBoardRow } from '@/types';
import { useFeedback } from '@/components/ui/FeedbackProvider';

const GROUPS: { kind: PartsBoardKind; title: string; row: string; badge: string }[] = [
  { kind: 'on_order', title: 'Parts on order', row: 'bg-emerald-50 border-l-emerald-600', badge: 'bg-emerald-600 text-white' },
  { kind: 'hotshot', title: 'Hotshots', row: 'bg-orange-50 border-l-orange-500', badge: 'bg-orange-500 text-slate-950' },
  { kind: 'borrowed', title: 'Parts borrowed', row: 'bg-rose-50 border-l-rose-600', badge: 'bg-rose-600 text-white' },
];

export default function PartsBoard({
  assets,
  actorName,
  readOnly = false,
}: {
  assets: Asset[];
  actorName: string;
  readOnly?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useFeedback();
  const [rows, setRows] = useState<PartsBoardRow[]>([]);
  const [kind, setKind] = useState<PartsBoardKind>('on_order');
  const [assetId, setAssetId] = useState('');
  const [supplier, setSupplier] = useState('');
  const [orderedOn, setOrderedOn] = useState('');
  const [eta, setEta] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const fleet = [...assets].sort((a, b) => a.fleet_id.localeCompare(b.fleet_id));

  async function load() {
    const { data, error } = await supabase
      .from('parts_board')
      .select('id, asset_id, fleet_id, kind, supplier, ordered_on, eta, description, reason, created_by, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      showToast({ message: 'Could not load the parts board.', tone: 'error' });
      return;
    }
    setRows((data ?? []) as PartsBoardRow[]);
  }

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
    // Load once when the tab opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addRow(event: React.FormEvent) {
    event.preventDefault();
    const machine = fleet.find((item) => item.id === assetId);
    if (!machine || !description.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('parts_board').insert({
      asset_id: machine.id,
      fleet_id: machine.fleet_id,
      kind,
      supplier: supplier.trim() || null,
      ordered_on: orderedOn || null,
      eta: eta || null,
      description: description.trim(),
      reason: reason.trim() || null,
      created_by: actorName || null,
    });
    setSaving(false);
    if (error) {
      showToast({ message: 'Could not add that part.', tone: 'error' });
      return;
    }
    setDescription('');
    setReason('');
    setSupplier('');
    showToast({ message: 'Part saved.', tone: 'success' });
    await load();
  }

  async function removeRow(id: string) {
    const { error } = await supabase.from('parts_board').delete().eq('id', id);
    if (error) {
      showToast({ message: 'Could not remove that part.', tone: 'error' });
      return;
    }
    setRows((current) => current.filter((row) => row.id !== id));
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <form onSubmit={(event) => void addRow(event)} className="grid gap-3 rounded-xl border border-slate-300 bg-sky-100 p-4 md:grid-cols-4">
          <label className="text-xs font-bold text-slate-700">Line
            <select value={kind} onChange={(event) => setKind(event.target.value as PartsBoardKind)} className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm">
              <option value="on_order">Parts on order</option>
              <option value="hotshot">Hotshot</option>
              <option value="borrowed">Parts borrowed</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-700">Machine
            <select value={assetId} onChange={(event) => setAssetId(event.target.value)} required className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm">
              <option value="">Select</option>
              {fleet.map((machine) => <option key={machine.id} value={machine.id}>{machine.fleet_id}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-700">Supplier
            <input value={supplier} onChange={(event) => setSupplier(event.target.value)} className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal" />
          </label>
          <label className="text-xs font-bold text-slate-700">Date ordered
            <input type="date" value={orderedOn} onChange={(event) => setOrderedOn(event.target.value)} className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal" />
          </label>
          <label className="text-xs font-bold text-slate-700">ETA
            <input type="date" value={eta} onChange={(event) => setEta(event.target.value)} className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal" />
          </label>
          <label className="text-xs font-bold text-slate-700 md:col-span-2">Description
            <input value={description} onChange={(event) => setDescription(event.target.value)} required className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal" />
          </label>
          <label className="text-xs font-bold text-slate-700">Reason for parts
            <input value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal" />
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={saving} className="min-h-10 w-full rounded-lg bg-slate-900 px-3 text-sm font-bold text-white disabled:opacity-50">
              {saving ? 'Saving...' : 'Add part'}
            </button>
          </div>
        </form>
      )}

      {GROUPS.map((group) => {
        const lines = rows.filter((row) => row.kind === group.kind);
        return (
          <section key={group.kind} className="overflow-hidden rounded-xl border border-slate-300 bg-white">
            <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-black uppercase tracking-wide text-slate-800">
              <span className={`mr-2 inline-flex rounded px-2 py-0.5 text-xs ${group.badge}`}>{lines.length}</span>
              {group.title}
            </h2>
            {lines.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">None logged.</p>
            ) : (
              <div className="divide-y divide-slate-200">
                <div className="hidden grid-cols-6 gap-2 px-4 py-2 text-[11px] font-black uppercase tracking-wide text-slate-500 md:grid">
                  <span>Machine</span><span>Supplier</span><span>Date ordered</span><span>ETA</span><span>Description</span><span>Reason for parts</span>
                </div>
                {lines.map((row) => (
                  <div key={row.id} className={`grid gap-1 border-l-4 px-4 py-3 text-sm md:grid-cols-6 md:items-center md:gap-2 ${group.row}`}>
                    <strong>{row.fleet_id}</strong>
                    <span>{row.supplier || '—'}</span>
                    <span>{row.ordered_on?.slice(0, 10) || '—'}</span>
                    <span>{row.eta?.slice(0, 10) || '—'}</span>
                    <span>{row.description}</span>
                    <span className="flex items-center justify-between gap-2">
                      <span>{row.reason || '—'}</span>
                      {!readOnly && (
                        <button type="button" onClick={() => void removeRow(row.id)} className="text-xs font-bold text-slate-500 underline">Remove</button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
