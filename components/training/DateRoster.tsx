'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { authorisationState } from '@/types';
import { useFeedback } from '@/components/ui/FeedbackProvider';

const STATE_WORD = { current: 'Current', due: 'Due soon', expired: 'Expired', not_held: 'Not held' };

export interface RosterPerson {
  id: string;
  name: string;
  detail: string;
}

export default function DateRoster({
  title,
  hint,
  picker,
  people,
  dateFor,
  onSaveOne,
  onSaveMany,
  emptyWord = 'Not held',
}: {
  title: string;
  hint: string;
  picker: ReactNode;
  people: RosterPerson[];
  dateFor: (id: string) => string | null;
  onSaveOne: (id: string, expiresOn: string) => Promise<boolean>;
  onSaveMany: (ids: string[], expiresOn: string) => Promise<boolean>;
  emptyWord?: string;
}) {
  const { confirm, showToast } = useFeedback();
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [bulkDate, setBulkDate] = useState('');
  const [saving, setSaving] = useState(false);
  const peopleKey = people.map((person) => person.id).join('|');

  useEffect(() => {
    setTicked(new Set());
  }, [peopleKey]);

  function toggle(id: string) {
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function apply() {
    const chosen = people.filter((person) => ticked.has(person.id));
    if (!bulkDate || chosen.length === 0 || saving) return;
    const ok = await confirm({
      title: `Set this date for ${chosen.length} ${chosen.length === 1 ? 'person' : 'people'}?`,
      message: `${chosen.map((person) => person.name).join(', ')}. Anyone not ticked is left as they are.`,
      confirmLabel: 'Set the date',
    });
    if (!ok) return;
    setSaving(true);
    const saved = await onSaveMany(chosen.map((person) => person.id), bulkDate);
    setSaving(false);
    if (!saved) {
      showToast({ message: 'Could not set that date.', tone: 'error' });
      return;
    }
    setTicked(new Set());
    showToast({ message: 'Date set' });
  }

  return (
    <section className="bg-white border border-slate-300 rounded-2xl p-4 shadow-sm space-y-3">
      <div>
        <h2 className="text-xl font-black text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600 mt-1">{hint}</p>
      </div>
      {picker}
      <div className="flex flex-wrap items-end gap-2">
        <button type="button" onClick={() => setTicked(new Set(people.map((person) => person.id)))} className="min-h-10 px-3 rounded-lg border border-slate-300 text-sm font-bold">
          Tick everyone shown
        </button>
        <button type="button" onClick={() => setTicked(new Set())} className="min-h-10 px-3 rounded-lg border border-slate-300 text-sm font-bold">
          Clear ticks
        </button>
        <label className="text-sm font-bold text-slate-700">
          Same date
          <input type="date" value={bulkDate} onChange={(event) => setBulkDate(event.target.value)} className="mt-1 block min-h-10 rounded-lg border border-slate-300 px-2" />
        </label>
        <button type="button" disabled={!bulkDate || ticked.size === 0 || saving} onClick={() => void apply()} className="min-h-10 px-4 rounded-lg bg-emerald-600 text-white text-sm font-bold disabled:opacity-50">
          {saving ? 'Saving...' : `Set for ${ticked.size} ticked`}
        </button>
      </div>
      {people.length === 0 ? (
        <p className="text-sm text-slate-500">No one is in this crew.</p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
          {people.map((person) => {
            const expires = dateFor(person.id);
            const state = authorisationState(expires);
            return (
              <li key={person.id} className="px-3 py-2 flex items-center justify-between gap-3">
                <label className="flex items-center gap-3 min-w-0">
                  <input type="checkbox" checked={ticked.has(person.id)} onChange={() => toggle(person.id)} className="h-5 w-5" aria-label={`Include ${person.name}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{person.name}</span>
                    <span className="block text-xs text-slate-500">{person.detail}</span>
                  </span>
                </label>
                <span className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-black uppercase ${state === 'expired' ? 'text-rose-700' : state === 'due' ? 'text-amber-700' : state === 'current' ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {state === 'not_held' ? emptyWord : STATE_WORD[state]}
                  </span>
                  <input
                    type="date"
                    value={expires ? expires.slice(0, 10) : ''}
                    aria-label={`${person.name} date`}
                    onChange={(event) => void onSaveOne(person.id, event.target.value)}
                    className="min-h-10 px-2 rounded-lg border border-slate-300"
                  />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
