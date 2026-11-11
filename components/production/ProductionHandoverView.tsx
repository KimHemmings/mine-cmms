import type { ReactNode } from 'react';
import { ProductionHandoverDocument } from '@/types';
import { formatDateTime } from '@/utils/helpers';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 border-b-2 border-slate-900 pb-1 mb-3">{title}</h3>
      {children}
    </section>
  );
}

export default function ProductionHandoverView({
  shiftName,
  shiftDate,
  crew,
  supervisor,
  savedAt,
  savedBy,
  document,
}: {
  shiftName: string;
  shiftDate: string | null;
  crew: string | null;
  supervisor: string | null;
  savedAt?: string | null;
  savedBy?: string | null;
  document: ProductionHandoverDocument;
}) {
  const dateLabel = shiftDate ? new Date(shiftDate).toLocaleDateString() : '';
  const oce = document.oce;
  return (
    <article className="bg-white text-slate-900">
      <header className="border-b-4 border-slate-900 pb-3">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Production shift handover</p>
        <h2 className="text-2xl font-black tracking-tight mt-1">{shiftName}{crew ? ` · ${crew}` : ''}</h2>
        <p className="text-sm mt-1">
          {dateLabel && <span>{dateLabel} · </span>}
          Supervisor: <strong>{supervisor || 'Not recorded'}</strong>
          {savedAt && <span> · Saved {formatDateTime(savedAt)}{savedBy ? ` by ${savedBy}` : ''}</span>}
        </p>
      </header>

      {document.summary && (
        <Section title="Shift briefing">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{document.summary}</p>
        </Section>
      )}

      <Section title="Safety and incidents">
        {document.safetyIncidents.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing reported this shift.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {document.safetyIncidents.map((incident) => (
              <li key={incident.id}>
                <strong>{incident.what || 'Incident'}</strong>
                {incident.where ? ` · ${incident.where}` : ''}
                {incident.action ? <span className="text-slate-600"> · {incident.action}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Safety focus / share">
        <p className="text-sm whitespace-pre-wrap">{document.safetyFocus || 'No safety share recorded.'}</p>
      </Section>

      <Section title="Training and ERT">
        {document.inTraining.length === 0 ? (
          <p className="text-sm text-slate-500">No one on this crew is under supervision.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {document.inTraining.map((row) => (
              <li key={row.name}>
                <strong>{row.name}</strong> · {row.startsLabel ? `${row.startsLabel} · ` : ''}{row.level} · {row.skill} · Assessor {row.assessor}
                {!row.assessorOnSite && <span className="font-bold text-rose-700"> · Assessor is not on this shift</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm mt-2"><strong>Trainer assessors. </strong>{document.assessorsOnSite.join(', ') || 'None on this crew.'}</p>
        <p className="text-sm"><strong>ERT. </strong>{document.ertOnSite.join(', ') || 'No ERT member is on this crew.'}</p>
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

      <Section title={`Crew on machines (${document.allocations.length})`}>
        {document.allocations.length === 0 ? (
          <p className="text-sm text-slate-500">No operators allocated.</p>
        ) : (
          <ul className="text-sm">
            {document.allocations.map((row) => (
              <li key={row.fleetId}><strong>{row.fleetId}</strong> · {row.operator} · {row.machine}{row.location ? ` · ${row.location}` : ''}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Operator changes">
        {(document.seatChanges ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No one changed seats this shift.</p>
        ) : (
          <ul className="text-sm">
            {document.seatChanges.map((row) => (
              <li key={row.id}><strong>{row.fleetId}</strong> · {row.text}{row.cab ? ` ${row.cab}` : ''}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Delays">
        {document.delays.length === 0 ? (
          <p className="text-sm text-slate-500">No delays recorded.</p>
        ) : (
          <ul className="text-sm">
            {document.delays.map((row) => (
              <li key={row.id}><strong>{row.fleetId || 'Pit'}</strong> · {row.reason}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Not running">
        {document.notCrewed.length === 0 && document.inWorkshop.length === 0 ? (
          <p className="text-sm text-slate-500">Every production machine is crewed.</p>
        ) : (
          <ul className="text-sm">
            {document.notCrewed.map((row) => <li key={row.fleetId}><strong>{row.fleetId}</strong> · {row.machine} · needs an operator{row.location ? ` · ${row.location}` : ''}</li>)}
            {document.inWorkshop.map((row) => <li key={row.fleetId}><strong>{row.fleetId}</strong> · {row.location || 'Not available'}{row.expected ? ` · expected ${row.expected}` : ''}</li>)}
          </ul>
        )}
      </Section>
    </article>
  );
}
