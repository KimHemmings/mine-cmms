'use client';

import type { ReactNode } from 'react';
import { HandoverCarryJob, HandoverLogCategory, HandoverSnapshot } from '@/types';
import { formatDateTime } from '@/utils/helpers';
import { partStatusLabel, stageLabel } from '@/utils/handoverDocument';

interface HandoverDocumentViewProps {
  shiftName: string;
  shiftDate: string | null;
  crew: string | null;
  supervisor: string | null;
  savedAt?: string | null;
  savedBy?: string | null;
  document: HandoverSnapshot;
  emptyCrewMessage?: string;
}

const NOTE_ORDER: { category: HandoverLogCategory; title: string }[] = [
  { category: 'SAFETY', title: 'Safety' },
  { category: 'WEATHER', title: 'Weather and roads' },
  { category: 'MANNING', title: 'Manning' },
  { category: 'PRIORITY', title: 'Priorities for the next shift' },
  { category: 'WATCHLIST', title: 'Watch' },
  { category: 'BRAKE_TEST', title: 'Brake tests' },
  { category: 'TOOLING', title: 'Tooling and rigging' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 border-b-2 border-slate-900 pb-1 mb-3">
        {title}
      </h3>
      {children}
    </section>
  );
}

function jobText(job: HandoverCarryJob) {
  return `${job.woNumber ? `WO ${job.woNumber}: ` : ''}${job.task}`;
}

export default function HandoverDocumentView({
  shiftName,
  shiftDate,
  crew,
  supervisor,
  savedAt,
  savedBy,
  document,
  emptyCrewMessage = 'The crew coming on was not recorded on this handover.',
}: HandoverDocumentViewProps) {
  const dateLabel = shiftDate ? new Date(shiftDate).toLocaleDateString() : '';
  const allocation = document.allocation ?? { panel: null, people: [], withOutgoing: [], needsName: [] };
  const parts = document.parts ?? [];
  const notes = NOTE_ORDER
    .map((group) => ({
      ...group,
      entries: document.log.filter((entry) => entry.category === group.category),
    }))
    .filter((group) => group.entries.length > 0);

  return (
    <article className="bg-white text-slate-900">
      <header className="border-b-4 border-slate-900 pb-3">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Maintenance shift handover</p>
        <h2 className="text-2xl font-black tracking-tight mt-1">{shiftName}{crew ? ` · ${crew}` : ''}</h2>
        <p className="text-sm mt-1">
          {dateLabel && <span>{dateLabel} · </span>}
          Supervisor: <strong>{supervisor || 'Not recorded'}</strong>
          {allocation.panel && <span> · Prepared for <strong>{allocation.panel}</strong></span>}
          {savedAt && <span> · Saved {formatDateTime(savedAt)}{savedBy ? ` by ${savedBy}` : ''}</span>}
        </p>
      </header>

      {document.summary && (
        <Section title="Shift briefing">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{document.summary}</p>
        </Section>
      )}

      {(document.machineNotes ?? []).length > 0 && (
        <Section title="What was noted this shift">
          <ul className="text-sm space-y-1">
            {(document.machineNotes ?? []).map((note) => (
              <li key={note.fleetId}><strong>{note.fleetId}.</strong> {note.summary}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={allocation.panel ? `Jobs for ${allocation.panel}` : 'Jobs for the crew coming on'}>
        {!allocation.panel ? (
          <p className="text-sm text-slate-500">{emptyCrewMessage}</p>
        ) : allocation.people.length === 0 ? (
          <p className="text-sm text-slate-500">No one is rostered on {allocation.panel}.</p>
        ) : (
          <div className="space-y-3">
            {allocation.people.map((person) => (
              <div key={person.name}>
                <p className="text-sm font-black text-slate-900">
                  {person.name}{person.trade ? <span className="font-bold text-slate-500"> · {person.trade}</span> : null}
                </p>
                {person.jobs.length === 0 ? (
                  <p className="text-sm text-slate-500">No job allocated.</p>
                ) : (
                  <ul className="text-sm">
                    {person.jobs.map((job, index) => (
                      <li key={`${person.name}-${job.fleetId}-${index}`}>
                        <strong>{job.fleetId}</strong> · {jobText(job)}
                        <span className="text-slate-500"> · {stageLabel(job.stage)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
        {allocation.needsName.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-black text-slate-900">Needs a name</p>
            <ul className="text-sm">
              {allocation.needsName.map((job, index) => (
                <li key={`need-${job.fleetId}-${index}`}><strong>{job.fleetId}</strong> · {jobText(job)} · {stageLabel(job.stage)}</li>
              ))}
            </ul>
          </div>
        )}
        {allocation.withOutgoing.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-black text-slate-900">Still with someone going off</p>
            <ul className="text-sm">
              {allocation.withOutgoing.map((job, index) => (
                <li key={`out-${job.fleetId}-${index}`}>
                  <strong>{job.fleetId}</strong> · {jobText(job)} · {job.names.join(', ')} · {stageLabel(job.stage)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title={`Parts and hotshots (${parts.length})`}>
        {parts.length === 0 ? (
          <p className="text-sm text-slate-500">No parts logged on the jobs carrying over.</p>
        ) : (
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs uppercase text-slate-500">
                <th className="py-1 pr-3 font-bold">Unit</th>
                <th className="py-1 pr-3 font-bold">Part</th>
                <th className="py-1 pr-3 font-bold">Status</th>
                <th className="py-1 font-bold">ETA</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((part, index) => (
                <tr key={`${part.fleetId}-${part.description}-${index}`} className="border-t border-slate-200 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap font-bold">{part.fleetId}</td>
                  <td className="py-2 pr-3">
                    {part.hotshot && <span className="font-black uppercase text-amber-700">Hotshot · </span>}
                    {part.description}
                    {part.partNumber ? <span className="text-slate-500"> · {part.partNumber}</span> : null}
                    {part.po ? <span className="block text-xs text-slate-500">Order {part.po}</span> : null}
                    {part.carrier ? <span className="block text-xs text-slate-500">{part.carrier}</span> : null}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{partStatusLabel(part.status)}</td>
                  <td className="py-2 whitespace-nowrap">{part.eta ? formatDateTime(part.eta) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`Still down (${document.handedOver.length})`}>
        {document.handedOver.length === 0 ? (
          <p className="text-sm text-slate-500">No machines handed over.</p>
        ) : (
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs uppercase text-slate-500">
                <th className="py-1 pr-3 font-bold">Unit</th>
                <th className="py-1 pr-3 font-bold">Open job</th>
                <th className="py-1 pr-3 font-bold">Crew</th>
                <th className="py-1 font-bold">Expected back</th>
              </tr>
            </thead>
            <tbody>
              {document.handedOver.map((machine) => (
                <tr key={machine.fleetId} className="border-t border-slate-200 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <strong>{machine.fleetId}</strong>
                    <span className="block text-xs text-slate-500">{machine.makeModel} · {machine.location}</span>
                    {machine.priority && <span className="text-xs font-bold">{machine.priority}</span>}
                  </td>
                  <td className="py-2 pr-3">
                    {machine.orders.length === 0 ? (
                      <span className="text-slate-500">No open job</span>
                    ) : machine.orders.map((order, index) => (
                      <p key={`${machine.fleetId}-${index}`}>
                        {order.woNumber ? `WO ${order.woNumber}: ` : ''}{order.task}
                        <span className="text-slate-500"> · {stageLabel(order.stage)}</span>
                      </p>
                    ))}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {machine.orders.map((order) => order.fitter).filter(Boolean).join(', ') || 'Unassigned'}
                  </td>
                  <td className="py-2 whitespace-nowrap">{formatDateTime(machine.expectedUp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`Released this shift (${document.released.length})`}>
        {document.released.length === 0 ? (
          <p className="text-sm text-slate-500">No machines released.</p>
        ) : (
          <p className="text-sm font-bold">{document.released.map((machine) => `${machine.fleetId} (${machine.makeModel})`).join(' · ')}</p>
        )}
      </Section>

      <Section title="Notes for the next shift">
        {notes.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing logged for safety, weather, manning, or priorities.</p>
        ) : (
          <div className="space-y-3">
            {notes.map((group) => (
              <div key={group.category}>
                <p className="text-sm font-black text-slate-900">{group.title}</p>
                <ul className="text-sm">
                  {group.entries.map((entry) => (
                    <li key={entry.id}>
                      {entry.fleet_id ? <strong>{entry.fleet_id} · </strong> : null}
                      {entry.details}
                      {entry.action_required ? <span className="text-slate-600"> · Action: {entry.action_required}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Defects">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-bold mb-1">Fixed this shift ({document.defectsFixed.length})</p>
            {document.defectsFixed.length === 0 ? <p className="text-slate-500">None closed this shift.</p> : (
              <ul className="space-y-1">
                {document.defectsFixed.map((defect, index) => (
                  <li key={`fixed-${index}`}><strong>[{defect.severity}]{defect.fleetId ? ` ${defect.fleetId}` : ''}</strong> {defect.description}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="font-bold mb-1">Still outstanding ({document.defectsOpen.length})</p>
            {document.defectsOpen.length === 0 ? <p className="text-slate-500">None.</p> : (
              <ul className="space-y-1">
                {document.defectsOpen.map((defect, index) => (
                  <li key={`open-${index}`}><strong>[{defect.severity}]{defect.fleetId ? ` ${defect.fleetId}` : ''}</strong> {defect.description}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>
    </article>
  );
}
