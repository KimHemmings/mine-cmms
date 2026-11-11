import {
  Authorisation,
  CrewAuthorisation,
  CrewMember,
  CrewSupervision,
  SeatChangeLine,
  ShiftSeatChange,
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

export function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function supervisionIsLive(row: { starts_on?: string | null }, today = new Date()) {
  const start = (row.starts_on ?? todayKey(today)).slice(0, 10);
  return start <= todayKey(today);
}

export function formatStartDay(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return iso.slice(0, 10);
  return new Date(year, month - 1, day).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export function trainingSentence(row: TraineeLine) {
  const when = row.startsLabel ? `${row.startsLabel}, ` : '';
  return `${row.name}: ${when}${row.level} for ${row.skill}. Assessor ${row.assessor}${row.assessorOnSite ? '' : ' is not on this shift'}.`;
}

export function seatChangeLines(
  changes: ShiftSeatChange[],
  crew: CrewMember[],
  fleetByAsset: Map<string, string>,
  supervision: CrewSupervision[],
): SeatChangeLine[] {
  return [...changes]
    .sort((a, b) => a.changed_at.localeCompare(b.changed_at))
    .map((change) => {
      const on = crew.find((member) => member.id === change.on_crew_member_id);
      const off = crew.find((member) => member.id === change.off_crew_member_id);
      const time = new Date(change.changed_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
      const training = on ? supervisionFor(on.id, supervision) : null;
      const assessor = crew.find((member) => member.id === training?.assessor_id);
      const liveClose = !!training && supervisionIsLive(training) && training.level === 'close';
      return {
        id: change.id,
        assetId: change.asset_id,
        fleetId: fleetByAsset.get(change.asset_id) ?? 'Machine',
        text: `${on?.display_name ?? 'Someone'} on at ${time}, ${off?.display_name ?? 'someone'} off.`,
        cab: liveClose ? `Assessor ${assessor?.display_name ?? 'not named'} has to be in the cab.` : '',
      };
    });
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
    const live = supervisionIsLive(row);
    return [{
      name: person.display_name,
      level: LEVEL_WORD[row.level],
      skill: row.skill,
      assessor: assessor?.display_name ?? 'No assessor named',
      assessorOnSite: !!row.assessor_id && onSite.has(row.assessor_id),
      startsLabel: live || !row.starts_on ? '' : `Starts ${formatStartDay(row.starts_on)}`,
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
