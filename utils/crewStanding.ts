import {
  Authorisation,
  CrewAuthorisation,
  CrewMember,
  CrewSupervision,
  TraineeLine,
  authorisationState,
} from '@/types';

export const TRAINER_ASSESSOR = 'Trainer assessor';
export const ERT_TICKET = 'ERT';

const LEVEL_WORD = { close: 'Close supervision', minimal: 'Minimal supervision' } as const;

export function holdsTicket(
  memberId: string,
  ticketName: string,
  authorisations: Authorisation[],
  holdings: CrewAuthorisation[],
) {
  const ticket = authorisations.find((item) => item.kind !== 'SOP' && item.name === ticketName);
  if (!ticket) return false;
  const expires = holdings.find((row) => row.crew_member_id === memberId && row.authorisation_id === ticket.id)?.expires_on ?? null;
  const state = authorisationState(expires);
  return state === 'current' || state === 'due';
}

export function supervisionFor(memberId: string, supervision: CrewSupervision[]) {
  return supervision.find((row) => row.crew_member_id === memberId) ?? null;
}

export function siteCover(
  people: CrewMember[],
  supervision: CrewSupervision[],
  authorisations: Authorisation[],
  holdings: CrewAuthorisation[],
  crew: CrewMember[],
) {
  const onSite = new Set(people.map((person) => person.id));
  const inTraining: TraineeLine[] = supervision.flatMap((row) => {
    if (!onSite.has(row.crew_member_id)) return [];
    const person = people.find((member) => member.id === row.crew_member_id);
    if (!person) return [];
    const assessor = crew.find((member) => member.id === row.assessor_id);
    return [{
      name: person.display_name,
      level: LEVEL_WORD[row.level],
      skill: row.skill,
      assessor: assessor?.display_name ?? 'No assessor named',
      assessorOnSite: !!row.assessor_id && onSite.has(row.assessor_id),
    }];
  });
  const named = (ticket: string) => people
    .filter((person) => holdsTicket(person.id, ticket, authorisations, holdings))
    .map((person) => person.display_name)
    .sort((a, b) => a.localeCompare(b));
  return {
    inTraining,
    ertOnSite: named(ERT_TICKET),
    assessorsOnSite: named(TRAINER_ASSESSOR),
  };
}
