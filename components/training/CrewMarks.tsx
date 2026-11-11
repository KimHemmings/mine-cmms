import { Authorisation, CrewAuthorisation, CrewMember, CrewSupervision } from '@/types';
import { ERT_TICKET, TRAINER_ASSESSOR, holdsTicket, supervisionFor } from '@/utils/crewStanding';

const LEVEL = { close: 'Close supervision', minimal: 'Minimal supervision' };

export function CrewMarks({
  person,
  supervision,
  authorisations,
  holdings,
}: {
  person: CrewMember;
  supervision: CrewSupervision[];
  authorisations: Authorisation[];
  holdings: CrewAuthorisation[];
}) {
  const training = supervisionFor(person.id, supervision);
  const trainer = holdsTicket(person.id, TRAINER_ASSESSOR, authorisations, holdings);
  const ert = holdsTicket(person.id, ERT_TICKET, authorisations, holdings);
  if (!training && !trainer && !ert) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {training && (
        <span className={`px-1.5 py-0.5 rounded text-[11px] font-black uppercase ${training.level === 'close' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-900'}`}>
          {LEVEL[training.level]}
        </span>
      )}
      {trainer && <span className="px-1.5 py-0.5 rounded text-[11px] font-black uppercase bg-sky-100 text-sky-900">Trainer assessor</span>}
      {ert && <span className="px-1.5 py-0.5 rounded text-[11px] font-black uppercase bg-violet-100 text-violet-900">ERT</span>}
    </span>
  );
}

export function SiteCoverList({
  inTraining,
  ertOnSite,
  assessorsOnSite,
}: {
  inTraining: { name: string; level: string; skill: string; assessor: string; assessorOnSite: boolean }[];
  ertOnSite: string[];
  assessorsOnSite: string[];
}) {
  return (
    <section className="bg-white border border-slate-300 rounded-2xl p-4 shadow-sm space-y-3">
      <h3 className="text-lg font-black text-slate-900">Training and ERT on site</h3>
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">In training</p>
        {inTraining.length === 0 ? (
          <p className="text-sm text-slate-500 mt-1">No one on this crew is under supervision.</p>
        ) : (
          <ul className="mt-1 text-sm space-y-1">
            {inTraining.map((row) => (
              <li key={row.name}>
                <strong>{row.name}</strong> · {row.level} · {row.skill} · Assessor {row.assessor}
                {!row.assessorOnSite && <span className="ml-1 font-bold text-rose-700">Assessor is not on this shift.</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-sm"><strong>Trainer assessors. </strong>{assessorsOnSite.join(', ') || 'None on this crew.'}</p>
      <p className="text-sm"><strong>ERT. </strong>{ertOnSite.join(', ') || 'No ERT member is on this crew.'}</p>
    </section>
  );
}
