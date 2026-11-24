'use client';

import type { ReactNode } from 'react';
import { HandoverLogCategory, HandoverMachineLine, HandoverPartLine, HandoverSnapshot } from '@/types';
import { formatDateTime } from '@/utils/helpers';
import { stageLabel } from '@/utils/handoverDocument';
import { compareHandoverMachines, normalizePriority, priorityBadgeClass } from '@/utils/handoverPriority';
import OcePdfLink, { isPdfDataUrl } from './OcePdfLink';

interface HandoverDocumentViewProps {
  shiftName: string;
  shiftDate: string | null;
  crew: string | null;
  supervisor: string | null;
  savedAt?: string | null;
  savedBy?: string | null;
  document: HandoverSnapshot;
  emptyCrewMessage?: string;
  isLivePreview?: boolean;
  outgoingSignedBy?: string | null;
  outgoingSignedAt?: string | null;
  oncomingSignedBy?: string | null;
  oncomingSignedAt?: string | null;
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
  const accent = title.toLowerCase().includes('safety') ? 'border-l-amber-500' : 'border-l-slate-700';
  return (
    <section className={`mt-6 overflow-hidden rounded-xl border border-slate-200 border-l-4 ${accent} bg-white print:overflow-visible ${className}`}>
      <h3 className="border-b border-slate-200 bg-slate-50/90 px-5 py-3.5 text-sm font-black uppercase tracking-wide text-slate-800">
        {title}
      </h3>
      <div className="p-4">{children}</div>
    </section>
  );
}

function partRowClass(part: HandoverPartLine) {
  if (part.kind === 'borrowed') return 'border-l-rose-600 bg-rose-50';
  if (part.kind === 'hotshot' || part.hotshot) return 'border-l-orange-500 bg-orange-50';
  if (part.kind === 'on_order') return 'border-l-emerald-600 bg-emerald-50';
  return 'border-l-slate-300';
}

function workOrderLabel(value: string | null, suffix: string) {
  const workOrder = value?.trim().replace(/^WO\s+(WO-)/i, '$1');
  if (!workOrder) return '';
  return `${/^WO/i.test(workOrder) ? '' : 'WO '}${workOrder}${suffix}`;
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
          <ul className="list-disc pl-4 text-sm">
            {machineSummary.map((bullet, index) => <li key={`${machine.fleetId}-summary-${index}`}>{bullet}</li>)}
          </ul>
        </div>
      )}
      {rawNotes.length > 0 && (
        <details className="print:hidden">
          <summary className="cursor-pointer text-xs font-bold text-slate-500">View job notes ({rawNotes.length})</summary>
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
  isLivePreview = false,
}: HandoverDocumentViewProps) {
  const dateLabel = shiftDate ? new Date(shiftDate).toLocaleDateString() : '';
  const allocation = document.allocation ?? { panel: null, people: [], withOutgoing: [], needsName: [] };
  const outgoingCrew = document.outgoingCrew ?? crew;
  const incomingCrew = document.incomingCrew ?? allocation.panel;
  const shiftSummary = (document.shift_summary ?? document.summary ?? '').trim();
  const oceFile = document.oce?.fileName?.trim() || '';
  const oceDataUrl = isPdfDataUrl(document.oce?.dataUrl) ? document.oce?.dataUrl : null;
  const handedOverMachines = [...document.handedOver].sort(compareHandoverMachines);
  const releasedMachines = [...document.released].sort(compareHandoverMachines);
  const parts = document.parts ?? [];
  const safetyLog = document.log.filter((entry) => entry.category === 'SAFETY');
  const incidents = document.safetyIncidents ?? [];
  const notes = NOTE_ORDER
    .map((group) => ({
      ...group,
      entries: document.log.filter((entry) => entry.category === group.category),
    }))
    .filter((group) => group.entries.length > 0);

  return (
    <article className="handover-print-document bg-white text-slate-900 print:overflow-visible">
      <header className={`border-b-4 border-slate-900 pb-3 ${isLivePreview ? 'hidden print:block' : ''}`}>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Maintenance shift handover</p>
        <h2 className="text-2xl font-black tracking-tight mt-1">{shiftName}{outgoingCrew ? ` · ${outgoingCrew}` : ''}</h2>
        <p className="text-sm mt-1">
          {dateLabel && <span>{dateLabel} · </span>}
          Supervisor: <strong>{supervisor || 'Not recorded'}</strong>
          {incomingCrew && <span> · Incoming crew: <strong>{incomingCrew}</strong></span>}
          {savedAt && <span> · Saved {formatDateTime(savedAt)}{savedBy ? ` by ${savedBy}` : ''}</span>}
        </p>
      </header>

      <div className="mt-4 grid gap-3 grid-cols-1">
        <section className="handover-briefing break-inside-avoid rounded-lg border-2 border-slate-300 bg-slate-50/50 p-4">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Shift summary</h3>
          <div className="mt-2">
            <BriefingNotes text={shiftSummary || 'No summary recorded.'} />
          </div>
          <div className="mt-4 border-t border-slate-200 pt-3">
            <h4 className="text-xs font-black uppercase tracking-wide text-slate-600">Notes for the next shift</h4>
            {notes.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Nothing logged for safety, weather, manning, or priorities.</p>
            ) : (
              <div className="mt-2 space-y-3">
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
          </div>
        </section>
        {(oceFile && (document.oce?.storagePath || oceDataUrl)) && (
          <OcePdfLink
            fileName={oceFile}
            storagePath={document.oce?.storagePath}
            dataUrl={oceDataUrl}
            fileSize={document.oce?.fileSize}
          />
        )}
      </div>

      <Section title="Safety and incidents" className={isLivePreview ? 'hidden print:block' : ''}>
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

      <Section title="Safety focus / share" className={isLivePreview ? 'hidden print:block' : ''}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{document.safetyFocus || 'No safety share recorded.'}</p>
      </Section>

      <Section title="Training, ERT and workshop crew">
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
        {document.manning && (
          <ul className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm">
            <li><strong>On-shift trades ({document.manning.onShift.length}). </strong>{document.manning.onShift.join(', ') || 'None.'}</li>
            <li><strong>Away / sick / leave. </strong>{document.manning.away.join(', ') || 'None.'}</li>
            <li><strong>Overtime and labour hire. </strong>{document.manning.overtime.join(', ') || 'None.'}</li>
            <li><strong>Unallocated. </strong>{document.manning.unallocated.join(', ') || 'None.'}</li>
            <li><strong>Bay-assigned. </strong>{document.manning.assigned.join(', ') || 'None.'}</li>
          </ul>
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

      <Section title={`Parts and hotshots (${parts.length})`}>
        {parts.length === 0 ? (
          <p className="text-sm text-slate-500">No parts logged on the jobs carrying over.</p>
        ) : (
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs uppercase text-slate-500">
                <th className="py-1 pr-3 font-bold">Machine</th>
                <th className="py-1 pr-3 font-bold">Supplier</th>
                <th className="py-1 pr-3 font-bold">Ordered</th>
                <th className="py-1 pr-3 font-bold">ETA</th>
                <th className="py-1 pr-3 font-bold">Description</th>
                <th className="py-1 font-bold">Reason</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((part, index) => (
                <tr key={`${part.fleetId}-${part.description}-${index}`} className={`border-t border-l-4 border-slate-200 align-top ${partRowClass(part)}`}>
                  <td className="py-2 pr-3 whitespace-nowrap font-bold">{part.fleetId}</td>
                  <td className="py-2 pr-3">{part.carrier || '—'}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{part.orderedOn ? part.orderedOn.slice(0, 10) : '—'}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{part.eta ? (part.eta.length <= 10 ? part.eta : formatDateTime(part.eta)) : '—'}</td>
                  <td className="py-2 pr-3">{part.description}</td>
                  <td className="py-2">{part.reason || part.po || '—'}</td>
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
                <th className="w-[16%] py-1 pr-4 align-top wrap-break-word font-bold">Unit</th>
                <th className="w-[56%] py-1 pr-4 align-top wrap-break-word font-bold">Job & shift notes</th>
                <th className="w-[16%] py-1 pr-4 align-top wrap-break-word font-bold">Crew</th>
                <th className="w-[12%] py-1 pr-4 align-top wrap-break-word font-bold">Expected back</th>
              </tr>
            </thead>
            <tbody>
              {handedOverMachines.map((machine) => (
                <tr key={machine.fleetId} className="break-inside-avoid border-t border-slate-200 align-top">
                  <td className="w-[16%] py-2 pr-4 align-top wrap-break-word leading-snug print:py-1.5">
                    <div className="wrap-break-word">
                      <strong>{machine.fleetId}</strong>{' '}
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 align-middle text-[10px] ${priorityBadgeClass(machine.priority)} print:bg-white print:text-black print:border-black`}>
                        [{normalizePriority(machine.priority)}]
                      </span>
                    </div>
                    <span className="block wrap-break-word text-xs text-slate-700">{machine.makeModel || 'Model not recorded'}</span>
                    <span className="block wrap-break-word text-xs text-slate-500">{machine.location || 'Location not recorded'}</span>
                  </td>
                  <td className="w-[56%] py-2 pr-4 align-top wrap-break-word print:py-1.5">
                    <MachineJobNotes machine={machine} summaries={document.machine_summaries} log={document.log} />
                  </td>
                  <td className="w-[16%] py-2 pr-4 align-top wrap-break-word print:py-1.5">
                    {machine.orders.map((order) => order.fitter).filter(Boolean).join(', ') || (
                      <span className="font-bold text-amber-800">Unassigned</span>
                    )}
                  </td>
                  <td className="w-[12%] py-2 pr-4 align-top wrap-break-word print:py-1.5">{formatDateTime(machine.expectedUp)}</td>
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
                <th className="w-[16%] py-1 pr-4 align-top wrap-break-word font-bold">Unit</th>
                <th className="w-[56%] py-1 pr-4 align-top wrap-break-word font-bold">Job & shift notes</th>
                <th className="w-[16%] py-1 pr-4 align-top wrap-break-word font-bold">Crew</th>
                <th className="w-[12%] py-1 pr-4 align-top wrap-break-word font-bold">Release time</th>
              </tr>
            </thead>
            <tbody>
              {releasedMachines.map((machine) => (
                <tr key={machine.fleetId} className="break-inside-avoid border-t border-slate-200 align-top">
                  <td className="w-[16%] py-2 pr-4 align-top wrap-break-word leading-snug print:py-1.5">
                    <div className="wrap-break-word">
                      <strong>{machine.fleetId}</strong>{' '}
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 align-middle text-[10px] ${priorityBadgeClass(machine.priority)} print:bg-white print:text-black print:border-black`}>
                        [{normalizePriority(machine.priority)}]
                      </span>
                    </div>
                    <span className="block wrap-break-word text-xs text-slate-700">{machine.makeModel || 'Model not recorded'}</span>
                    <span className="block wrap-break-word text-xs text-slate-500">{machine.location || 'Location not recorded'}</span>
                  </td>
                  <td className="w-[56%] py-2 pr-4 align-top wrap-break-word print:py-1.5">
                    <MachineJobNotes machine={machine} summaries={document.machine_summaries} log={document.log} />
                  </td>
                  <td className="w-[16%] py-2 pr-4 align-top wrap-break-word print:py-1.5">
                    {machine.orders.map((order) => order.fitter).filter(Boolean).join(', ') || (
                      <span className="font-bold text-amber-800">Unassigned</span>
                    )}
                  </td>
                  <td className="w-[12%] py-2 pr-4 align-top wrap-break-word print:py-1.5">{formatDateTime(machine.actualUp ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

    </article>
  );
}
