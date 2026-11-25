'use client';

import type { ReactNode } from 'react';
import { HandoverMachineLine, HandoverPartLine, HandoverSnapshot } from '@/types';
import { formatDateTime } from '@/utils/helpers';
import { stageLabel } from '@/utils/handoverDocument';
import { compareHandoverMachines, normalizePriority, priorityBadgeClass } from '@/utils/handoverPriority';
import { OcePdfFrame, isPdfDataUrl } from './OcePdfLink';

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
  oceControls?: ReactNode;
  summaryControls?: ReactNode;
  canAcknowledge?: boolean;
  onAcknowledge?: () => void;
  onUndoOutgoing?: () => void;
  outgoingSignedBy?: string | null;
  outgoingSignedAt?: string | null;
  oncomingSignedBy?: string | null;
  oncomingSignedAt?: string | null;
}

function Section({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  const accent = title.toLowerCase().includes('safety') ? 'border-l-amber-500' : 'border-l-slate-700';
  return (
    <section className={`handover-section mt-6 overflow-hidden rounded-xl border border-slate-200 border-l-4 ${accent} bg-white print:overflow-visible ${className}`}>
      <h3 className="handover-heading border-b border-slate-200 bg-slate-50/90 px-5 py-3.5 text-sm font-black uppercase tracking-wide text-slate-800">
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
      {machineSummary && machineSummary.length > 0 ? (
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">This shift</p>
          <ul className="mt-1 list-disc pl-4 text-sm">
            {machineSummary.map((bullet, index) => <li key={`${machine.fleetId}-summary-${index}`}>{bullet}</li>)}
          </ul>
        </div>
      ) : rawNotes.length > 0 ? (
        <p className="text-sm text-slate-700">{rawNotes[0]}</p>
      ) : null}
    </div>
  );
}

function MachineCard({
  machine,
  summaries,
  log,
  whenLabel,
  when,
}: {
  machine: HandoverMachineLine;
  summaries?: Record<string, string[]>;
  log: HandoverSnapshot['log'];
  whenLabel: string;
  when: string;
}) {
  const crew = machine.orders.map((order) => order.fitter).filter(Boolean).join(', ');
  return (
    <article className="handover-row break-inside-avoid rounded-lg border border-slate-200 border-l-4 border-l-slate-800 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-black">{machine.fleetId}</p>
          <p className="text-xs text-slate-600">{machine.makeModel || 'Model not recorded'} · {machine.location || 'Location not recorded'}</p>
        </div>
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-black ${priorityBadgeClass(machine.priority)}`}>
          {normalizePriority(machine.priority)}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-600">{crew || 'Unassigned'} · {whenLabel} {when}</p>
      <div className="mt-2">
        <MachineJobNotes machine={machine} summaries={summaries ?? {}} log={log} />
      </div>
    </article>
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
  oceControls = null,
  summaryControls = null,
  outgoingSignedBy = null,
  outgoingSignedAt = null,
  oncomingSignedBy = null,
  oncomingSignedAt = null,
  canAcknowledge = false,
  onAcknowledge,
  onUndoOutgoing,
}: HandoverDocumentViewProps) {
  const dateLabel = shiftDate ? new Date(shiftDate).toLocaleDateString() : '';
  const allocation = document.allocation ?? { panel: null, people: [], withOutgoing: [], needsName: [] };
  const outgoingCrew = document.outgoingCrew ?? crew;
  const incomingCrew = document.incomingCrew ?? allocation.panel;
  const shiftSummary = (document.shift_summary ?? document.summary ?? '').trim();
  const oceFile = document.oce?.fileName?.trim() || '';
  const oceDataUrl = isPdfDataUrl(document.oce?.dataUrl) ? document.oce?.dataUrl : null;
  const ocePath = document.oce?.storagePath ?? null;
  const handedOverMachines = [...document.handedOver].sort(compareHandoverMachines);
  const releasedMachines = [...document.released].sort(compareHandoverMachines);
  const parts = document.parts ?? [];
  const safetyLog = document.log.filter((entry) => entry.category === 'SAFETY');
  const incidents = document.safetyIncidents ?? [];

  return (
    <article className="handover-print-document bg-white text-slate-900 print:overflow-visible">
      <header className="handover-section border-b-4 border-slate-900 pb-3">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Maintenance shift handover</p>
        <h2 className="handover-heading text-2xl font-black tracking-tight mt-1">Bowen Basin workshop</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-5">
          <div><dt className="text-[11px] font-black uppercase tracking-wide text-slate-500">Shift</dt><dd className="font-bold">{shiftName}</dd></div>
          <div><dt className="text-[11px] font-black uppercase tracking-wide text-slate-500">Crew</dt><dd className="font-bold">{outgoingCrew || 'Not recorded'}</dd></div>
          <div><dt className="text-[11px] font-black uppercase tracking-wide text-slate-500">Date</dt><dd className="font-bold">{dateLabel || 'Not recorded'}</dd></div>
          <div><dt className="text-[11px] font-black uppercase tracking-wide text-slate-500">Supervisor</dt><dd className="font-bold">{supervisor || 'Not recorded'}</dd></div>
          <div><dt className="text-[11px] font-black uppercase tracking-wide text-slate-500">Incoming crew</dt><dd className="font-bold">{incomingCrew || 'Not recorded'}</dd></div>
        </dl>
        {savedAt && <p className="mt-2 text-xs text-slate-500">Saved {formatDateTime(savedAt)}{savedBy ? ` by ${savedBy}` : ''}</p>}
      </header>

      <div className="mt-4 grid gap-3 grid-cols-1">
        <section className="handover-briefing handover-section break-inside-avoid rounded-lg border-2 border-slate-300 bg-slate-50/50 p-4">
          <h3 className="handover-heading text-sm font-black uppercase tracking-wide text-slate-800">Shift summary and safety</h3>
          {summaryControls && <div className="mt-3 print:hidden">{summaryControls}</div>}
          <div className={summaryControls ? 'mt-4 hidden print:block' : 'mt-3'}>
            <BriefingNotes text={shiftSummary || 'No summary recorded.'} />
          </div>
          <div className={`mt-4 border-t border-slate-200 pt-3 ${summaryControls ? 'hidden print:block' : ''}`}>
            <h4 className="handover-heading text-xs font-black uppercase tracking-wide text-slate-600">Safety and incidents</h4>
            {incidents.length === 0 && safetyLog.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Nothing reported this shift.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
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
            {document.safetyFocus ? <p className="mt-2 text-sm whitespace-pre-wrap">{document.safetyFocus}</p> : null}
          </div>
        </section>
      </div>

      <Section title="Training, ERT and workshop crew">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-black uppercase tracking-wide text-slate-500">In training</dt>
            <dd className="mt-1">
              {(document.inTraining ?? []).length === 0 ? 'No one on this crew is under supervision.' : (document.inTraining ?? []).map((row) => (
                <span key={row.name} className="block"><strong>{row.name}</strong> · {row.level} · {row.skill} · {row.assessor}</span>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-black uppercase tracking-wide text-slate-500">Assessors on site</dt>
            <dd className="mt-1">{(document.assessorsOnSite ?? []).join(', ') || 'None on this crew.'}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-black uppercase tracking-wide text-slate-500">ERT</dt>
            <dd className="mt-1">{(document.ertOnSite ?? []).join(', ') || 'No ERT member is on this crew.'}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-black uppercase tracking-wide text-slate-500">On-shift trades</dt>
            <dd className="mt-1">{document.manning?.onShift.join(', ') || 'None.'}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-black uppercase tracking-wide text-slate-500">Away, sick or leave</dt>
            <dd className="mt-1">{document.manning?.away.join(', ') || 'None.'}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-black uppercase tracking-wide text-slate-500">Overtime and labour hire</dt>
            <dd className="mt-1">{document.manning?.overtime.join(', ') || 'None.'}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-black uppercase tracking-wide text-slate-500">Not yet on a job</dt>
            <dd className="mt-1">{document.manning?.unallocated.join(', ') || 'None.'}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-black uppercase tracking-wide text-slate-500">On a job</dt>
            <dd className="mt-1">{document.manning?.assigned.join(', ') || 'None.'}</dd>
          </div>
        </dl>
      </Section>

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
                <tr key={`${part.fleetId}-${part.description}-${index}`} className={`handover-row break-inside-avoid border-t border-l-4 border-slate-200 align-top ${partRowClass(part)}`}>
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

      <Section title={`Whiteboard (${handedOverMachines.length})`}>
        {handedOverMachines.length === 0 ? (
          <p className="text-sm text-slate-500">No machines are still down.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {handedOverMachines.map((machine) => (
              <MachineCard key={machine.fleetId} machine={machine} summaries={document.machine_summaries} log={document.log} whenLabel="Expected back" when={formatDateTime(machine.expectedUp)} />
            ))}
          </div>
        )}
      </Section>

      <Section title={`Released this shift (${releasedMachines.length})`}>
        {releasedMachines.length === 0 ? (
          <p className="text-sm text-slate-500">No machines released.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {releasedMachines.map((machine) => (
              <MachineCard key={machine.fleetId} machine={machine} summaries={document.machine_summaries} log={document.log} whenLabel="Released" when={formatDateTime(machine.actualUp ?? null)} />
            ))}
          </div>
        )}
      </Section>

      <section className="handover-oce mt-6 overflow-visible rounded-xl border border-slate-200 border-l-4 border-l-slate-700 bg-white print:overflow-visible">
        <h3 className="handover-heading border-b border-slate-200 bg-slate-50/90 px-5 py-3.5 text-sm font-black uppercase tracking-wide text-slate-800">
          OCE report
        </h3>
        <div className="space-y-3 p-4">
          {oceControls}
          {ocePath || oceDataUrl ? (
            <>
              <p className="text-sm font-bold text-slate-800">{oceFile || 'OCE report.pdf'}</p>
              <OcePdfFrame fileName={oceFile || 'OCE report.pdf'} storagePath={ocePath} dataUrl={oceDataUrl} />
            </>
          ) : (
            <p className="text-sm text-slate-500">No OCE report PDF for this shift.</p>
          )}
        </div>
      </section>

      <footer className="handover-section mt-6 break-inside-avoid rounded-xl border-2 border-slate-900 p-4">
        <h3 className="handover-heading text-sm font-black uppercase tracking-wide">Electronic sign-off</h3>
        <p className="mt-2 text-sm">
          <strong>Outgoing supervisor:</strong>{' '}
          {outgoingSignedBy && outgoingSignedAt ? (
            onUndoOutgoing ? (
              <button type="button" onClick={onUndoOutgoing} className="underline decoration-slate-400 underline-offset-2 print:no-underline">
                {outgoingSignedBy} · electronically signed {formatDateTime(outgoingSignedAt)}
              </button>
            ) : (
              `${outgoingSignedBy} · electronically signed ${formatDateTime(outgoingSignedAt)}`
            )
          ) : 'Not signed'}
        </p>
        <p className="text-sm">
          <strong>Oncoming supervisor:</strong>{' '}
          {oncomingSignedBy && oncomingSignedAt ? (
            canAcknowledge && onAcknowledge ? (
              <button type="button" onClick={onAcknowledge} className="underline decoration-slate-400 underline-offset-2 print:no-underline">
                {oncomingSignedBy} · acknowledged {formatDateTime(oncomingSignedAt)}
              </button>
            ) : (
              `${oncomingSignedBy} · acknowledged ${formatDateTime(oncomingSignedAt)}`
            )
          ) : 'Not acknowledged'}
        </p>
        {canAcknowledge && onAcknowledge && !oncomingSignedAt && (
          <button type="button" onClick={onAcknowledge} className="mt-3 min-h-10 rounded-lg bg-slate-950 px-3 text-sm font-black text-white print:hidden">
            Acknowledge handover
          </button>
        )}
      </footer>

    </article>
  );
}
