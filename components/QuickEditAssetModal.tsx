import { useState, useEffect } from 'react';
import { X, Edit3, MapPin, Shield, Check } from 'lucide-react';
import { Asset } from '@/types';
import { createClient } from '@/utils/supabase/client';

interface QuickEditAssetModalProps {
  asset: Asset | null;
  activeFitter: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function QuickEditAssetModal({ asset, activeFitter, onClose, onSuccess }: QuickEditAssetModalProps) {
  const [location, setLocation] = useState('');
  const [machineOwner, setMachineOwner] = useState('Central');
  const [priority, setPriority] = useState<string>('');
  const [downSinceInput, setDownSinceInput] = useState('');
  const [expectedUpInput, setExpectedUpInput] = useState('');
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (asset) {
      setLocation(asset.location || '');
      setMachineOwner(asset.machine_owner || 'Central');
      setPriority(asset.priority || '');
      
      if (asset.down_since) {
        try {
          const d = new Date(asset.down_since);
          if (!isNaN(d.getTime())) {
            setDownSinceInput(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
          }
        } catch {
          setDownSinceInput('');
        }
      }
      if (asset.expected_up) {
        try {
          const u = new Date(asset.expected_up);
          if (!isNaN(u.getTime())) {
            setExpectedUpInput(new Date(u.getTime() - u.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
          }
        } catch {
          setExpectedUpInput('');
        }
      }
    }
  }, [asset]);

  if (!asset) return null;

  function applyEtuPreset(hoursFromNow: number) {
    const target = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    const localTarget = new Date(target.getTime() - target.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setExpectedUpInput(localTarget);
  }

  function setEndOfShiftEtu() {
    const now = new Date();
    const isDayShift = now.getHours() >= 6 && now.getHours() < 18;
    const target = new Date();
    if (isDayShift) {
      target.setHours(17, 30, 0, 0);
    } else {
      if (now.getHours() >= 18) target.setDate(target.getDate() + 1);
      target.setHours(5, 30, 0, 0);
    }
    const localTarget = new Date(target.getTime() - target.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setExpectedUpInput(localTarget);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!asset) return;

    setSaving(true);
    const updatedDownSince = downSinceInput ? new Date(downSinceInput).toISOString() : asset.down_since;
    const updatedExpectedUp = expectedUpInput ? new Date(expectedUpInput).toISOString() : asset.expected_up;

    const { error } = await supabase.from('assets').update({
      location: location.trim(),
      machine_owner: machineOwner,
      priority: priority || null,
      down_since: updatedDownSince,
      expected_up: updatedExpectedUp,
    }).eq('id', asset.id);

    if (!error) {
      await supabase.from('asset_history_notes').insert([{
        asset_id: asset.id,
        fitter_name: activeFitter || 'Supervisor',
        note: `Updated banner details: Loc: ${location.trim()}, Owner: ${machineOwner}, Priority: ${priority || 'Routine'}, ETU: ${expectedUpInput}`,
        stage: asset.shift_stage || 'IN_PROGRESS'
      }]);
      setSaving(false);
      onSuccess();
      onClose();
    } else {
      alert('Error updating asset: ' + error.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-amber-600" />
              Edit Times & Priority: {asset.fleet_id}
            </h3>
            <p className="text-xs text-slate-500">{asset.make_model} • Changes apply immediately to the workboard.</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 mt-4 text-xs">
          {/* Priority Selector */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">PRIORITY RATING</label>
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { label: 'Routine', val: '' },
                { label: 'P1 (Critical)', val: 'P1' },
                { label: 'P2 (High)', val: 'P2' },
                { label: 'P3 (Medium)', val: 'P3' },
                { label: 'P4 (Low)', val: 'P4' },
              ].map((p) => {
                const isSelected = priority === p.val;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setPriority(p.val)}
                    className={`py-2 px-1 rounded-lg font-bold border transition text-center text-[11px] ${
                      isSelected
                        ? p.val === 'P1'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : p.val === 'P2'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                          : p.val === 'P3'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-800 text-white border-slate-800 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1 font-bold text-slate-700 mb-1">
                <MapPin className="w-3.5 h-3.5 text-slate-500" /> BAY / LOCATION
              </label>
              <input
                type="text"
                placeholder="e.g. Workshop Bay 1, Washpad"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold"
                required
              />
            </div>

            <div>
              <label className="flex items-center gap-1 font-bold text-slate-700 mb-1">
                <Shield className="w-3.5 h-3.5 text-indigo-500" /> MACHINE OWNER
              </label>
              <select
                value={machineOwner}
                onChange={(e) => setMachineOwner(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold"
              >
                <option value="Central">Central Mining</option>
                <option value="South">South Pit</option>
                <option value="North">North Cut</option>
                <option value="Contractor">Contractor Fleet</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block font-bold text-slate-700 mb-1">DOWN SINCE (DATE & TIME)</label>
              <input
                type="datetime-local"
                value={downSinceInput}
                onChange={(e) => setDownSinceInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-mono font-bold"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">EXPECTED UP TIME (ETU)</label>
              <input
                type="datetime-local"
                value={expectedUpInput}
                onChange={(e) => setExpectedUpInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-mono font-bold"
                required
              />
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Quick ETU Presets</span>
            <div className="grid grid-cols-4 gap-2">
              <button type="button" onClick={() => applyEtuPreset(1)} className="py-1 px-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-bold text-slate-700">+1 Hour</button>
              <button type="button" onClick={() => applyEtuPreset(2)} className="py-1 px-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-bold text-slate-700">+2 Hours</button>
              <button type="button" onClick={() => applyEtuPreset(4)} className="py-1 px-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-bold text-slate-700">+4 Hours</button>
              <button type="button" onClick={setEndOfShiftEtu} className="py-1 px-2 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded text-xs font-bold text-amber-900">End of Shift</button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-bold text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg shadow-sm flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              {saving ? 'Saving...' : 'Apply Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}