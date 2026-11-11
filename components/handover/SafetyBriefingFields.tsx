'use client';

import { Plus, Trash2 } from 'lucide-react';
import { SafetyIncident } from '@/types';

export default function SafetyBriefingFields({
  incidents,
  focus,
  onIncidents,
  onFocus,
}: {
  incidents: SafetyIncident[];
  focus: string;
  onIncidents: (incidents: SafetyIncident[]) => void;
  onFocus: (focus: string) => void;
}) {
  const update = (id: string, field: keyof Omit<SafetyIncident, 'id'>, value: string) =>
    onIncidents(incidents.map((incident) => (incident.id === id ? { ...incident, [field]: value } : incident)));

  return (
    <section className="rounded-xl border border-slate-300 bg-white p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-black text-slate-900">Safety and incidents</h3>
          <p className="text-sm text-slate-600">These become their own slides. Record what happened, where, and what the oncoming crew must do.</p>
        </div>
        <button
          type="button"
          onClick={() => onIncidents([...incidents, { id: crypto.randomUUID(), what: '', where: '', action: '' }])}
          className="min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-bold flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add incident
        </button>
      </div>
      {incidents.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing reported. The slide still goes in the briefing so the crew can see a clear shift.</p>
      ) : (
        <ul className="space-y-3">
          {incidents.map((incident) => (
            <li key={incident.id} className="grid gap-2 md:grid-cols-[1fr_1fr_1.4fr_auto]">
              <input value={incident.what} onChange={(event) => update(incident.id, 'what', event.target.value)} placeholder="What happened" className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm" />
              <input value={incident.where} onChange={(event) => update(incident.id, 'where', event.target.value)} placeholder="Where" className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm" />
              <input value={incident.action} onChange={(event) => update(incident.id, 'action', event.target.value)} placeholder="What the next crew must do" className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm" />
              <button type="button" onClick={() => onIncidents(incidents.filter((item) => item.id !== incident.id))} className="min-h-11 px-3 rounded-lg border border-slate-300 text-slate-500" aria-label="Remove incident">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="block space-y-1">
        <span className="text-sm font-black text-slate-900">Safety focus / share</span>
        <textarea
          value={focus}
          onChange={(event) => onFocus(event.target.value)}
          rows={3}
          placeholder="The one thing this crew is asked to watch this shift"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
    </section>
  );
}
