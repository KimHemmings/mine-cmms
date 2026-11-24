'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Edit3, Check } from 'lucide-react';
import { Asset, MachineWorkOrder, OrderType } from '@/types';
import { createClient } from '@/utils/supabase/client';
import PrioritySelector from './quick-edit/PrioritySelector';
import { getPriorityConfig, workshopPriority } from './workboard/workboardTheme';
import AssetDetailsInputs from './quick-edit/AssetDetailsInputs';
import EtuTimeSection from './quick-edit/EtuTimeSection';

interface QuickEditAssetModalProps {
  asset: Asset | null;
  workOrders?: MachineWorkOrder[];
  activeShiftId?: string | null;
  activeFitter: string;
  onClose: () => void;
  onSuccess: () => void;
}

function jobOnTheBoard(orders: MachineWorkOrder[]) {
  const open = orders.filter((order) => order.status !== 'COMPLETED');
  const pool = open.length > 0 ? open : orders;
  const flagged = pool.filter((order) => order.is_main_event);
  const chosen = flagged.length > 0 ? flagged : pool;
  return [...chosen].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0] ?? null;
}

export default function QuickEditAssetModal({
  asset,
  workOrders = [],
  activeShiftId = null,
  activeFitter,
  onClose,
  onSuccess,
}: QuickEditAssetModalProps) {
  const [orderType, setOrderType] = useState<OrderType>('UNPLANNED');
  const [locationArea, setLocationArea] = useState('');
  const [bay, setBay] = useState('');
  const [machineOwner, setMachineOwner] = useState('Central');
  const [priority, setPriority] = useState<string>('');
  const [downSinceInput, setDownSinceInput] = useState('');
  const [expectedUpInput, setExpectedUpInput] = useState('');
  const [woNumber, setWoNumber] = useState('');
  const [mainWoId, setMainWoId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentSmu, setCurrentSmu] = useState('');
  const [nextServiceSmu, setNextServiceSmu] = useState('');
  const [statutoryDue, setStatutoryDue] = useState('');

  const supabase = useMemo(() => createClient(), []);
  const ordersRef = useRef(workOrders);
  ordersRef.current = workOrders;

  useEffect(() => {
    if (asset) {
      if (asset.location) {
        if (asset.location.includes(' — ')) {
          const [loc, b] = asset.location.split(' — ');
          setLocationArea(loc?.trim() || '');
          setBay(b?.trim() || '');
        } else if (asset.location.includes(' - ')) {
          const [loc, b] = asset.location.split(' - ');
          setLocationArea(loc?.trim() || '');
          setBay(b?.trim() || '');
        } else if (asset.location.toLowerCase().startsWith('bay')) {
          setLocationArea('');
          setBay(asset.location.trim());
        } else {
          setLocationArea(asset.location.trim());
          setBay('');
        }
      } else {
        setLocationArea('');
        setBay('');
      }

      setMachineOwner(asset.machine_owner || 'Central');
      setCurrentSmu(asset.current_smu == null ? '' : String(asset.current_smu));
      setNextServiceSmu(asset.next_service_smu == null ? '' : String(asset.next_service_smu));
      setStatutoryDue((asset.statutory_inspection_due ?? '').slice(0, 10));
      setPriority(workshopPriority(asset.priority));
      setOrderType(asset.status === 'DOWN_PLANNED' ? 'PLANNED' : 'UNPLANNED');

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

      const shown = jobOnTheBoard(ordersRef.current.filter((order) => order.asset_id === asset.id));
      const seededWo = shown?.wo_number || '';
      setMainWoId(shown?.id ?? null);
      setWoNumber(seededWo);
      if (shown?.order_type) setOrderType(shown.order_type as OrderType);

      let cancelled = false;
      supabase
        .from('machine_work_orders')
        .select('id, wo_number, order_type, status, is_main_event, created_at, asset_id')
        .eq('asset_id', asset.id)
        .then(({ data }) => {
          if (cancelled) return;
          const job = jobOnTheBoard((data ?? []) as MachineWorkOrder[]);
          setMainWoId(job?.id ?? null);
          setWoNumber((current) => (current === seededWo ? job?.wo_number || '' : current));
          if (job?.order_type) setOrderType(job.order_type as OrderType);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [asset?.id, supabase]);

  if (!asset) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!asset) return;
    setSaving(true);

    const formattedLocation = [locationArea.trim(), bay.trim()].filter(Boolean).join(' — ');

    const { error: assetError } = await supabase
      .from('assets')
      .update({
        location: formattedLocation,
        machine_owner: machineOwner,
        priority: workshopPriority(priority),
        down_since: downSinceInput ? new Date(downSinceInput).toISOString() : asset.down_since,
        expected_up: expectedUpInput ? new Date(expectedUpInput).toISOString() : asset.expected_up,
        current_smu: currentSmu === '' ? null : Number(currentSmu),
        next_service_smu: nextServiceSmu === '' ? null : Number(nextServiceSmu),
        statutory_inspection_due: statutoryDue || null,
      })
      .eq('id', asset.id);

    if (assetError) {
      alert('Error updating asset: ' + assetError.message);
      setSaving(false);
      return;
    }

    const cleanWo = woNumber.trim() || null;
    if (mainWoId) {
      const { error: woError } = await supabase
        .from('machine_work_orders')
        .update({
          wo_number: cleanWo,
          order_type: orderType,
          is_main_event: true,
        })
        .eq('id', mainWoId)
        .eq('asset_id', asset.id);
      if (woError) {
        alert('Machine saved, but the work order number did not: ' + woError.message);
        setSaving(false);
        return;
      }
      await supabase
        .from('machine_work_orders')
        .update({ is_main_event: false })
        .eq('asset_id', asset.id)
        .neq('id', mainWoId);
    } else if (cleanWo) {
      const { error: insertError } = await supabase.from('machine_work_orders').insert({
        asset_id: asset.id,
        shift_id: activeShiftId,
        wo_number: cleanWo,
        order_type: orderType,
        task_description: 'Downtime event',
        stage: 'IN_PROGRESS',
        status: 'OPEN',
        is_main_event: true,
        takes_machine_down: true,
      });
      if (insertError) {
        alert('Machine saved, but the work order number did not: ' + insertError.message);
        setSaving(false);
        return;
      }
    }

    await supabase.from('asset_history_notes').insert([
      {
        asset_id: asset.id,
        fitter_name: activeFitter || 'Supervisor',
        note: `Updated banner details: Loc: ${formattedLocation || 'Unassigned'}, Owner: ${machineOwner}, Priority: ${getPriorityConfig(priority).label}, WO: ${woNumber.trim() || 'None'}, ETU: ${expectedUpInput}`,
        stage: asset.shift_stage || 'IN_PROGRESS',
      },
    ]);
    setSaving(false);
    onSuccess();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-amber-600" /> Edit Machine Details: {asset.fleet_id}
            </h3>
            <p className="text-xs text-slate-500">
              {asset.make_model} • Changes apply immediately across all boards.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 mt-4 text-xs">
          <PrioritySelector priority={priority} setPriority={setPriority} />

          <AssetDetailsInputs
  orderType={orderType}
  setOrderType={setOrderType}
  locationArea={locationArea}
  setLocationArea={setLocationArea}
  bay={bay}
  setBay={setBay}
  machineOwner={machineOwner}
  setMachineOwner={setMachineOwner}
  woNumber={woNumber}
  setWoNumber={setWoNumber}
/>

          <div className="grid gap-2 sm:grid-cols-3">
            <label className="font-bold text-slate-700">Current SMU
              <input value={currentSmu} onChange={(event) => setCurrentSmu(event.target.value)} inputMode="decimal" className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 px-2 font-normal" />
            </label>
            <label className="font-bold text-slate-700">Next service SMU
              <input value={nextServiceSmu} onChange={(event) => setNextServiceSmu(event.target.value)} inputMode="decimal" className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 px-2 font-normal" />
            </label>
            <label className="font-bold text-slate-700">Statutory inspection due
              <input type="date" value={statutoryDue} onChange={(event) => setStatutoryDue(event.target.value)} className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 px-2 font-normal" />
            </label>
          </div>

          <EtuTimeSection
            downSinceInput={downSinceInput}
            setDownSinceInput={setDownSinceInput}
            expectedUpInput={expectedUpInput}
            setExpectedUpInput={setExpectedUpInput}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition cursor-pointer"
            >
              <Check className="w-4 h-4" /> {saving ? 'Saving...' : 'Apply Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}