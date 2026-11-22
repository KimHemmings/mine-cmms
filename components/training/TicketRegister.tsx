'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Authorisation, CREW_PANELS, CrewAuthorisation, CrewMember, TrainingItemKind } from '@/types';
import { useFeedback } from '@/components/ui/FeedbackProvider';
import DateRoster from './DateRoster';

export default function TicketRegister({
  crew,
  authorisations,
  holdings,
  onChanged,
}: {
  crew: CrewMember[];
  authorisations: Authorisation[];
  holdings: CrewAuthorisation[];
  onChanged: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useFeedback();
  const items = useMemo(
    () => [...authorisations].sort((a, b) => a.name.localeCompare(b.name)),
    [authorisations],
  );
  const [itemId, setItemId] = useState(items[0]?.id ?? '');
  const [crewFilter, setCrewFilter] = useState('all');
  const [itemName, setItemName] = useState('');
  const [itemKind, setItemKind] = useState<TrainingItemKind>('SOP');
  const [adding, setAdding] = useState(false);
  const selected = items.find((item) => item.id === itemId) ?? items[0] ?? null;

  const people = crew
    .filter((member) => member.active)
    .filter((member) => crewFilter === 'all' || member.panel === crewFilter)
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
    .map((member) => ({
      id: member.id,
      name: member.display_name,
      detail: `${member.department || 'Workshop'}${member.panel ? ` · ${member.panel}` : ''}`,
    }));

  function expiresFor(memberId: string) {
    if (!selected) return null;
    return holdings.find((row) => row.crew_member_id === memberId && row.authorisation_id === selected.id)?.expires_on ?? null;
  }

  async function saveOne(memberId: string, expiresOn: string) {
    if (!selected) return false;
    const query = expiresOn
      ? supabase.from('crew_authorisations').upsert(
          { crew_member_id: memberId, authorisation_id: selected.id, expires_on: expiresOn },
          { onConflict: 'crew_member_id,authorisation_id' },
        )
      : supabase.from('crew_authorisations').delete().eq('crew_member_id', memberId).eq('authorisation_id', selected.id);
    const { error } = await query;
    if (error) {
      showToast({ message: 'Could not save that date.', tone: 'error' });
      return false;
    }
    onChanged();
    return true;
  }

  async function saveMany(ids: string[], expiresOn: string) {
    if (!selected) return false;
    const { error } = await supabase.from('crew_authorisations').upsert(
      ids.map((id) => ({ crew_member_id: id, authorisation_id: selected.id, expires_on: expiresOn })),
      { onConflict: 'crew_member_id,authorisation_id' },
    );
    if (error) return false;
    onChanged();
    return true;
  }

  async function addItem(event: FormEvent) {
    event.preventDefault();
    const name = itemName.trim();
    if (!name || adding) return;
    setAdding(true);
    const sortOrder = authorisations.reduce((max, item) => Math.max(max, item.sort_order), 0) + 1;
    const { data, error } = await supabase.from('authorisations').insert({ name, kind: itemKind, sort_order: sortOrder }).select('id').single();
    setAdding(false);
    if (error || !data) {
      showToast({ message: error?.code === '23505' ? 'That name is already on the list.' : 'Could not add that.', tone: 'error' });
      return;
    }
    setItemName('');
    setItemId(data.id);
    onChanged();
  }

  return (
    <div className="space-y-4">
      <DateRoster
        title="Tickets and SOPs"
        hint="Pick one item. Set a date on a person, or tick the people who were there and set one date for them. Anyone left unticked stays as they are."
        people={people}
        dateFor={expiresFor}
        onSaveOne={saveOne}
        onSaveMany={saveMany}
        picker={(
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
              Item
              <select value={selected?.id ?? ''} onChange={(event) => setItemId(event.target.value)} className="min-h-11 rounded-lg border-2 border-slate-300 bg-white px-3">
                {items.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}{item.kind === 'SOP' ? ' · SOP' : ''}</option>
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
      <form onSubmit={addItem} className="bg-white border border-slate-300 rounded-2xl p-4 flex flex-wrap items-end gap-2">
        <label className="text-sm font-bold text-slate-700">
          Add a ticket or SOP
          <input value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder="Name" className="mt-1 block min-h-10 rounded-lg border border-slate-300 px-2" />
        </label>
        <select value={itemKind} onChange={(event) => setItemKind(event.target.value as TrainingItemKind)} className="min-h-10 rounded-lg border border-slate-300 px-2 text-sm font-bold" aria-label="Type">
          <option value="SOP">SOP</option>
          <option value="AUTHORISATION">Ticket</option>
        </select>
        <button type="submit" disabled={adding || !itemName.trim()} className="min-h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-bold disabled:opacity-50">
          {adding ? 'Adding...' : 'Add'}
        </button>
      </form>
    </div>
  );
}
