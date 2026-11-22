'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Asset, CREW_PANELS, CrewMember, OperatorPassout, PRODUCTION_PLANT } from '@/types';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import DateRoster from './DateRoster';

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
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useFeedback();
  const plant = machines.filter((asset) => (PRODUCTION_PLANT as readonly string[]).includes(asset.asset_type));
  const [fleetId, setFleetId] = useState(plant[0]?.fleet_id ?? '');
  const [crewFilter, setCrewFilter] = useState('all');
  const selected = plant.find((asset) => asset.fleet_id === fleetId) ?? plant[0] ?? null;

  const people = crew
    .filter((member) => member.active && member.department === 'Production')
    .filter((member) => crewFilter === 'all' || member.panel === crewFilter)
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
    .map((member) => ({
      id: member.id,
      name: member.display_name,
      detail: member.panel || 'No crew',
    }));

  function expiresFor(memberId: string) {
    if (!selected) return null;
    return passouts.find((row) => row.crew_member_id === memberId && row.asset_id === selected.id)?.expires_on ?? null;
  }

  async function saveOne(memberId: string, expiresOn: string) {
    if (!selected) return false;
    const query = expiresOn
      ? supabase.from('operator_passouts').upsert(
          { crew_member_id: memberId, asset_id: selected.id, expires_on: expiresOn },
          { onConflict: 'crew_member_id,asset_id' },
        )
      : supabase.from('operator_passouts').delete().eq('crew_member_id', memberId).eq('asset_id', selected.id);
    const { error } = await query;
    if (error) {
      showToast({ message: 'Could not save that pass-out.', tone: 'error' });
      return false;
    }
    onChanged();
    return true;
  }

  async function saveMany(ids: string[], expiresOn: string) {
    if (!selected) return false;
    const { error } = await supabase.from('operator_passouts').upsert(
      ids.map((id) => ({ crew_member_id: id, asset_id: selected.id, expires_on: expiresOn })),
      { onConflict: 'crew_member_id,asset_id' },
    );
    if (error) return false;
    onChanged();
    return true;
  }

  return (
    <DateRoster
      title="Machine pass-outs"
      hint="Pick a machine. Set a date on a person, or tick the people who were signed off and set one date for them."
      people={people}
      dateFor={expiresFor}
      onSaveOne={saveOne}
      onSaveMany={saveMany}
      emptyWord="Not passed out"
      picker={(
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
            Machine
            <select value={selected?.fleet_id ?? ''} onChange={(event) => setFleetId(event.target.value)} className="min-h-11 rounded-lg border-2 border-slate-300 bg-white px-3">
              {plant.map((asset) => (
                <option key={asset.id} value={asset.fleet_id}>{asset.fleet_id} · {asset.make_model}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
            Crew
            <select value={crewFilter} onChange={(event) => setCrewFilter(event.target.value)} className="min-h-11 rounded-lg border-2 border-slate-300 bg-white px-3">
              <option value="all">All crews</option>
              {CREW_PANELS.map((panel) => <option key={panel} value={panel}>{panel}</option>)}
            </select>
          </label>
        </div>
      )}
    />
  );
}
