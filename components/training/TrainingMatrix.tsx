'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import {
  Authorisation,
  CREW_DEPARTMENTS,
  TrainingItemKind,
  CREW_PANELS,
  CREW_TRADES,
  CrewAuthorisation,
  CrewMember,
  authorisationState,
} from '@/types';
import { useFeedback } from '@/components/ui/FeedbackProvider';

const CELL: Record<string, string> = {
  expired: 'bg-rose-100 text-rose-900',
  due: 'bg-amber-100 text-amber-950',
  current: 'bg-emerald-50 text-emerald-950',
  not_held: 'bg-white text-slate-400',
};

const selectClass =
  'min-h-12 rounded-lg border-2 border-slate-300 bg-white px-3 text-base font-bold text-slate-900 cursor-pointer';
const filterClass =
  'min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold text-slate-900 cursor-pointer';

type Focus = 'all' | 'attention' | 'missing';

const FOCUS: { id: Focus; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'attention', label: 'Due or expired' },
  { id: 'missing', label: 'Missing a record' },
];

export default function TrainingMatrix({
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
  const supabase = createClient();
  const { showToast } = useFeedback();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('all');
  const [crewFilter, setCrewFilter] = useState('all');
  const [trade, setTrade] = useState('all');
  const [focus, setFocus] = useState<Focus>('attention');
  const [itemName, setItemName] = useState('');
  const [itemKind, setItemKind] = useState<TrainingItemKind>('AUTHORISATION');
  const [appliesTo, setAppliesTo] = useState('none');
  const [adding, setAdding] = useState(false);

  const expiresFor = (memberId: string, authId: string) =>
    holdings.find((row) => row.crew_member_id === memberId && row.authorisation_id === authId)?.expires_on ?? '';

  const flagsFor = useMemo(() => {
    const flags = new Map<string, { attention: boolean; missing: boolean }>();
    for (const person of crew) {
      let attention = false;
      let missing = false;
      for (const item of authorisations) {
        const expires = holdings.find((row) => row.crew_member_id === person.id && row.authorisation_id === item.id)?.expires_on ?? null;
        const state = authorisationState(expires);
        if (state === 'due' || state === 'expired') attention = true;
        if (state === 'not_held') missing = true;
      }
      flags.set(person.id, { attention, missing });
    }
    return flags;
  }, [crew, authorisations, holdings]);

  const activePeople = crew.filter((member) => member.active);
  const term = search.trim().toLowerCase();
  const people = activePeople.filter((person) => {
    const flags = flagsFor.get(person.id);
    const crewName = person.panel || 'No crew';
    if (department !== 'all' && (person.department || 'Workshop') !== department) return false;
    if (crewFilter !== 'all' && crewName !== crewFilter) return false;
    if (trade !== 'all' && person.trade !== trade) return false;
    if (focus === 'attention' && !flags?.attention) return false;
    if (focus === 'missing' && !flags?.missing) return false;
    if (!term) return true;
    return [person.display_name, person.employee_id, person.trade, person.panel, person.department]
      .some((value) => value?.toLowerCase().includes(term));
  });

  const filtersOn = Boolean(term) || department !== 'all' || crewFilter !== 'all' || trade !== 'all' || focus !== 'all';

  function clearFilters() {
    setSearch('');
    setDepartment('all');
    setCrewFilter('all');
    setTrade('all');
    setFocus('all');
  }

  async function save(memberId: string, authId: string, expiresOn: string) {
    const key = `${memberId}:${authId}`;
    setSavingKey(key);
    const query = expiresOn
      ? supabase.from('crew_authorisations').upsert(
          { crew_member_id: memberId, authorisation_id: authId, expires_on: expiresOn },
          { onConflict: 'crew_member_id,authorisation_id' }
        )
      : supabase.from('crew_authorisations').delete().eq('crew_member_id', memberId).eq('authorisation_id', authId);
    const { error } = await query;
    setSavingKey(null);
    if (error) {
      showToast({ message: 'Could not save that authorisation.', tone: 'error' });
      return;
    }
    onChanged();
  }

  async function addItem(event: FormEvent) {
    event.preventDefault();
    const name = itemName.trim();
    if (!name || adding) return;
    setAdding(true);
    const sortOrder = authorisations.reduce((max, item) => Math.max(max, item.sort_order), 0) + 1;
    const { error } = await supabase.from('authorisations').insert({ name, kind: itemKind, sort_order: sortOrder });
    if (error) {
      setAdding(false);
      showToast({
        message: error.code === '23505' ? 'That name is already on the list.' : 'Could not add that.',
        tone: 'error',
      });
      return;
    }
    const label = itemKind === 'SOP' ? 'SOP' : 'authorisation';
    if (appliesTo !== 'none') {
      const scope = appliesTo === 'all' ? 'every crew' : `the whole of ${appliesTo}`;
      const { error: messageError } = await supabase.from('help_messages').insert({
        kind: 'SUPERVISOR',
        message: `New ${label} "${name}" applies to ${scope}.`,
      });
      showToast({
        message: messageError ? 'Added, but the supervisor was not told.' : 'Added, and the supervisor has it on Help.',
        tone: messageError ? 'error' : 'success',
      });
    } else {
      showToast({ message: 'Added to the matrix' });
    }
    setItemName('');
    setAppliesTo('none');
    setAdding(false);
    onChanged();
  }

  const tickets = authorisations.filter((item) => item.kind !== 'SOP');
  const sops = authorisations.filter((item) => item.kind === 'SOP');

  return (
    <div className="space-y-4">
      <form onSubmit={addItem} className="bg-white border border-slate-300 rounded-xl p-3 shadow-2xs flex flex-col lg:flex-row lg:items-end gap-3">
        <label className="flex-1 space-y-1">
          <span className="text-sm font-bold text-slate-700">New authorisation or SOP</span>
          <input
            value={itemName}
            onChange={(event) => setItemName(event.target.value)}
            placeholder="e.g. Crane ticket"
            className="w-full min-h-12 px-3 rounded-lg border-2 border-slate-300 bg-slate-50 text-base"
          />
        </label>
        <label className="space-y-1 text-sm font-bold text-slate-600">
          Type
          <select value={itemKind} onChange={(event) => setItemKind(event.target.value as TrainingItemKind)} className={selectClass}>
            <option value="AUTHORISATION">Authorisation</option>
            <option value="SOP">SOP</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-bold text-slate-600">
          Tell the supervisor
          <select value={appliesTo} onChange={(event) => setAppliesTo(event.target.value)} className={selectClass}>
            <option value="none">Do not send a bump</option>
            <option value="all">Every crew</option>
            {CREW_PANELS.map((panel) => (
              <option key={panel} value={panel}>{panel}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={adding || !itemName.trim()} className="min-h-12 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black disabled:opacity-50">
          {adding ? 'Adding...' : 'Add'}
        </button>
      </form>
      <div className="bg-white border border-slate-300 rounded-xl p-3 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <label className="relative flex-1">
            <span className="sr-only">Search people</span>
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or employee ID..."
              className="w-full min-h-10 pl-11 pr-11 rounded-lg border border-slate-300 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-500 hover:bg-slate-200"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
            Department
            <select value={department} onChange={(event) => setDepartment(event.target.value)} className={filterClass}>
              <option value="all">All departments</option>
              {CREW_DEPARTMENTS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
            Crew
            <select value={crewFilter} onChange={(event) => setCrewFilter(event.target.value)} className={filterClass}>
              <option value="all">All crews</option>
              {CREW_PANELS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
              <option value="No crew">No crew</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
            Trade
            <select value={trade} onChange={(event) => setTrade(event.target.value)} className={filterClass}>
              <option value="all">All trades</option>
              {CREW_TRADES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Training focus">
            {FOCUS.map((chip) => {
              const active = focus === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFocus(chip.id)}
                  aria-pressed={active}
                  className={`min-h-11 px-4 rounded-full border-2 text-sm font-bold transition ${
                    active
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-300 text-slate-700 hover:border-slate-500'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
          <p className="text-sm font-bold text-slate-500 ml-auto">
            {people.length} of {activePeople.length} people
          </p>
          {filtersOn && (
            <button type="button" onClick={clearFilters} className="min-h-11 px-3 text-sm font-bold text-slate-600 hover:text-slate-900">
              Clear filters
            </button>
          )}
        </div>
      </div>

      <MatrixTable
        title="Authorisations"
        description="The full list. Supervisors can open a person and check any of these."
        people={people}
        columns={tickets}
        expiresFor={expiresFor}
        savingKey={savingKey}
        onSave={save}
      />
      <MatrixTable
        title="SOPs"
        description="Training tracks every SOP. Supervisors only see one when it is due within 30 days or already expired."
        people={people}
        columns={sops}
        expiresFor={expiresFor}
        savingKey={savingKey}
        onSave={save}
      />
    </div>
  );
}

function MatrixTable({
  title,
  description,
  people,
  columns,
  expiresFor,
  savingKey,
  onSave,
}: {
  title: string;
  description: string;
  people: CrewMember[];
  columns: Authorisation[];
  expiresFor: (memberId: string, itemId: string) => string;
  savingKey: string | null;
  onSave: (memberId: string, itemId: string, expiresOn: string) => void;
}) {
  return (
    <section className="bg-white border border-slate-300 rounded-2xl p-4 shadow-sm space-y-3">
      <div>
        <h2 className="text-xl font-black text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600 mt-1">{description}</p>
      </div>
      {people.length === 0 ? (
        <p className="text-sm text-slate-500">No one matches these filters.</p>
      ) : (
        <div className="max-h-[70vh] overflow-auto">
          <table className="text-sm text-left min-w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="py-2 pr-3 font-black text-slate-700 sticky top-0 left-0 z-20 bg-white">Person</th>
                {columns.map((item) => (
                  <th key={item.id} className="py-2 px-2 font-bold text-slate-700 whitespace-nowrap sticky top-0 z-10 bg-white">{item.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.id} className="border-t border-slate-200">
                  <th className="py-2 pr-3 text-left font-bold text-slate-900 sticky left-0 z-10 bg-white whitespace-nowrap">
                    {person.display_name}
                    <span className="block text-xs font-medium text-slate-500">
                      {person.department || 'Workshop'} · {person.trade}{person.panel ? ` · ${person.panel}` : ' · No crew'}
                    </span>
                  </th>
                  {columns.map((item) => {
                    const value = expiresFor(person.id, item.id);
                    const state = authorisationState(value || null);
                    const key = `${person.id}:${item.id}`;
                    return (
                      <td key={item.id} className="py-1.5 px-2">
                        <input
                          type="date"
                          value={value ? value.slice(0, 10) : ''}
                          disabled={savingKey === key}
                          aria-label={`${person.display_name} ${item.name}`}
                          onChange={(event) => onSave(person.id, item.id, event.target.value)}
                          className={`min-h-10 px-2 rounded-lg border border-slate-300 ${CELL[state]}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
