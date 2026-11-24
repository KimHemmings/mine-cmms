'use client';

import type { ReactNode } from 'react';
import { HandoverCarryJob, HandoverLogCategory, HandoverMachineLine, HandoverSnapshot } from '@/types';
import { formatDateTime } from '@/utils/helpers';
import { partStatusLabel, stageLabel } from '@/utils/handoverDocument';
import { compareHandoverMachines, normalizePriority, priorityBadgeClass } from '@/utils/handoverPriority';

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
  { category: 'WEATHER', title: 'Weather and roads' },
  { category: 'MANNING', title: 'Manning' },
  { category: 'PRIORITY', title: 'Priorities for the next shift' },
  { category: 'WATCHLIST', title: 'Watch' },
  { category: 'BRAKE_TEST', title: 'Brake tests' },
  { category: 'TOOLING', title: 'Tooling and rigging' },
];

function Section({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`mt-6 ${className}`}>
      <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 border-b-2 border-slate-900 pb-1 mb-3">
        {title}
      </h3>
      {children}
    </section>
  );
}

function jobText(job: HandoverCarryJob) {
  return `${workOrderLabel(job.woNumber, ': ')}${job.task}`;
}

function workOrderLabel(value: string | null, suffix: string) {
  const workOrder = value?.trim().replace(/^WO\s+(WO-)/i, '$1');
  if (!workOrder) return '';
  return `${/^WO/i.test(workOrder) ? '' : 'WO '}${workOrder}${suffix}`;
}

function SignoffMetadata({ value }: { value: string | null }) {
  if (!value) return <>Not signed.</>;
  const relief = value.match(/^(.*?) \(Relief Coverage — Home: (.*?)\)$/);
  if (!relief) return <>{value}</>;
  return (
    <>
      {relief[1]}
      <span className="ml-1 inline-block rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-black text-amber-950 print:border-black print:bg-white">
        Relief Coverage — Home: {relief[2]}
      </span>
    </>
  );
}

function inlineBriefingText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part.replaceAll('**', '').replaceAll('#', '')}</span>;
  });
}

function BriefingNotes({ text }: { text: string }) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  while (lines.length > 0 && /^#{1,6}\s/.test(lines[0])) lines.shift();
  const bullets = lines.filter((line) => /^-\s+/.test(line));
  const otherLines = lines.filter((line) => !/^-\s+/.test(line));

  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {bullets.length > 0 && (
        <ul className="list-disc space-y-1 pl-5">
          {bullets.map((line, index) => (
            <li key={`bullet-${index}`}>{inlineBriefingText(line.replace(/^-\s+/, ''))}</li>
          ))}
        </ul>
      )}
      {otherLines.map((line, index) => (
        <p key={`line-${index}`}>{inlineBriefingText(line.replace(/^#{1,6}\s*/, ''))}</p>
      ))}
    </div>
  );
}

function MachineJobNotes({
  machine,
  summaries,
  log,
}: {
  machine: HandoverMachineLine;
  summaries: Record<string, string[]>;
  log: HandoverSnapshot['log'];
}) {
  const rawNotes = [
    ...machine.shiftNotes.map((note) => `${note.at ? `${formatDateTime(note.at)} · ` : ''}${note.by ? `${note.by}: ` : ''}${note.note}`),
    ...log
      .filter((entry) => entry.fleet_id?.trim().toUpperCase() === machine.fleetId.toUpperCase())
      .map((entry) => `${formatDateTime(entry.logged_at)} · ${entry.category}: ${entry.details}${entry.action_required ? ` · Action: ${entry.action_required}` : ''}`),
  ];
  const machineSummary = summaries[machine.machineId] ?? summaries[machine.fleetId];

  return (
    <div className="space-y-2">
      {machine.orders.length === 0 ? (
        <p className="font-bold">No job recorded</p>
      ) : machine.orders.map((order, index) => (
        <div key={`${machine.fleetId}-${index}`}>
          <p className="font-bold">{order.components?.join(' / ') || 'Workshop'} — {order.task}</p>
          <p className="text-xs text-slate-500">{workOrderLabel(order.woNumber, ' · ')}{stageLabel(order.stage)}</p>
        </div>
      ))}
      {machineSummary && machineSummary.length > 0 && (
        <div className="break-inside-avoid rounded-md bg-indigo-50/70 px-2.5 py-2 print:bg-transparent print:p-0">
          <span className="mr-2 inline-flex rounded border border-indigo-200 px-1.5 py-0.5 align-middle text-[9px] font-black uppercase tracking-wide text-indigo-700 print:text-black">
            AI
          </span>
          <ul className="inline-block list-disc pl-4 align-top text-sm">
            {machineSummary.map((bullet, index) => <li key={`${machine.fleetId}-summary-${index}`}>{bullet}</li>)}
          </ul>
        </div>
      )}
      {rawNotes.length > 0 && (
        <details className="print:hidden">
          <summary className="cursor-pointer text-xs font-bold text-slate-500">View raw shift notes ({rawNotes.length})</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-600">
            {rawNotes.map((note, index) => <li key={`${machine.fleetId}-raw-${index}`}>{note}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
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
  const handedOverMachines = [...document.handedOver].sort(compareHandoverMachines);
  const releasedMachines = [...document.released].sort(compareHandoverMachines);
  const parts = document.parts ?? [];
  const safetyLog = document.log.filter((entry) => entry.category === 'SAFETY');
  const incidents = document.safetyIncidents ?? [];
  const oce = document.oce;
  const notes = NOTE_ORDER
    .map((group) => ({
      ...group,
      entries: document.log.filter((entry) => entry.category === group.category),
    }))
    .filter((group) => group.entries.length > 0);

  return (
    <article className="handover-print-document bg-white text-slate-900">
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
        <Section title="Shift briefing" className="handover-briefing break-inside-avoid">
          <BriefingNotes text={document.summary} />
        </Section>
      )}

      <Section title="Safety and incidents">
        {incidents.length === 0 && safetyLog.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing reported this shift.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {incidents.map((incident) => (
              <li key={incident.id}>
                <strong>{incident.what || 'Incident'}</strong>
                {incident.where ? ` · ${incident.where}` : ''}
                {incident.action ? <span className="text-slate-600"> · {incident.action}</span> : null}
              </li>
            ))}
            {safetyLog.map((entry) => (
              <li key={entry.id}>
                {entry.fleet_id ? <strong>{entry.fleet_id} · </strong> : null}
                {entry.details}
                {entry.action_required ? <span className="text-slate-600"> · {entry.action_required}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Safety focus / share">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{document.safetyFocus || 'No safety share recorded.'}</p>
      </Section>

      <Section title="Training and ERT">
        {(document.inTraining ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No one on this crew is under supervision.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {(document.inTraining ?? []).map((row) => (
              <li key={row.name}>
                <strong>{row.name}</strong> · {row.startsLabel ? `${row.startsLabel} · ` : ''}{row.level} · {row.skill} · Assessor {row.assessor}
                {!row.assessorOnSite && <span className="font-bold text-rose-700"> · Assessor is not on this shift</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm mt-2"><strong>Trainer assessors. </strong>{(document.assessorsOnSite ?? []).join(', ') || 'None on this crew.'}</p>
        <p className="text-sm"><strong>ERT. </strong>{(document.ertOnSite ?? []).join(', ') || 'No ERT member is on this crew.'}</p>
      </Section>

      <Section title="OCE report">
        {!oce ? (
          <p className="text-sm text-slate-500">No OCE report uploaded for this shift.</p>
        ) : (
          <div className="text-sm space-y-2">
            {oce.fileName && <p className="font-bold">{oce.fileName}</p>}
            <p className="whitespace-pre-wrap">{oce.briefing.summary || 'The report is attached. No briefing was written.'}</p>
            {oce.briefing.restrictions.length > 0 && <p><strong>Restrictions. </strong>{oce.briefing.restrictions.join(' ')}</p>}
            {oce.briefing.hazards.length > 0 && <p><strong>Hazards. </strong>{oce.briefing.hazards.join(' ')}</p>}
            {oce.briefing.conditions.length > 0 && <p><strong>Conditions. </strong>{oce.briefing.conditions.join(' ')}</p>}
          </div>
        )}
      </Section>

      {(document.machineNotes ?? []).length > 0 && (
        <Section title="What was noted this shift" className="break-inside-avoid">
          <ul className="text-sm space-y-1">
            {(document.machineNotes ?? []).map((note) => (
              <li key={note.fleetId}><strong>{note.fleetId}.</strong> {note.summary}</li>
            ))}
          </ul>
        </Section>
      )}

      {document.manning && (
        <Section title={document.manning.panel ? `Workshop crew · ${document.manning.panel}` : 'Workshop crew'}>
          <ul className="text-sm space-y-1">
            <li><strong>On-shift trades ({document.manning.onShift.length}). </strong>{document.manning.onShift.join(', ') || 'None.'}</li>
            <li><strong>Away / sick / leave. </strong>{document.manning.away.join(', ') || 'None.'}</li>
            <li><strong>Overtime and labour hire. </strong>{document.manning.overtime.join(', ') || 'None.'}</li>
            <li><strong>Unallocated. </strong>{document.manning.unallocated.join(', ') || 'None.'}</li>
            <li><strong>Bay-assigned. </strong>{document.manning.assigned.join(', ') || 'None.'}</li>
            <li><strong>Outgoing. </strong><SignoffMetadata value={document.manning.outgoing} /></li>
            <li><strong>Oncoming. </strong><SignoffMetadata value={document.manning.oncoming} /></li>
          </ul>
        </Section>
      )}

      <Section title={allocation.panel ? `Jobs for ${allocation.panel}` : 'Jobs for the crew coming on'}>
        {!allocation.panel ? (
          <p className="text-sm text-slate-500">{emptyCrewMessage}</p>
        ) : allocation.people.length === 0 ? (
          <p className="text-sm text-slate-500">No one is rostered on {allocation.panel}.</p>
        ) : (
          <div className="space-y-2">
            {allocation.people.filter((person) => person.jobs.length > 0).map((person) => (
              <div key={person.name}>
                <p className="text-sm font-black text-slate-900">
                  {person.name}{person.trade ? <span className="font-bold text-slate-500"> · {person.trade}</span> : null}
                </p>
                <ul className="text-sm">
                  {person.jobs.map((job, index) => (
                    <li key={`${person.name}-${job.fleetId}-${index}`}>
                      <strong>{job.fleetId}</strong> · {jobText(job)}
                      <span className="text-slate-500"> · {stageLabel(job.stage)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {allocation.people.some((person) => person.jobs.length === 0) && (
              <p className="break-inside-avoid text-sm">
                <strong>Available / Unallocated Crew ({allocation.people.filter((person) => person.jobs.length === 0).length}): </strong>
                {allocation.people
                  .filter((person) => person.jobs.length === 0)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((person) => `${person.name}${person.trade ? ` (${person.trade})` : ''}`)
                  .join(', ')}
              </p>
            )}
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

      <Section title={`Still down (${handedOverMachines.length})`}>
        {handedOverMachines.length === 0 ? (
          <p className="text-sm text-slate-500">No machines handed over.</p>
        ) : (
          <table className="w-full table-fixed text-sm text-left">
            <thead>
              <tr className="text-xs uppercase text-slate-500">
                <th className="w-[16%] py-1 pr-4 align-top break-words font-bold">Unit</th>
                <th className="w-[56%] py-1 pr-4 align-top break-words font-bold">Job & shift notes</th>
                <th className="w-[16%] py-1 pr-4 align-top break-words font-bold">Crew</th>
                <th className="w-[12%] py-1 pr-4 align-top break-words font-bold">Expected back</th>
              </tr>
            </thead>
            <tbody>
              {handedOverMachines.map((machine) => (
                <tr key={machine.fleetId} className="break-inside-avoid border-t border-slate-200 align-top">
                  <td className="w-[16%] py-2 pr-4 align-top break-words leading-snug print:py-1.5">
                    <div className="break-words">
                      <strong>{machine.fleetId}</strong>{' '}
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 align-middle text-[10px] ${priorityBadgeClass(machine.priority)} print:bg-white print:text-black print:border-black`}>
                        [{normalizePriority(machine.priority)}]
                      </span>
                    </div>
                    <span className="block break-words text-xs text-slate-700">{machine.makeModel || 'Model not recorded'}</span>
                    <span className="block break-words text-xs text-slate-500">{machine.location || 'Location not recorded'}</span>
                  </td>
                  <td className="w-[56%] py-2 pr-4 align-top break-words print:py-1.5">
                    <MachineJobNotes machine={machine} summaries={document.machine_summaries} log={document.log} />
                  </td>
                  <td className="w-[16%] py-2 pr-4 align-top break-words print:py-1.5">
                    {machine.orders.map((order) => order.fitter).filter(Boolean).join(', ') || (
                      <span className="font-bold text-amber-800">Unassigned</span>
                    )}
                  </td>
                  <td className="w-[12%] py-2 pr-4 align-top break-words print:py-1.5">{formatDateTime(machine.expectedUp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`Released this shift (${releasedMachines.length})`}>
        {releasedMachines.length === 0 ? (
          <p className="text-sm text-slate-500">No machines released.</p>
        ) : (
          <table className="w-full table-fixed text-sm text-left">
            <thead>
              <tr className="text-xs uppercase text-slate-500">
                <th className="w-[16%] py-1 pr-4 align-top break-words font-bold">Unit</th>
                <th className="w-[56%] py-1 pr-4 align-top break-words font-bold">Job & shift notes</th>
                <th className="w-[16%] py-1 pr-4 align-top break-words font-bold">Crew</th>
                <th className="w-[12%] py-1 pr-4 align-top break-words font-bold">Release time</th>
              </tr>
            </thead>
            <tbody>
              {releasedMachines.map((machine) => (
                <tr key={machine.fleetId} className="break-inside-avoid border-t border-slate-200 align-top">
                  <td className="w-[16%] py-2 pr-4 align-top break-words leading-snug print:py-1.5">
                    <div className="break-words">
                      <strong>{machine.fleetId}</strong>{' '}
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 align-middle text-[10px] ${priorityBadgeClass(machine.priority)} print:bg-white print:text-black print:border-black`}>
                        [{normalizePriority(machine.priority)}]
                      </span>
                    </div>
                    <span className="block break-words text-xs text-slate-700">{machine.makeModel || 'Model not recorded'}</span>
                    <span className="block break-words text-xs text-slate-500">{machine.location || 'Location not recorded'}</span>
                  </td>
                  <td className="w-[56%] py-2 pr-4 align-top break-words print:py-1.5">
                    <MachineJobNotes machine={machine} summaries={document.machine_summaries} log={document.log} />
                  </td>
                  <td className="w-[16%] py-2 pr-4 align-top break-words print:py-1.5">
                    {machine.orders.map((order) => order.fitter).filter(Boolean).join(', ') || (
                      <span className="font-bold text-amber-800">Unassigned</span>
                    )}
                  </td>
                  <td className="w-[12%] py-2 pr-4 align-top break-words print:py-1.5">{formatDateTime(machine.actualUp ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

      <Section title="Defects" className="break-inside-avoid">
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
