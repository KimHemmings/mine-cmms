'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Asset, CrewMember, OperatorPassout, PRODUCTION_PLANT, authorisationState } from '@/types';
import { useFeedback } from '@/components/ui/FeedbackProvider';

const STATE_WORD = { current: 'Current', due: 'Due soon', expired: 'Expired', not_held: 'Not passed out' };

export default function PassoutRegister({
  machines,
  crew,
  passouts,
  onChanged,
}: {
  machines: Asset[];
  crew: CrewMember[];
  passouts: OperatorPassout[];
  onChanged: () => void;
}) {
  const supabase = createClient();
  const { showToast } = useFeedback();
  const operators = crew.filter((member) => member.active && member.department === 'Production');
  const plant = machines.filter((asset) => (PRODUCTION_PLANT as readonly string[]).includes(asset.asset_type));
  const [fleetId, setFleetId] = useState(plant[0]?.fleet_id ?? '');
  const selected = plant.find((asset) => asset.fleet_id === fleetId) ?? plant[0] ?? null;

  async function save(memberId: string, assetId: string, expiresOn: string) {
    const query = expiresOn
      ? supabase.from('operator_passouts').upsert(
          { crew_member_id: memberId, asset_id: assetId, expires_on: expiresOn },
          { onConflict: 'crew_member_id,asset_id' },
        )
      : supabase.from('operator_passouts').delete().eq('crew_member_id', memberId).eq('asset_id', assetId);
    const { error } = await query;
    if (error) {
      showToast({ message: 'Could not save that pass-out.', tone: 'error' });
      return;
    }
    onChanged();
  }

  return (
    <section className="bg-white border border-slate-300 rounded-2xl p-4 shadow-sm space-y-3">
      <div>
        <h2 className="text-xl font-black text-slate-900">Machine pass-outs</h2>
        <p className="text-sm text-slate-600 mt-1">
          Training records who is signed off on each machine. A production supervisor can only allocate an operator while this date is still current.
        </p>
      </div>
      {!selected || operators.length === 0 ? (
        <p className="text-sm text-slate-500">No production operators are set up yet.</p>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
            Machine
            <select value={selected.fleet_id} onChange={(event) => setFleetId(event.target.value)} className="min-h-11 rounded-lg border-2 border-slate-300 bg-white px-3">
              {plant.map((asset) => (
                <option key={asset.id} value={asset.fleet_id}>{asset.fleet_id} · {asset.make_model}</option>
              ))}
            </select>
          </label>
          <ul className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
            {operators.map((member) => {
              const held = passouts.find((row) => row.crew_member_id === member.id && row.asset_id === selected.id);
              const state = authorisationState(held?.expires_on ?? null);
              return (
                <li key={member.id} className="px-3 py-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-bold">{member.display_name}</span>
                  <span className="flex items-center gap-2">
                    <span className={`text-xs font-black uppercase ${state === 'expired' ? 'text-rose-700' : state === 'due' ? 'text-amber-700' : state === 'current' ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {STATE_WORD[state]}
                    </span>
                    <input
                      type="date"
                      value={held?.expires_on?.slice(0, 10) ?? ''}
                      aria-label={`${member.display_name} pass-out on ${selected.fleet_id}`}
                      onChange={(event) => void save(member.id, selected.id, event.target.value)}
                      className="min-h-10 px-2 rounded-lg border border-slate-300"
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
