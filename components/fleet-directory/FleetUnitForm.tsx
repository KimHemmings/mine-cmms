'use client';

import { useState } from 'react';
import { Asset, PRODUCTION_PLANT } from '@/types';
import { createClient } from '@/utils/supabase/client';

interface FleetUnitFormProps {
  asset: Asset | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function FleetUnitForm({ asset, onClose, onSaved }: FleetUnitFormProps) {
  const [fleetId, setFleetId] = useState(asset?.fleet_id ?? '');
  const [assetType, setAssetType] = useState(asset?.asset_type ?? PRODUCTION_PLANT[0]);
  const [makeModel, setMakeModel] = useState(asset?.make_model ?? '');
  const [serialNumber, setSerialNumber] = useState(asset?.serial_number ?? '');
  const [owner, setOwner] = useState(asset?.machine_owner ?? 'Central');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const id = fleetId.trim().toUpperCase();
    const model = makeModel.trim();
    if (!id || !model) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const row = {
      fleet_id: id,
      asset_type: assetType,
      make_model: model,
      serial_number: serialNumber.trim() || null,
      machine_owner: owner.trim() || 'Central',
    };
    const result = asset
      ? await supabase.from('assets').update(row).eq('id', asset.id)
      : await supabase.from('assets').insert({ ...row, status: 'OPERATIONAL', in_shift: false });
    setSaving(false);
    if (result.error) {
      setError(result.error.message.includes('workshop supervisor')
        ? 'Only a workshop supervisor can change the permanent machine record.'
        : 'That machine was not saved.');
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <form onSubmit={(event) => void save(event)} className="mb-4 rounded-2xl border-2 border-slate-300 bg-white p-4 space-y-3">
      <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">
        {asset ? `Edit ${asset.fleet_id}` : 'Add a machine'}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-600">Fleet ID</span>
          <input value={fleetId} onChange={(event) => setFleetId(event.target.value)} required className="w-full min-h-11 rounded-lg border-2 border-slate-300 px-3 font-mono font-bold" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-600">Type</span>
          <select value={assetType} onChange={(event) => setAssetType(event.target.value)} className="w-full min-h-11 rounded-lg border-2 border-slate-300 px-3 font-bold">
            {PRODUCTION_PLANT.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
            {assetType && !(PRODUCTION_PLANT as readonly string[]).includes(assetType) && (
              <option value={assetType}>{assetType}</option>
            )}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-600">Make / model</span>
          <input value={makeModel} onChange={(event) => setMakeModel(event.target.value)} required className="w-full min-h-11 rounded-lg border-2 border-slate-300 px-3 font-bold" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-600">Serial number</span>
          <input value={serialNumber ?? ''} onChange={(event) => setSerialNumber(event.target.value)} className="w-full min-h-11 rounded-lg border-2 border-slate-300 px-3 font-mono" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-bold text-slate-600">Owner</span>
          <input value={owner ?? ''} onChange={(event) => setOwner(event.target.value)} className="w-full min-h-11 rounded-lg border-2 border-slate-300 px-3 font-bold" />
        </label>
      </div>
      {error && <p className="text-sm font-bold text-rose-700">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-black disabled:opacity-50">
          {saving ? 'Saving...' : asset ? 'Save machine' : 'Add machine'}
        </button>
        <button type="button" onClick={onClose} className="min-h-11 px-4 rounded-lg border-2 border-slate-300 text-sm font-bold text-slate-700">
          Cancel
        </button>
      </div>
    </form>
  );
}
