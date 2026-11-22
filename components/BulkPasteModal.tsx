'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { parseCrewPaste, parseFleetPaste } from '@/utils/bulkPaste';
import type { Department } from '@/utils/permissions';

export default function BulkPasteModal({
  kind,
  department,
  onClose,
  onImported,
}: {
  kind: 'fleet' | 'crew';
  department?: Department;
  onClose: () => void;
  onImported: () => void;
}) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const fleet = kind === 'fleet';

  const importRows = async () => {
    setSaving(true);
    setMessage('');
    const supabase = createClient();
    if (fleet) {
      const rows = parseFleetPaste(text);
      if (rows.length === 0) {
        setSaving(false);
        setMessage('Paste Fleet ID, Model, and Category. One machine per line.');
        return;
      }
      const { data } = await supabase.from('assets').select('fleet_id');
      const existing = new Set((data ?? []).map((row) => String(row.fleet_id).toUpperCase()));
      const fresh = rows.filter((row) => !existing.has(row.fleetId));
      if (fresh.length > 0) {
        const { error } = await supabase.from('assets').insert(fresh.map((row) => ({
          fleet_id: row.fleetId,
          make_model: row.model,
          asset_type: row.category,
          status: 'OPERATIONAL',
          in_shift: false,
          machine_owner: 'Central',
        })));
        if (error) {
          setSaving(false);
          setMessage(error.message.includes('workshop supervisor')
            ? 'Only a workshop supervisor can add machines.'
            : 'Those machines were not saved.');
          return;
        }
      }
      setMessage(`Added ${fresh.length}. Skipped ${rows.length - fresh.length} already on the fleet.`);
    } else {
      const rows = parseCrewPaste(text, department ?? 'workshop');
      if (rows.length === 0) {
        setSaving(false);
        setMessage('Paste Name, Trade, Panel, and Department. One person per line.');
        return;
      }
      const { error } = await supabase.from('crew_members').insert(rows.map((row) => ({
        display_name: row.name,
        trade: row.trade,
        panel: row.panel,
        department: row.department,
        access_level: 2,
        active: true,
      })));
      if (error) {
        setSaving(false);
        setMessage('Those people were not saved. Check the trade, panel, and department columns.');
        return;
      }
      setMessage(`Added ${rows.length} to the crew list.`);
    }
    setSaving(false);
    onImported();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4" onClick={onClose}>
      <form
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => { event.preventDefault(); void importRows(); }}
        className="my-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-3 rounded-2xl bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-import-title"
      >
        <h3 id="bulk-import-title" className="text-lg font-black text-slate-900">Bulk Import (CSV / Paste)</h3>
        <p className="text-sm text-slate-600">
          {fleet
            ? 'Paste from Excel: Fleet ID, Model, Category. Tabs or commas both work.'
            : 'Paste from Excel: Name, Trade, Panel, Department. Tabs or commas both work.'}
        </p>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={10}
          placeholder={fleet ? 'EX-01\tCaterpillar 6060\tExcavator' : 'Alex Nguyen\tOperator\tA\tProduction'}
          className="w-full rounded-lg border-2 border-slate-300 px-3 py-2 font-mono text-sm"
        />
        {message && <p className="text-sm font-bold text-slate-800">{message}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-50">
            {saving ? 'Importing...' : 'Import'}
          </button>
          <button type="button" onClick={onClose} className="min-h-11 rounded-lg border-2 border-slate-300 px-4 text-sm font-bold text-slate-700">Close</button>
        </div>
      </form>
    </div>
  );
}
